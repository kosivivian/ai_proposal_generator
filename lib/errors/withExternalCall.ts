import { createServiceRoleClient } from "@/lib/supabase/service";
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

/**
 * The one helper every external call routes through (file processing,
 * transcription, Claude generation/regeneration, document export, email
 * send). On failure: writes an error_log row via the service-role client
 * (no client insert policy exists on error_log) and optionally flips the
 * proposal to a visibly-failed state — never leaves it silently stuck.
 */
export async function withExternalCall<T>(
  ctx: WithExternalCallContext,
  fn: () => Promise<T>,
): Promise<ExternalCallResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const service = createServiceRoleClient();

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

    return { ok: false, error: message };
  }
}
