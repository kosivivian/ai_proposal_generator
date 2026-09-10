import OpenAI from "openai";
import { toFile } from "openai/uploads";

const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // OpenAI's hard cap for the Whisper endpoint

let client: OpenAI | null = null;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/**
 * Transcribes a call/discovery recording via the Whisper API. Pre-checks
 * the size cap and throws a clear message before calling out, rather than
 * letting an opaque 413 surface as the error_log message.
 */
export async function transcribeAudio(
  bytes: Uint8Array,
  mimeType: string | null,
  fileName: string,
): Promise<string> {
  if (bytes.byteLength > WHISPER_MAX_BYTES) {
    throw new Error(
      `Recording "${fileName}" is ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB, ` +
        `which exceeds Whisper's 25MB limit — split or compress the file before uploading.`,
    );
  }

  const file = await toFile(bytes, fileName, { type: mimeType ?? "audio/mpeg" });
  const transcription = await getClient().audio.transcriptions.create({
    file,
    model: "whisper-1",
  });

  return transcription.text.trim();
}
