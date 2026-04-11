"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { InvestmentFilters } from "@/components/dashboard/investment-filters";
import { InvestmentForm } from "@/components/dashboard/investment-form";
import { InvestmentTable } from "@/components/dashboard/investment-table";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useInvestmentStore } from "@/lib/store";

export default function DashboardPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState(null);
  const initialize = useInvestmentStore((state) => state.initialize);
  const isPreviewMode = useInvestmentStore((state) => state.isPreviewMode);
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    void initialize({ preview: !isAuthenticated });
  }, [initialize, isAuthenticated]);

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

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            disabled={!isAuthenticated}
          >
            <Plus className="h-4 w-4" />
            {t("common.addInvestment")}
          </Button>
        </div>

        {isPreviewMode ? (
          <Card className="mb-8 border-primary/20 bg-primary/5">
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

        <section className="mb-8">
          <StatsCards />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{t("dashboard.portfolio")}</h2>
          </div>

          <InvestmentFilters />
          <InvestmentTable onEdit={handleEdit} isReadOnly={!isAuthenticated} />
        </section>
      </main>

      <InvestmentForm
        open={formOpen}
        onOpenChange={handleFormClose}
        investment={editingInvestment}
      />
    </div>
  );
}
