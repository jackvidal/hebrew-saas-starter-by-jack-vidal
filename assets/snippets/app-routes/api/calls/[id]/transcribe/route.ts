import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { transcribeAudio } from "@/lib/ai/transcribe-audio";

export const runtime = "nodejs";
export const maxDuration = 60; // Whisper can take time for longer audio

const bodySchema = z.object({
  storagePath: z
    .string()
    .min(1, "Missing storagePath")
    .max(500)
    // safety: limit to the bucket we use, no escapes
    .refine((v) => !v.includes(".."), "Invalid path"),
});

// Use the service-role client so the server can read private bucket objects
// regardless of RLS. This is server-only — never exposed to the browser.
function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase env vars missing");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const call = await prisma.call.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Defensive: the storage path MUST be inside the user's own folder.
  // Client uploads to: call-audio/{userId}/{filename}
  if (!parsed.data.storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json(
      { error: "Path does not belong to user" },
      { status: 403 },
    );
  }

  try {
    // 1. Pull the audio from Supabase Storage
    const storage = getStorageClient();
    const { data: audioBlob, error: downloadError } = await storage.storage
      .from("call-audio")
      .download(parsed.data.storagePath);

    if (downloadError || !audioBlob) {
      console.error("Storage download failed:", downloadError);
      return NextResponse.json(
        { error: "שגיאה בטעינת קובץ האודיו" },
        { status: 500 },
      );
    }

    // 2. Send to Whisper
    const filename = parsed.data.storagePath.split("/").pop() ?? "audio.mp3";
    const result = await transcribeAudio(audioBlob, filename);

    // 3. Save the transcript + audio reference on the call
    const updated = await prisma.call.update({
      where: { id: call.id },
      data: {
        transcript: result.text,
        audioUrl: parsed.data.storagePath,
        // If the user hadn't entered duration, fill it from Whisper
        durationSeconds: call.durationSeconds ?? result.durationSeconds,
      },
    });

    revalidatePath(`/leads/${call.leadId}`);
    return NextResponse.json({
      call: updated,
      transcriptLength: result.text.length,
      durationSeconds: result.durationSeconds,
    });
  } catch (err) {
    console.error("Transcription failed", err);
    const raw = err instanceof Error ? err.message : "שגיאה לא ידועה";
    const sanitized =
      raw.length > 250 || /\b(invocation|prisma|stack|TypeError)\b/i.test(raw)
        ? "התמלול נכשל. אנא נסו שוב."
        : raw;
    return NextResponse.json({ error: sanitized }, { status: 500 });
  }
}
