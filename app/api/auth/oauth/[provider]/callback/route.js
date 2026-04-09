import { NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth";
import {
  buildOAuthErrorRedirect,
  getOAuthProfile,
  verifyOAuthState
} from "@/lib/oauth";
import { findOrCreateOAuthUser } from "@/lib/users";

export async function GET(request, context) {
  const provider = String(context.params?.provider || "").toLowerCase();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  try {
    await verifyOAuthState(provider, state);
    const profile = await getOAuthProfile(request, provider, code);
    const user = await findOrCreateOAuthUser(profile);
    await setSessionCookie(user);
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    return NextResponse.redirect(
      buildOAuthErrorRedirect(request, provider, error?.message || "OAuth sign in failed.")
    );
  }
}
