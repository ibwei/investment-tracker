import { NextResponse } from "next/server";

import { assertSameOriginRequest, setSessionCookie } from "@/lib/auth";
import { loginUser } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error) {
  const status = error?.status ?? 500;
  return NextResponse.json(
    {
      error: error?.message ?? "Login failed."
    },
    { status }
  );
}

export async function POST(request) {
  try {
    assertSameOriginRequest(request);
    const body = await request.json();
    const user = await loginUser(body);
    await setSessionCookie(user);
    return NextResponse.json({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
