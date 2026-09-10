import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Extracts plain text from a text-bearing file (intake forms, old proposals,
 * notes). Branches on mime type; throws a clear, readable message for
 * unsupported types rather than letting an SDK-internal error surface.
 */
export async function extractText(
  bytes: Uint8Array,
  mimeType: string | null,
  fileName: string,
): Promise<string> {
  const mime = mimeType ?? guessMimeFromName(fileName);

  if (mime === "application/pdf") {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return text.trim();
  }

  if (mime === DOCX_MIME) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value.trim();
  }

  if (mime === "text/plain" || mime === "text/markdown" || mime === "text/csv") {
    return Buffer.from(bytes).toString("utf-8").trim();
  }

  throw new Error(`Unsupported file type for extraction: ${mime} (${fileName})`);
}

function guessMimeFromName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return DOCX_MIME;
    case "md":
      return "text/markdown";
    case "csv":
      return "text/csv";
    default:
      return "text/plain";
  }
}
