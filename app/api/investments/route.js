import { NextResponse } from "next/server";
import {
  clearAllInvestments,
  createInvestment,
  getDashboardSnapshot
} from "@/lib/investments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error) {
  const status = error?.status ?? 500;
  return NextResponse.json(
    {
      error: error?.message ?? "服务器处理失败。"
    },
    { status }
  );
}

export async function GET() {
  try {
    return NextResponse.json(await getDashboardSnapshot());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const record = await createInvestment(body);
    return NextResponse.json({
      record,
      snapshot: await getDashboardSnapshot()
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  try {
    return NextResponse.json({
      snapshot: await clearAllInvestments()
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
