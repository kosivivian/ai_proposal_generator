import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/types/database";
import { attachMaterial } from "@/lib/processing/attachMaterial";
import { processMaterial } from "@/lib/processing/dispatch";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Computes a deterministic match key per proposal since the schema has no
 * dedicated column for this (build-plan finding #6): the slugified
 * client_name, de-duplicated with a numeric suffix in created_at order for
 * same-named clients (e.g. "acme-corp", "acme-corp-2").
 */
function computeMatchKeys(proposals: Pick<Tables<"proposals">, "id" | "client_name" | "created_at">[]) {
  const sorted = [...proposals].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const counts = new Map<string, number>();
  const keyToProposalId = new Map<string, string>();

  for (const p of sorted) {
    const base = slugify(p.client_name);
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    const key = count === 1 ? base : `${base}-${count}`;
    keyToProposalId.set(key, p.id);
  }

  return keyToProposalId;
}

function isJunkPath(path: string): boolean {
  return path.startsWith("__MACOSX/") || path.endsWith(".DS_Store");
}

export interface ZipMatchResult {
  matchedFolders: { folder: string; proposalId: string; fileCount: number }[];
  unmatchedFolders: { folder: string; fileCount: number }[];
}

/**
 * Unzips an uploaded archive and matches each top-level subfolder to a
 * proposal in the given batch, in order: (a) exact slugified client_name
 * match key, (b) the proposal's UUID or its first-8-char prefix (a
 * rep-friendly alternative to typing the exact client name). Matched files
 * are uploaded and dispatched for processing; unmatched folders are
 * reported back for the fallback per-row attach screen.
 */
export async function matchAndImportZip(
  supabase: SupabaseClient<Database>,
  batchId: string,
  userId: string,
  zipBytes: Uint8Array,
): Promise<ZipMatchResult> {
  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, client_name, created_at")
    .eq("batch_id", batchId);

  if (!proposals || proposals.length === 0) {
    throw new Error("No proposals found for this import batch");
  }

  const matchKeys = computeMatchKeys(proposals);
  const byId = new Map(proposals.map((p) => [p.id, p]));

  const zip = await JSZip.loadAsync(zipBytes);
  const folders = new Map<string, { path: string; entry: JSZip.JSZipObject }[]>();

  zip.forEach((relativePath, entry) => {
    if (entry.dir || isJunkPath(relativePath)) return;
    const segments = relativePath.split("/").filter(Boolean);
    if (segments.length < 2) return; // not inside a subfolder — nothing to match on
    const folder = segments[0];
    const existing = folders.get(folder) ?? [];
    existing.push({ path: relativePath, entry });
    folders.set(folder, existing);
  });

  const matchedFolders: ZipMatchResult["matchedFolders"] = [];
  const unmatchedFolders: ZipMatchResult["unmatchedFolders"] = [];

  for (const [folder, files] of folders) {
    const slug = slugify(folder);
    const proposalId =
      matchKeys.get(slug) ??
      (byId.has(folder) ? folder : undefined) ??
      proposals.find((p) => p.id.startsWith(folder.toLowerCase()))?.id;

    if (!proposalId) {
      unmatchedFolders.push({ folder, fileCount: files.length });
      continue;
    }

    for (const { path, entry } of files) {
      const bytes = await entry.async("uint8array");
      const fileName = path.split("/").pop()!;
      const material = await attachMaterial(supabase, {
        proposalId,
        userId,
        fileName,
        bytes,
        mimeType: null,
      });
      await processMaterial(supabase, material.id);
    }

    matchedFolders.push({ folder, proposalId, fileCount: files.length });
  }

  return { matchedFolders, unmatchedFolders };
}
