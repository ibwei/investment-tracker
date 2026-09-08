import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/investments";
import DashboardPage from "@/components/dashboard/page-client";
import { Navbar } from "@/components/layout/navbar";
import { LoadingPanel } from "@/components/ui/operation-status";

async function DashboardData() {
  const startedAt = Date.now();
  const session = await getSession();
  if (!session) return <DashboardPage />;
  const snapshot = await getDashboardSnapshot(session.userId, { compact: true }).catch(() => null);
  return <DashboardPage initialSnapshot={snapshot} snapshotUserId={session.userId} startedAt={startedAt} />;
}

export default function Page() {
  return <Suspense fallback={<><Navbar /><main className="mx-auto max-w-7xl px-4 py-6 sm:px-6"><LoadingPanel /></main></>}><DashboardData /></Suspense>;
}
