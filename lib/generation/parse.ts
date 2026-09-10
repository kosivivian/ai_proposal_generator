import { SECTION_KEYS, GAP_MARKER_PREFIX, type SectionKey } from "@/lib/generation/sections";

export interface ParsedSections {
  sections: Partial<Record<SectionKey, string>>;
  matchedCount: number;
}

/**
 * Parses Claude's XML-tagged response into per-section content. Tolerant of
 * malformed output:
 *  - truncated response (unclosed tag, e.g. hit max_tokens mid-section) ->
 *    that key's regex simply fails to match, treated as missing
 *  - extra prose outside tags -> ignored (regex only reads inside tag pairs)
 *  - empty tags (<pricing></pricing>) -> falls through the truthiness check,
 *    treated as missing
 *  - total format deviation (0 tags found) -> caller should treat as a hard
 *    failure, not a per-section gap (see matchedCount === 0)
 */
export function parseClaudeSections(raw: string): ParsedSections {
  const sections: Partial<Record<SectionKey, string>> = {};
  let matchedCount = 0;

  for (const key of SECTION_KEYS) {
    const re = new RegExp(`<${key}\\b[^>]*>([\\s\\S]*?)<\\/${key}>`, "i");
    const match = raw.match(re);
    const content = match?.[1]?.trim();
    if (content) {
      sections[key] = content;
      matchedCount++;
    }
  }

  return { sections, matchedCount };
}

/** Synthesizes a gap marker for a section Claude failed to produce. */
export function missingSectionContent(key: SectionKey): string {
  return `${GAP_MARKER_PREFIX} section could not be generated — Claude's response was missing or malformed for "${key}"]`;
}
