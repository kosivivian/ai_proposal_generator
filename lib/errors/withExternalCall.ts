import { createServiceRoleClient } from "@/lib/supabase/service";
import { notifyAdminsOfError } from "@/lib/notifications/notifyAdmins";
import type { ErrorStep, Json, ProposalState } from "@/lib/types/database";

export type ExternalCallResult<T> = { ok: true; data: T } | { ok: false; error: string };

interface WithExternalCallContext {
  proposalId: string;
  materialId?: string;
  step: ErrorStep;
  /**
   * If set, the proposal is flipped to this state on failure (used for
   * generation/document_export/email_delivery, which fail the whole
   * proposal). Left unset for a single failed material or a failed
   * regeneration attempt, which must not take down the rest of the
   * proposal — see build-plan finding #3 and PRD §10's per-step isolation.
   */
  onFailureState?: ProposalState;
}

function serializeError(err: unknown): Json {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack ?? null };
  }
  return { value: String(err) };
}

async function resolvePriorErrors(ctx: WithExternalCallContext): Promise<void> {
  const service = createServiceRoleClient();
  let query = service
    .from("error_log")
    .update({ resolved: true })
    .eq("proposal_id", ctx.proposalId)
    .eq("step", ctx.step)
    .eq("resolved", false);

  query = ctx.materialId ? query.eq("material_id", ctx.materialId) : query.is("material_id", null);

  await query;
}

/** Same {proposal, step, material} key as resolvePriorErrors — used to throttle admin notifications to once per new failure. */
async function countUnresolvedErrors(ctx: WithExternalCallContext): Promise<number> {
  const service = createServiceRoleClient();
  let query = service
    .from("error_log")
    .select("id", { count: "exact", head: true })
    .eq("proposal_id", ctx.proposalId)
    .eq("step", ctx.step)
    .eq("resolved", false);

  query = ctx.materialId ? query.eq("material_id", ctx.materialId) : query.is("material_id", null);

  const { count } = await query;
  return count ?? 0;
}

/**
 * The one helper every external call routes through (file processing,
 * transcription, Claude generation/regeneration, document export, email
 * send). On failure: writes an error_log row via the service-role client
 * (no client insert policy exists on error_log) and optionally flips the
 * proposal to a visibly-failed state — never leaves it silently stuck.
 * On success: resolves any prior unresolved error_log rows for this exact
 * step (+ material, where relevant) — otherwise a stale failure from an
 * earlier attempt would sit in the "unresolved errors" list forever, even
 * after a later retry of that same step succeeds.
 */
export async function withExternalCall<T>(
  ctx: WithExternalCallContext,
  fn: () => Promise<T>,
): Promise<ExternalCallResult<T>> {
  try {
    const data = await fn();
    await resolvePriorErrors(ctx);
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const service = createServiceRoleClient();

    // Checked before inserting the new row: if this step already had an
    // unresolved failure, this is a repeat of a still-broken step, not a
    // new one — the row below is still logged either way (full history of
    // every attempt), but the admin email only fires on the first.
    const isFirstOccurrence = (await countUnresolvedErrors(ctx)) === 0;

    await service.from("error_log").insert({
      proposal_id: ctx.proposalId,
      material_id: ctx.materialId ?? null,
      step: ctx.step,
      message,
      detail: serializeError(err),
    });

    if (ctx.onFailureState) {
      await service.from("proposals").update({ state: ctx.onFailureState }).eq("id", ctx.proposalId);
    }

    if (isFirstOccurrence) {
      // Awaited, not fire-and-forget: on Vercel, an un-awaited promise can
      // be killed once the response is sent and the function invocation
      // ends. notifyAdminsOfError never throws (internally try/caught).
      await notifyAdminsOfError({ proposalId: ctx.proposalId, step: ctx.step, message });
    }

    return { ok: false, error: message };
  }
}
