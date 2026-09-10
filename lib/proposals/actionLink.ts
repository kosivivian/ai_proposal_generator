import type { ProposalState, UserRole } from "@/lib/types/database";

/** Where the dashboard's contextual action button for a proposal should go. */
export function proposalActionLink(id: string, state: ProposalState, role: UserRole): { href: string; label: string } {
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
      return role === "approver" || role === "admin"
        ? { href: `/approvals/${id}`, label: "Review & decide" }
        : { href: `/proposals/${id}`, label: "View" };
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
