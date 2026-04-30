import { NextResponse } from "next/server";

import { assertSameOriginRequest, clearSessionCookie } from "@/lib/auth";

export async function POST(request) {
  assertSameOriginRequest(request);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
