import { NextResponse } from "next/server";

import { getOAuthProviderAvailability } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getOAuthProviderAvailability());
}
