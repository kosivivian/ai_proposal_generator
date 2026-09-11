import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole, GateError } from "@/lib/proposals/gates";
import { withExternalCall } from "@/lib/errors/withExternalCall";
import { getAnthropicClient, ANTHROPIC_MODEL } from "@/lib/generation/client";
import { buildGenerationPrompt, GENERATION_SYSTEM_PROMPT } from "@/lib/generation/prompt";
import { parseClaudeSections, missingSectionContent } from "@/lib/generation/parse";
import { SECTION_KEYS, hasGapMarker } from "@/lib/generation/sections";
import { getClientById } from "@/lib/clients/resolve";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const user = await requireUser(supabase);
    await requireRole(supabase, user.id, ["sales_rep"]);

    // Compare-and-swap transition — also closes the double-click race.
    const { data: proposal } = await supabase
      .from("proposals")
      .update({ state: "generating" })
      .eq("id", id)
      .eq("state", "materials_ready")
      .select()
      .single();

    if (!proposal) {
      return NextResponse.json({ error: "Proposal is not materials_ready" }, { status: 409 });
    }

    const client = await getClientById(supabase, proposal.client_id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const { data: materials } = await supabase
      .from("proposal_materials")
      .select("material_type, file_name, processed_content")
      .eq("proposal_id", id)
      .eq("status", "processed");

    const result = await withExternalCall(
      { proposalId: id, step: "generation", onFailureState: "failed" },
      async () => {
        const prompt = buildGenerationPrompt(proposal, client, materials ?? []);
        const response = await getAnthropicClient().messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 16000,
          system: GENERATION_SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        });

        const raw = response.content
          .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
          .map((block) => block.text)
          .join("");

        const { sections, matchedCount } = parseClaudeSections(raw);
        if (matchedCount === 0) {
          throw new Error("Claude response contained no parseable section tags");
        }
        return { sections, usage: response.usage, model: response.model };
      },
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    const sectionRows = SECTION_KEYS.map((key, i) => {
      const content = result.data.sections[key] ?? missingSectionContent(key);
      return {
        proposal_id: id,
        section_key: key,
        order_index: i,
        content,
        has_gap_marker: hasGapMarker(content),
        version: 1,
        updated_by: null,
      };
    });

    const { error: sectionsError } = await supabase
      .from("proposal_sections")
      .upsert(sectionRows, { onConflict: "proposal_id,section_key" });
    if (sectionsError) {
      return NextResponse.json({ error: `Failed to save sections: ${sectionsError.message}` }, { status: 500 });
    }

    await supabase
      .from("proposals")
      .update({
        state: "generated",
        generated_at: new Date().toISOString(),
        generated_by: user.id,
        claude_model: result.data.model,
        claude_input_tokens: result.data.usage.input_tokens,
        claude_output_tokens: result.data.usage.output_tokens,
      })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
