import OpenAI from "openai";

export interface TranscriptionResult {
  text: string;
  durationSeconds: number;
  modelUsed: string;
}

const WHISPER_MODEL = "whisper-1";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

/**
 * Transcribe an audio file via OpenAI Whisper.
 *
 * @param audioBuffer Raw audio bytes (mp3/wav/m4a/mp4/webm/ogg)
 * @param filename A filename hint so Whisper detects the format
 * @returns The transcript text + estimated duration
 */
export async function transcribeAudio(
  audioBuffer: Buffer | Blob,
  filename: string,
): Promise<TranscriptionResult> {
  const client = getClient();

  // Whisper accepts up to 25MB. Higher than that needs chunking.
  const sizeBytes =
    audioBuffer instanceof Blob ? audioBuffer.size : audioBuffer.length;
  if (sizeBytes > 25 * 1024 * 1024) {
    throw new Error(
      "קובץ האודיו גדול מ־25MB. אנא דחסו או חתכו את הקובץ.",
    );
  }

  // OpenAI SDK accepts File-like objects. Convert Buffer → Uint8Array → Blob.
  // (Modern TS doesn't accept Buffer directly as a BlobPart.)
  const blob =
    audioBuffer instanceof Blob
      ? audioBuffer
      : new Blob([new Uint8Array(audioBuffer)]);
  const file = new File([blob], filename, {
    type: detectMimeType(filename),
  });

  const response = await client.audio.transcriptions.create({
    file,
    model: WHISPER_MODEL,
    language: "he", // Force Hebrew — better accuracy than auto-detect
    response_format: "verbose_json",
  });

  return {
    text: response.text,
    durationSeconds: Math.round(response.duration ?? 0),
    modelUsed: WHISPER_MODEL,
  };
}

function detectMimeType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/m4a",
    // Whisper accepts MP4/WebM video — it extracts the audio track automatically.
    mp4: "video/mp4",
    mpeg: "video/mpeg",
    mpga: "audio/mpeg",
    webm: "video/webm",
    ogg: "audio/ogg",
    flac: "audio/flac",
  };
  return map[ext] ?? "audio/mpeg";
}
