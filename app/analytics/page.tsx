"use client";

import { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

import { useAuth } from "@/components/auth-provider";
import { IncomeOverview } from "@/components/analytics/income-overview";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const RealSnapshotTrend = dynamic(
  () =>
    import("@/components/analytics/real-snapshot-trend").then(
      (module) => module.RealSnapshotTrend
    ),
  { ssr: false }
);

export default function AnalyticsPage() {
  const initialize = useInvestmentStore((state) => state.initialize);
  const isPreviewMode = useInvestmentStore((state) => state.isPreviewMode);
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    void initialize({ preview: !isAuthenticated });
  }, [initialize, isAuthenticated]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("analytics.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("analytics.subtitle")}
          </p>
        </div>

        {isPreviewMode ? (
          <Card className="mb-6 gap-0 py-0 border-primary/20 bg-primary/5 sm:mb-8">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {t("preview.analyticsTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("preview.analyticsDescription")}
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

        <section className="mb-6 sm:mb-8">
          <IncomeOverview />
        </section>

        <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
          <section className="lg:col-span-2">
            <RealSnapshotTrend />
          </section>

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
