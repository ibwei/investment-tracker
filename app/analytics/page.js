"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";

import { IncomeOverview } from "@/components/analytics/income-overview";
import { Navbar } from "@/components/layout/navbar";
import { useI18n } from "@/lib/i18n";
import { useInvestmentStore } from "@/lib/store";

const EarningsChart = dynamic(
  () =>
    import("@/components/analytics/earnings-chart").then(
      (module) => module.EarningsChart
    ),
  { ssr: false }
);

const AprDistribution = dynamic(
  () =>
    import("@/components/analytics/apr-distribution").then(
      (module) => module.AprDistribution
    ),
  { ssr: false }
);

const ProjectBreakdown = dynamic(
  () =>
    import("@/components/analytics/project-breakdown").then(
      (module) => module.ProjectBreakdown
    ),
  { ssr: false }
);

const PortfolioIncomeVolatility = dynamic(
  () =>
    import("@/components/analytics/portfolio-income-volatility").then(
      (module) => module.PortfolioIncomeVolatility
    ),
  { ssr: false }
);

export default function AnalyticsPage() {
  const initialize = useInvestmentStore((state) => state.initialize);
  const { t } = useI18n();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("analytics.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("analytics.subtitle")}
          </p>
        </div>

        <section className="mb-8">
          <IncomeOverview />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="lg:col-span-2">
            <EarningsChart />
          </section>

          <section className="lg:col-span-2">
            <PortfolioIncomeVolatility />
          </section>

          <section>
            <AprDistribution />
          </section>

          <section>
            <ProjectBreakdown />
          </section>
        </div>
      </main>
    </div>
  );
}
