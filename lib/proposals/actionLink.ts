import type { ProposalState, UserRole } from "@/lib/types/database";

/** Where the dashboard's contextual action button for a proposal should go. */
export function proposalActionLink(id: string, state: ProposalState, role: UserRole): { href: string; label: string } {
  // Admin is view-only for proposals — no create/edit/approve/send actions
  // anywhere, just the audit trail (history, errors, delivery status).
  if (role === "admin") return { href: `/proposals/${id}`, label: "View" };

  // Approver's only action anywhere is approve/reject on a pending_approval
  // proposal — every other state is view-only for them too, otherwise they'd
  // land on the rep-only Generate/Review/Send-to-client screens (whose
  // actions are already blocked server-side, but shouldn't be offered at all).
  if (role === "approver") {
    return state === "pending_approval"
      ? { href: `/approvals/${id}`, label: "Review & decide" }
      : { href: `/proposals/${id}`, label: "View" };
  }

  switch (state) {
    case "draft":
    case "materials_ready":
      return { href: `/proposals/${id}/materials`, label: state === "draft" ? "Attach materials" : "Generate" };
    case "generating":
      return { href: `/proposals/${id}`, label: "View" };
    case "generated":
    case "in_review":
      return { href: `/proposals/${id}/review`, label: "Review" };
    case "pending_approval":
      // role is always sales_rep here — admin/approver are handled above.
      return { href: `/proposals/${id}`, label: "View" };
    case "approved":
      return { href: `/proposals/${id}`, label: "Send to client" };
    case "rejected":
      return { href: `/proposals/${id}/review`, label: "Address feedback" };
    case "sent":
    case "logged":
      return { href: `/proposals/${id}`, label: "View" };
    case "failed":
      return { href: `/proposals/${id}`, label: "View error" };
    default:
      return { href: `/proposals/${id}`, label: "View" };
  }
}
