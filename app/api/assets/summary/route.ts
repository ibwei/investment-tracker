import { timedRoute } from "@/lib/performance";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getAssetSummary } from "@/lib/assets/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error: any) {
  return NextResponse.json(
    {
      error: error?.message ?? "Request failed.",
    },
    { status: error?.status ?? 500 }
  );
}

export const GET = timedRoute(async function () {
  try {
    const session = await requireSession();
    return NextResponse.json(await getAssetSummary(session.userId));
  } catch (error) {
    return handleRouteError(error);
  }
});
