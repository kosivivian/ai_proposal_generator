import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole, GateError } from "@/lib/proposals/gates";
import { parseCsv, validateRows, type ValidRow } from "@/lib/intake/csv";
import { flagExactDuplicates } from "@/lib/intake/duplicate";
import { findClientsByEmailsBatch, normalizeEmail } from "@/lib/clients/resolve";

/**
 * Parses and validates the uploaded CSV but writes NOTHING to the DB — the
 * rep reviews the valid/invalid split and can fix or skip rows before
 * anything is committed as a draft proposal (PRD §4.2). Client resolution
 * here is read-only too (existing-client lookup only, no creation) —
 * clients only actually get created at confirm time.
 */
export async function POST(req: Request) {
  const supabase = await createClient();

  try {
    const user = await requireUser(supabase);
    await requireRole(supabase, user.id, ["sales_rep"]);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing CSV file" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);
    const { validRows, invalidRows } = validateRows(rows);

    const clientsByEmail = await findClientsByEmailsBatch(
      validRows.map((r) => r.client.client_contact_email),
    );
    const duplicateFlags = await flagExactDuplicates(
      validRows.map((r) => ({
        rowNumber: r.rowNumber,
        email: normalizeEmail(r.client.client_contact_email),
        data: r.data,
      })),
    );

    const enrichedRows: ValidRow[] = validRows.map((row) => {
      const client = clientsByEmail.get(normalizeEmail(row.client.client_contact_email));
      return {
        ...row,
        clientStatus: client
          ? { existed: true, clientName: client.client_name, companyName: client.company_name }
          : { existed: false, clientName: row.client.client_name, companyName: row.client.company_name || null },
        exactDuplicate: duplicateFlags.get(row.rowNumber),
      };
    });

    return NextResponse.json({
      source_filename: file.name,
      row_count: rows.length,
      validRows: enrichedRows,
      invalidRows,
    });
  } catch (err) {
    if (err instanceof GateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Preflight failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
