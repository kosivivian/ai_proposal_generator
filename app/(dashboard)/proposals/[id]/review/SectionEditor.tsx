"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GAP_MARKER_PREFIX, SECTION_LABELS, type SectionKey } from "@/lib/generation/sections";
import type { Tables } from "@/lib/types/database";
import { updateSectionContent } from "./actions";

function highlightGaps(content: string) {
  const parts = content.split(new RegExp(`(${GAP_MARKER_PREFIX.replace(/[[\]]/g, "\\$&")}[^\\]]*\\])`, "g"));
  return parts.map((part, i) =>
    part.startsWith(GAP_MARKER_PREFIX) ? (
      <mark key={i} className="bg-amber-200 dark:bg-amber-900 dark:text-amber-100 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function SectionEditor({
  proposalId,
  section,
}: {
  proposalId: string;
  section: Tables<"proposal_sections">;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const save = async () => {
    setSaving(true);
    const result = await updateSectionContent(proposalId, section.id, draft);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/sections/${section.section_key}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(`Regeneration failed: ${body.error}`);
        return;
      }
      toast.success(`Regenerated "${SECTION_LABELS[section.section_key as SectionKey]}"`);
      setShowNote(false);
      setNote("");
      router.refresh();
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Card className={section.has_gap_marker ? "border-amber-400" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {SECTION_LABELS[section.section_key as SectionKey] ?? section.section_key}
          <span className="text-xs font-normal text-muted-foreground ml-2">v{section.version}</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowNote((v) => !v)} disabled={regenerating}>
            {regenerating ? "Regenerating..." : "Regenerate"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showNote && (
          <div className="flex gap-2">
            <Input
              placeholder="Optional note for the regeneration (e.g. 'make this more concise')"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button size="sm" onClick={regenerate} disabled={regenerating}>
              Go
            </Button>
          </div>
        )}
        {editing ? (
          <div className="space-y-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(section.content);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{highlightGaps(section.content)}</div>
        )}
      </CardContent>
    </Card>
  );
}
