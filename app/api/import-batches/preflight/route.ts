import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, GateError } from "@/lib/proposals/gates";
import { parseCsv, validateRows } from "@/lib/intake/csv";

/**
 * Parses and validates the uploaded CSV but writes NOTHING to the DB — the
 * rep reviews the valid/invalid split and can fix or skip rows before
 * anything is committed as a draft proposal (PRD §4.2).
 */
export async function POST(req: Request) {
  const supabase = await createClient();

  try {
    await requireUser(supabase);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing CSV file" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);
    const { validRows, invalidRows } = validateRows(rows);

    return NextResponse.json({
      source_filename: file.name,
      row_count: rows.length,
      validRows,
      invalidRows,
    });
  } catch (err) {
    if (err instanceof GateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Preflight failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
