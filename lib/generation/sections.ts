export const SECTION_KEYS = [
  "introduction",
  "executive_summary",
  "client_needs_summary",
  "recommended_approach",
  "scope",
  "deliverables",
  "pricing",
  "timeline",
  "next_steps",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  introduction: "Introduction",
  executive_summary: "Executive Summary",
  client_needs_summary: "Understanding Your Needs",
  recommended_approach: "Recommended Approach",
  scope: "Project Scope",
  deliverables: "Deliverables",
  pricing: "Pricing",
  timeline: "Timeline",
  next_steps: "Next Steps",
};

export const GAP_MARKER_PREFIX = "[NEEDS INPUT:";

export function hasGapMarker(content: string): boolean {
  return content.includes(GAP_MARKER_PREFIX);
}

export function orderIndexFor(key: SectionKey): number {
  return SECTION_KEYS.indexOf(key);
}
