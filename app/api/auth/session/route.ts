import { NextResponse } from "next/server";

import { assertSameOriginRequest, getSession } from "@/lib/auth";
import { getUserById, updateUserProfile } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error) {
  const status = error?.status ?? 500;
  return NextResponse.json(
    {
      error: error?.message ?? "Request failed."
    },
    { status }
  );
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: await getUserById(session.userId)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request) {
  try {
    assertSameOriginRequest(request);
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const user = await updateUserProfile(session.userId, body);
    return NextResponse.json({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
