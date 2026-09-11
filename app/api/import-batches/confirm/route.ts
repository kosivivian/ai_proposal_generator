import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, GateError } from "@/lib/proposals/gates";
import { validateRows } from "@/lib/intake/csv";
import { toProposalInsertFields } from "@/lib/intake/schema";
import { flagExactDuplicates } from "@/lib/intake/duplicate";
import { resolveOrCreateClientsBatch, normalizeEmail } from "@/lib/clients/resolve";

/**
 * Commits a bulk import batch. Re-validates every row server-side rather
 * than trusting the round-tripped preflight payload — a tampered request
 * must not be able to sneak a required-field-missing OR exact-duplicate
 * row past insert (there's no override affordance for exact duplicates
 * anywhere in this feature, so this re-check is the actual enforcement).
 */
export async function POST(req: Request) {
  const supabase = await createClient();

  try {
    const user = await requireUser(supabase);

    const body = await req.json().catch(() => null);
    const rows: Record<string, unknown>[] = Array.isArray(body?.rows) ? body.rows : [];
    const sourceFilename: string | null = typeof body?.source_filename === "string" ? body.source_filename : null;

    if (rows.length === 0) {
      return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    }

    const { validRows: allValidRows, invalidRows } = validateRows(rows);
    if (allValidRows.length === 0) {
      return NextResponse.json({ error: "No valid rows to import", invalidRows }, { status: 400 });
    }

    const duplicateFlags = await flagExactDuplicates(
      allValidRows.map((r) => ({
        rowNumber: r.rowNumber,
        email: normalizeEmail(r.client.client_contact_email),
        data: r.data,
      })),
    );
    const validRows = allValidRows.filter((r) => !duplicateFlags.has(r.rowNumber));
    const excludedAsDuplicate = allValidRows.length - validRows.length;

    if (validRows.length === 0) {
      return NextResponse.json({ error: "Every row was an exact duplicate — nothing to import" }, { status: 400 });
    }

    const { data: batch, error: batchError } = await supabase
      .from("import_batches")
      .insert({
        uploaded_by: user.id,
        source_filename: sourceFilename,
        row_count: rows.length,
        valid_row_count: validRows.length,
        status: "processing",
      })
      .select()
      .single();
    if (batchError || !batch) {
      return NextResponse.json({ error: `Failed to create import batch: ${batchError?.message}` }, { status: 500 });
    }

    const clientsByEmail = await resolveOrCreateClientsBatch(
      validRows.map((r) => r.client),
      user.id,
    );

    // A single multi-row insert() is one SQL INSERT — atomic at the
    // Postgres level (all rows or none).
    const { data: created, error: insertError } = await supabase
      .from("proposals")
      .insert(
        validRows.map((row) => ({
          ...toProposalInsertFields(row.data),
          client_id: clientsByEmail.get(normalizeEmail(row.client.client_contact_email))!.id,
          batch_id: batch.id,
          created_by: user.id,
          missing_fields: row.missing_fields,
        })),
      )
      .select("id, client_id");

    await supabase
      .from("import_batches")
      .update({ status: insertError ? "failed" : "completed" })
      .eq("id", batch.id);

    if (insertError) {
      return NextResponse.json({ error: `Failed to create proposals: ${insertError.message}` }, { status: 500 });
    }

    const clientById = new Map([...clientsByEmail.values()].map((c) => [c.id, c]));
    const createdWithClientNames = (created ?? []).map((p) => ({
      id: p.id,
      client_name: clientById.get(p.client_id)?.company_name || clientById.get(p.client_id)?.client_name || "",
    }));

    return NextResponse.json({
      batch,
      created: createdWithClientNames,
      skipped: invalidRows,
      excludedAsDuplicate,
    });
  } catch (err) {
    if (err instanceof GateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
