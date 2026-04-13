import { NextResponse } from "next/server";

import { getOAuthAuthorizationUrl, buildOAuthErrorRedirect } from "@/lib/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request, context) {
  const provider = String((await context.params)?.provider || "").toLowerCase();

  try {
    const url = await getOAuthAuthorizationUrl(request, provider);
    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.redirect(
      buildOAuthErrorRedirect(request, provider, error?.message || "OAuth sign in failed.")
    );
  }
}
