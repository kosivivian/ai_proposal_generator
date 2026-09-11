import type { Tables } from "@/lib/types/database";

type EventRow = Tables<"proposal_events">;
type DeliveryRow = Tables<"delivery_log">;
type ErrorRow = Tables<"error_log">;

function truncate(text: string, max = 140): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * One human-readable sentence per state transition. Relies on
 * proposal_events.actor_id actually being populated (log_state_transition()
 * was fixed to set it via auth.uid() — see proposal_app_schema.sql) and on
 * rejection notes being copied onto that specific event row, not just read
 * off the (overwritable) proposals.rejection_notes column.
 */
export function describeTransition(event: EventRow, actorName: string | null): string {
  const who = actorName ?? "System";

  if (!event.from_state) return `${who} created this proposal`;

  switch (event.to_state) {
    case "materials_ready":
      return "All attached materials finished processing";
    case "generating":
      return `${who} started generating the draft`;
    case "generated":
      return "Draft generated";
    case "in_review":
      return event.note
        ? `${who} sent this back for revision: "${truncate(event.note)}"`
        : `${who} started reviewing the draft`;
    case "pending_approval":
      return `${who} submitted this for approval`;
    case "approved":
      return `${who} approved this proposal`;
    case "sent":
      return `${who} sent this to the client`;
    case "logged":
      return "Delivery confirmed";
    case "failed":
      return `${who === "System" ? "A step" : who} failed at ${event.from_state ?? "an earlier step"}`;
    default:
      return `${event.from_state} → ${event.to_state}`;
  }
}

export function describeDelivery(delivery: DeliveryRow): string {
  switch (delivery.status) {
    case "pending":
      return `Email queued to ${delivery.recipient_email}`;
    case "sent":
      return `Email sent to ${delivery.recipient_email}`;
    case "failed":
      return `Email delivery to ${delivery.recipient_email} failed`;
    case "bounced":
      return `Email to ${delivery.recipient_email} bounced`;
  }
}

export function describeError(error: ErrorRow): string {
  return `${error.step.replace(/_/g, " ")} failed: ${error.message}`;
}
