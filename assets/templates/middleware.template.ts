// src/middleware.ts — auth gate at the edge

import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip:
    //   _next/static, _next/image — Next.js internals
    //   favicon.ico — well-known asset
    //   api/webhooks — webhooks have no Supabase session, they auth via HMAC
    //   image extensions — public assets
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
