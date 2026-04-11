import { NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth";
import { registerUser } from "@/lib/users";

function handleRouteError(error) {
  const status = error?.status ?? 500;
  return NextResponse.json(
    {
      error: error?.message ?? "Registration failed."
    },
    { status }
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const user = await registerUser(body);
    await setSessionCookie(user);
    return NextResponse.json({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
