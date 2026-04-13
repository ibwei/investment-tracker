import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getAssetHealth } from "@/lib/assets/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error: any) {
  return NextResponse.json(
    { error: error?.message ?? "Request failed." },
    { status: error?.status ?? 500 }
  );
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    return NextResponse.json(
      await getAssetHealth(session.userId, {
        limit: searchParams.get("limit"),
        sourceId: searchParams.get("sourceId"),
        status: searchParams.get("status"),
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
