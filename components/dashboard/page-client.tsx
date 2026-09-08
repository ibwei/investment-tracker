"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import dynamic from "next/dynamic";
import { InvestmentDataStatus } from "@/components/dashboard/data-status";
import { LoadingPanel } from "@/components/ui/operation-status";
import Link from "next/link";
import { Plus } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { InvestmentFilters } from "@/components/dashboard/investment-filters";
const InvestmentForm = dynamic(() => import("@/components/dashboard/investment-form").then(module => module.InvestmentForm));
import { InvestmentTable } from "@/components/dashboard/investment-table";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useInvestmentStore } from "@/lib/store";

export default function DashboardPage({ initialSnapshot = null, snapshotUserId = null, startedAt = 0 }: { initialSnapshot?: any; snapshotUserId?: number | null; startedAt?: number }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState(null);
  const loadError = useInvestmentStore(state => state.errorMessage);
  const hasInitialized = useInvestmentStore(state => state.hasInitialized);
  const scope = useInvestmentStore(state => state.scope);
  const initialize = useInvestmentStore((state) => state.initialize);
  const isPreviewMode = useInvestmentStore((state) => state.isPreviewMode);
  const { isAuthenticated, user } = useAuth();
  const { t } = useI18n();

  useLayoutEffect(() => {
    if (initialSnapshot && snapshotUserId === user?.id) useInvestmentStore.getState().hydrate(`user:${user.id}`, initialSnapshot, startedAt);
  }, [initialSnapshot, snapshotUserId, startedAt, user?.id]);

  useEffect(() => {
    void initialize({ preview: !isAuthenticated, userId: user?.id });
  }, [initialize, isAuthenticated, user?.id]);

  const handleEdit = (investment) => {
    if (!isAuthenticated) {
      return;
    }
    setEditingInvestment(investment);
    setFormOpen(true);
  };

  const handleFormClose = (open) => {
    setFormOpen(open);
    if (!open) {
      setEditingInvestment(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("dashboard.title")}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t("dashboard.subtitle")}
            </p>
          </div>
          <Button
            onClick={() => setFormOpen(true)}
            className="gap-2"
            disabled={!isAuthenticated || !hasInitialized}
          >
            <Plus className="h-4 w-4" />
            {t("common.addInvestment")}
          </Button>
        </div>

        {isPreviewMode ? (
          <Card className="mb-6 gap-0 py-0 border-primary/20 bg-primary/5 sm:mb-8">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {t("preview.dashboardTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("preview.dashboardDescription")}
                </p>
              </div>
              <div className="flex gap-3">
                <Button asChild size="sm">
                  <Link href="/register">{t("nav.getStarted")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">{t("nav.login")}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <InvestmentDataStatus />
        {!hasInitialized || scope !== (user?.id ? `user:${user.id}` : 'guest') ? (loadError ? null : <LoadingPanel />) : <>
        <section className="mb-6 sm:mb-8">
          <StatsCards />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{t("dashboard.portfolio")}</h2>
          </div>

          <InvestmentFilters />
          <InvestmentTable onEdit={handleEdit} isReadOnly={!isAuthenticated} />
        </section>
        </>}
      </main>

      {formOpen && <InvestmentForm
        open={formOpen}
        onOpenChange={handleFormClose}
        investment={editingInvestment}
      />}
    </div>
  );
}
