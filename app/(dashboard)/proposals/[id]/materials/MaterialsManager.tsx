"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MaterialStatusBadge } from "@/components/material-status-badge";
import type { MaterialType, ProposalState, Tables } from "@/lib/types/database";
import { advanceIfNoMaterials, updateMaterialType } from "./actions";

const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  intake_form: "Intake form",
  call_recording: "Call recording",
  old_proposal: "Old proposal (reference)",
  other: "Other",
};

interface Props {
  proposalId: string;
  initialState: ProposalState;
  initialMaterials: Tables<"proposal_materials">[];
}

export function MaterialsManager({ proposalId, initialState, initialMaterials }: Props) {
  const router = useRouter();
  // Rendered directly from server-provided props (no local mirror) — both
  // the realtime subscription and every mutation below re-fetch via
  // router.refresh() rather than hand-syncing client state from props.
  const materials = initialMaterials;
  const proposalState = initialState;
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`proposal-${proposalId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "proposal_materials", filter: `proposal_id=eq.${proposalId}` },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "proposals", filter: `id=eq.${proposalId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [proposalId, router]);

  const uploadFiles = useCallback(
    async (files: FileList) => {
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch(`/api/proposals/${proposalId}/materials`, { method: "POST", body: formData });
          const body = await res.json();
          if (!res.ok) {
            toast.error(`Failed to upload ${file.name}: ${body.error}`);
            continue;
          }
          fetch(`/api/proposals/${proposalId}/materials/${body.material.id}/process`, { method: "POST" }).catch(() => {});
        }
      } finally {
        setUploading(false);
        router.refresh();
      }
    },
    [proposalId, router],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const retry = async (materialId: string) => {
    const res = await fetch(`/api/proposals/${proposalId}/materials/${materialId}/retry`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json();
      toast.error(`Retry failed: ${body.error}`);
    }
    router.refresh();
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/generate`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(`Generation failed: ${body.error}`);
        router.refresh();
        return;
      }
      toast.success("Proposal generated");
      router.push(`/proposals/${proposalId}/review`);
    } finally {
      setGenerating(false);
    }
  };

  const continueWithoutFiles = () => {
    startTransition(async () => {
      const result = await advanceIfNoMaterials(proposalId);
      if (result.error) toast.error(result.error);
      else toast.success("Ready to generate");
      router.refresh();
    });
  };

  const outstanding = materials.filter((m) => m.status === "uploaded" || m.status === "processing").length;
  const failedCount = materials.filter((m) => m.status === "failed").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent
          className="pt-6"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <div
            className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-muted/40"
            onClick={() => fileInputRef.current?.click()}
          >
            <p className="text-sm text-muted-foreground">
              {uploading ? "Uploading..." : "Drag and drop files here, or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Intake forms, call recordings, old proposals, notes</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
          </div>
        </CardContent>
      </Card>

      {materials.length > 0 && (
        <div className="border rounded-lg divide-y">
          {materials.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3 gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{m.file_name}</div>
                {m.status === "failed" && (
                  <div className="text-xs text-destructive">Processing failed — see proposal detail for the error, or retry.</div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Select
                  defaultValue={m.material_type}
                  onValueChange={(value) => updateMaterialType(m.id, value as MaterialType).then(() => router.refresh())}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MATERIAL_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <MaterialStatusBadge status={m.status} />
                {m.status === "failed" && (
                  <Button size="sm" variant="outline" onClick={() => retry(m.id)}>
                    Retry
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        {proposalState === "materials_ready" && (
          <Button onClick={generate} disabled={generating}>
            {generating ? "Generating..." : "Generate proposal"}
          </Button>
        )}
        {proposalState === "draft" && materials.length === 0 && (
          <Button variant="outline" onClick={continueWithoutFiles} disabled={isPending}>
            Continue without files
          </Button>
        )}
        {proposalState === "draft" && materials.length > 0 && outstanding > 0 && (
          <p className="text-sm text-muted-foreground">
            Waiting on {outstanding} file(s) to finish processing before generation is available.
            {failedCount > 0 && ` ${failedCount} failed — retry or continue with the rest.`}
          </p>
        )}
        {proposalState === "generating" && <p className="text-sm text-muted-foreground">Generating draft…</p>}
        {(proposalState === "generated" || proposalState === "in_review") && (
          <Button variant="outline" onClick={() => router.push(`/proposals/${proposalId}/review`)}>
            Go to review
          </Button>
        )}
      </div>
    </div>
  );
}
