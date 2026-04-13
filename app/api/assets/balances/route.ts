import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listAssetBalances } from "@/lib/assets/service";

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
    return NextResponse.json({
      balances: await listAssetBalances(session.userId, {
        limit: searchParams.get("limit"),
        offset: searchParams.get("offset"),
        sourceId: searchParams.get("sourceId"),
        sourceType: searchParams.get("sourceType"),
        category: searchParams.get("category"),
        q: searchParams.get("q"),
        sort: searchParams.get("sort"),
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
