import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, GateError } from "@/lib/proposals/gates";
import { withExternalCall } from "@/lib/errors/withExternalCall";
import { getAnthropicClient, ANTHROPIC_MODEL } from "@/lib/generation/client";
import { buildRegenerationPrompt, buildRegenerationSystemPrompt } from "@/lib/generation/prompt";
import { parseClaudeSections } from "@/lib/generation/parse";
import { SECTION_KEYS, hasGapMarker, type SectionKey } from "@/lib/generation/sections";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; sectionKey: string }> },
) {
  const { id, sectionKey } = await params;
  const supabase = await createClient();

  try {
    await requireUser(supabase);

    if (!SECTION_KEYS.includes(sectionKey as SectionKey)) {
      return NextResponse.json({ error: `Unknown section key: ${sectionKey}` }, { status: 400 });
    }
    const key = sectionKey as SectionKey;

    const body = await req.json().catch(() => ({}));
    const repNote: string | undefined = typeof body?.note === "string" ? body.note : undefined;

    const { data: proposal } = await supabase.from("proposals").select("*").eq("id", id).single();
    if (!proposal || !["generated", "in_review"].includes(proposal.state)) {
      return NextResponse.json({ error: "Proposal is not in a regenerable state" }, { status: 409 });
    }

    const { data: currentSection } = await supabase
      .from("proposal_sections")
      .select("*")
      .eq("proposal_id", id)
      .eq("section_key", key)
      .single();
    if (!currentSection) return NextResponse.json({ error: "Section not found" }, { status: 404 });

    const { data: allSections } = await supabase
      .from("proposal_sections")
      .select("section_key, content")
      .eq("proposal_id", id);

    const { data: materials } = await supabase
      .from("proposal_materials")
      .select("material_type, file_name, processed_content")
      .eq("proposal_id", id)
      .eq("status", "processed");

    // No onFailureState — a failed regen attempt shouldn't fail the whole
    // proposal; it stays in_review with the error visible on the detail page.
    const result = await withExternalCall({ proposalId: id, step: "regeneration" }, async () => {
      const prompt = buildRegenerationPrompt(key, proposal, materials ?? [], allSections ?? [], repNote);
      const response = await getAnthropicClient().messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        system: buildRegenerationSystemPrompt(key),
        messages: [{ role: "user", content: prompt }],
      });

      const raw = response.content
        .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
        .map((block) => block.text)
        .join("");

      const { sections, matchedCount } = parseClaudeSections(raw);
      if (matchedCount === 0 || !sections[key]) {
        throw new Error(`Claude's response for "${key}" contained no parseable content`);
      }
      return sections[key]!;
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

    await supabase
      .from("proposal_sections")
      .update({
        content: result.data,
        has_gap_marker: hasGapMarker(result.data),
        version: currentSection.version + 1,
        updated_by: null,
      })
      .eq("id", currentSection.id);

    return NextResponse.json({ ok: true, content: result.data });
  } catch (err) {
    if (err instanceof GateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Regeneration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
