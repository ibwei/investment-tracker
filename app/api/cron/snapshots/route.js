import { NextResponse } from "next/server";
import {
  captureSnapshotsForRemoteUsers,
  writeScheduledJobLog
} from "@/lib/snapshot-history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    {
      error: "Unauthorized."
    },
    { status: 401 }
  );
}

function getBearerToken(request) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : "";
}

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const bearerToken = getBearerToken(request);
  const headerToken = request.headers.get("x-cron-secret") ?? "";
  return bearerToken === secret || headerToken === secret;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return unauthorized();
  }

  const startedAt = new Date();
  const runDate = startedAt.toISOString().slice(0, 10);

  try {
    const result = await captureSnapshotsForRemoteUsers(startedAt);
    const finishedAt = new Date();

    await writeScheduledJobLog({
      jobName: "portfolio-snapshot-capture",
      runDate,
      status: "SUCCESS",
      processedCount: result.processedInvestments,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString()
    });

    return NextResponse.json(result);
  } catch (error) {
    const finishedAt = new Date();

    await writeScheduledJobLog({
      jobName: "portfolio-snapshot-capture",
      runDate,
      status: "FAILED",
      processedCount: 0,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      errorMessage: error?.message ?? "Snapshot capture failed.",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString()
    });

    return NextResponse.json(
      {
        error: error?.message ?? "服务器处理失败。"
      },
      { status: error?.status ?? 500 }
    );
  }
}
