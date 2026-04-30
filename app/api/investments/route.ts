import { NextResponse } from "next/server";
import { requireSameOriginSession, requireSession } from "@/lib/auth";
import {
  clearAllInvestments,
  createInvestment,
  getDashboardSnapshot
} from "@/lib/investments";
import { buildDashboardSnapshot } from "@/lib/snapshot";
import { getUserTimeZone } from "@/lib/users";

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

async function includeCreatedRecordInSnapshot(userId, snapshot, record) {
  if (snapshot.records.some((item) => String(item.id) === String(record.id))) {
    return snapshot;
  }

  const timeZone = await getUserTimeZone(userId);
  const records = [
    record,
    ...snapshot.records.filter((item) => String(item.id) !== String(record.id))
  ];

  return buildDashboardSnapshot(records, new Date(), timeZone);
}

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json(await getDashboardSnapshot(session.userId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request) {
  try {
    const session = await requireSameOriginSession(request);
    const body = await request.json();
    const record = await createInvestment(session.userId, body);
    const snapshot = await includeCreatedRecordInSnapshot(
      session.userId,
      await getDashboardSnapshot(session.userId),
      record
    );

    return NextResponse.json({
      record,
      snapshot
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request) {
  try {
    const session = await requireSameOriginSession(request);
    return NextResponse.json({
      snapshot: await clearAllInvestments(session.userId)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
