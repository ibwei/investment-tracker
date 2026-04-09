"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { InvestmentFilters } from "@/components/dashboard/investment-filters";
import { InvestmentForm } from "@/components/dashboard/investment-form";
import { InvestmentTable } from "@/components/dashboard/investment-table";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useInvestmentStore } from "@/lib/store";

export default function DashboardPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState(null);
  const initialize = useInvestmentStore((state) => state.initialize);
  const { t } = useI18n();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const handleEdit = (investment) => {
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
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("common.addInvestment")}
          </Button>
        </div>

        <section className="mb-8">
          <StatsCards />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{t("dashboard.portfolio")}</h2>
          </div>

          <InvestmentFilters />
          <InvestmentTable onEdit={handleEdit} />
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
