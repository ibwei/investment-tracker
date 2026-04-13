import { NextResponse } from "next/server";

import { sendRegistrationVerificationCode } from "@/lib/email-verification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error) {
  const status = error?.status ?? 500;
  return NextResponse.json(
    {
      error: error?.message ?? "Failed to send verification code."
    },
    { status }
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    return NextResponse.json(await sendRegistrationVerificationCode(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
