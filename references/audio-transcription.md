# Audio transcription — Supabase Storage + OpenAI Whisper

This is the "drag a recording → get a transcript and an AI analysis 60 seconds later" flow from Leadero Session 4. It chains four pieces:

1. **Browser** uploads the file directly to Supabase Storage (no server bandwidth)
2. **API route** downloads from Storage with the service-role client, sends to Whisper, saves the transcript on the related `Call` row
3. **API route** auto-triggers Claude analysis on the fresh transcript
4. **Browser** sees a single 3-step progress UI: uploading → transcribing → analyzing → done

Read this when adding audio/video upload + transcription to any Hebrew app.

---

## Storage bucket setup

In Supabase Dashboard → Storage → New bucket:
- Name: `call-audio` (or whatever your domain is)
- **Private** (NOT public — the bucket should only be readable via signed URLs)
- File size limit: 25 MB (Whisper's hard limit)

Then apply per-user folder RLS so users can only read/write `{userId}/...`:

```sql
-- Storage policies (Storage → Policies → New policy on the bucket)
CREATE POLICY "users_can_upload_to_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'call-audio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "users_can_read_own_files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'call-audio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "users_can_delete_own_files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'call-audio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

`storage.foldername(name)[1]` returns the first path segment, so a file at `{userId}/{callId}-{ts}.mp3` matches `auth.uid()`.

## Browser upload

Use the browser Supabase client (which authenticates as the user, so RLS applies) to upload directly. Don't go through your Next.js API route for the upload — you'd waste serverless bandwidth and hit the 4.5 MB request body limit.

```tsx
"use client";
const supabase = createSupabaseBrowserClient();
const { data: { user } } = await supabase.auth.getUser();

const path = `${user.id}/${callId}-${Date.now()}.${ext}`;
const { error } = await supabase.storage
  .from("call-audio")
  .upload(path, file, {
    contentType: file.type || "audio/mpeg",
    upsert: false,
  });
```

## Accepted file types

Whisper supports MP3, WAV, M4A, FLAC, OGG **and video containers** (MP4, WebM, MPEG) — it extracts the audio track. The file picker's `accept` should include video MIME types:

```ts
const ACCEPTED_EXTS = ["mp3", "wav", "m4a", "mp4", "mpeg", "mpga", "webm", "ogg", "flac"];
const ACCEPT_ATTR = [
  "audio/*", "video/mp4", "video/webm",
  ".mp3", ".wav", ".m4a", ".mp4", ".mpeg", ".mpga", ".webm", ".ogg", ".flac",
].join(",");
```

**Common mistake:** using only `audio/*` — Chrome's file picker then hides MP4 files even though Whisper would happily accept them.

## Whisper integration

Server-side (with service-role client so we can read any user's file in the bucket):

```ts
// src/lib/ai/transcribe-audio.ts
import OpenAI from "openai";

const WHISPER_MODEL = "whisper-1";

export async function transcribeAudio(
  audioBuffer: Buffer | Blob,
  filename: string,
): Promise<{ text: string; durationSeconds: number; modelUsed: string }> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  if (audioBuffer instanceof Blob ? audioBuffer.size : audioBuffer.length > 25 * 1024 * 1024) {
    throw new Error("קובץ האודיו גדול מ־25MB. אנא דחסו או חתכו את הקובץ.");
  }

  // Modern TS doesn't accept Buffer directly as BlobPart. Convert through Uint8Array.
  const blob = audioBuffer instanceof Blob
    ? audioBuffer
    : new Blob([new Uint8Array(audioBuffer)]);
  const file = new File([blob], filename, { type: detectMimeType(filename) });

  const response = await client.audio.transcriptions.create({
    file,
    model: WHISPER_MODEL,
    language: "he", // force Hebrew — better accuracy than auto-detect
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
  return {
    mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/m4a",
    mp4: "video/mp4", mpeg: "video/mpeg", mpga: "audio/mpeg",
    webm: "video/webm", ogg: "audio/ogg", flac: "audio/flac",
  }[ext] ?? "audio/mpeg";
}
```

**Gotcha — TypeScript Buffer → Blob.** `new Blob([buffer])` errors with `Type 'Buffer<ArrayBufferLike>' is not assignable to type 'BlobPart'`. Wrap in `new Uint8Array(buffer)` first.

## The API route

```ts
// src/app/api/calls/[id]/transcribe/route.ts
export const runtime = "nodejs";
export const maxDuration = 60; // Vercel — Whisper can take ~30s for a long file

export async function POST(req: Request, { params }) {
  const { id } = await params;
  const user = await requireUser();
  const { storagePath } = await req.json();

  // Verify the call belongs to this user
  const call = await prisma.call.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true, leadId: true },
  });
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify the storage path is under the user's folder (defense in depth)
  if (!storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Download with service-role client (bypasses RLS — we already verified ownership)
  const admin = createSupabaseAdminClient();
  const { data: blob, error } = await admin.storage
    .from("call-audio")
    .download(storagePath);
  if (error || !blob) {
    return NextResponse.json({ error: error?.message ?? "Download failed" }, { status: 500 });
  }

  // Whisper expects a File, the blob already is one for our purposes
  const arrayBuffer = await blob.arrayBuffer();
  const filename = storagePath.split("/").pop() ?? "audio.mp3";
  const result = await transcribeAudio(Buffer.from(arrayBuffer), filename);

  await prisma.call.update({
    where: { id: call.id },
    data: {
      transcript: result.text,
      audioUrl: storagePath, // store the path, generate signed URLs on demand
      durationSeconds: result.durationSeconds,
    },
  });

  revalidatePath(`/leads/${call.leadId}`);
  return NextResponse.json({ ok: true, text: result.text });
}
```

## Auto-trigger AI analysis

After transcription succeeds, the browser immediately POSTs to `/api/calls/[id]/analyze`:

```tsx
setStage("transcribing");
const tRes = await fetch(`/api/calls/${callId}/transcribe`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ storagePath: path }),
});
if (!tRes.ok) throw new Error(...);

setStage("analyzing");
const aRes = await fetch(`/api/calls/${callId}/analyze`, { method: "POST" });
if (aRes.ok) {
  toast({ title: "הקובץ עלה, תומלל ונותח בהצלחה ✨", variant: "success" });
} else {
  // Soft-fail: transcript was saved, just the analysis failed.
  // User can retry analysis manually.
  toast({ title: "התמלול נשמר", description: "ניתוח ה־AI נכשל — לחצו 'הרץ ניתוח AI' ידנית." });
}
router.refresh();
```

**Key design choice:** if analysis fails, don't roll back the transcript. The transcript is valuable on its own and re-running analysis is cheap. Soft-fail with a clear message.

## Progress UI

The "drag here" zone has 4 states: `idle`, `uploading`, `transcribing`, `analyzing`. Each state shows a different icon (cloud / loader / mic / sparkles) and a 3-dot progress indicator.

Don't show timer estimates ("~1 minute remaining") — they're inaccurate and stress users. Just describe the current step in friendly Hebrew: "מעלה...", "מתמלל...", "מנתח שיחה עם AI...".

---

## What to change per project

- **Bucket name** — `call-audio` → whatever fits your domain
- **Storage path scheme** — `{userId}/{callId}-{ts}.{ext}` is fine for calls. For other entities (interviews, podcasts, lessons), use `{userId}/{entityId}-{ts}.{ext}` with the same per-user-folder RLS pattern.
- **Transcript field on the parent entity** — `call.transcript` → wherever the transcript belongs in your schema.
- **Whisper language** — `he` for Hebrew, or remove `language` to let Whisper auto-detect.

## What to keep verbatim

- 25 MB hard limit (Whisper's, not ours)
- Browser-direct-to-Storage upload pattern (don't proxy through Next.js)
- Per-user folder RLS on the bucket
- `Buffer → Uint8Array → Blob → File` conversion
- Soft-fail on analysis (save transcript even if analysis errors)
- Auto-trigger analysis after transcription (the UX win is huge)
- `maxDuration = 60` on the API route (Whisper can take ~30s for a 10-minute file)
