"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Database,
  Download,
  Save,
  Shield,
  Trash2,
  User
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { DISPLAY_CURRENCIES, useI18n } from "@/lib/i18n";
import { DEFAULT_APP_TIMEZONE, TIMEZONE_OPTIONS } from "@/lib/time";
import { useInvestmentStore } from "@/lib/store";

const CURRENCY_LABELS = {
  USD: "USD ($)",
  CNY: "CNY (¥)",
  EUR: "EUR (€)",
  GBP: "GBP (£)",
  JPY: "JPY (¥)",
  HKD: "HKD (HK$)",
  SGD: "SGD (S$)",
  AUD: "AUD (A$)",
  CAD: "CAD (C$)",
  CHF: "CHF",
  KRW: "KRW (₩)",
  AED: "AED",
};

export default function SettingsPage() {
  const initialize = useInvestmentStore((state) => state.initialize);
  const investments = useInvestmentStore((state) => state.investments);
  const clearAllData = useInvestmentStore((state) => state.clearAllData);
  const {
    locale,
    setLocale,
    displayCurrency,
    setDisplayCurrency,
    timezone,
    setTimezone,
    t,
    localizeErrorMessage
  } = useI18n();

  const [notifications, setNotifications] = useState({
    earnings: true,
    maturity: true,
    weekly: false,
    monthly: true
  });
  const [profile, setProfile] = useState({
    name: "Demo User",
    email: "demo@example.com"
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store"
        });
        const payload = await response.json();

        if (!response.ok || !isMounted || !payload.user) {
          return;
        }

        setProfile({
          name: payload.user.name || "",
          email: payload.user.email || ""
        });
        setTimezone(payload.user.timezone || DEFAULT_APP_TIMEZONE);
      } catch {
        // Keep prototype defaults when no logged-in session exists.
      }
    }

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch("/api/auth/session", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...profile,
          timezone
        })
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || t("settings.saveFailed"));
      }

      toast.success(t("settings.saveSuccess"));
    } catch (error) {
      if (profile.email === "demo@example.com") {
        toast.success(t("settings.saveSuccess"));
      } else {
        toast.error(localizeErrorMessage(error.message));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            investments
          },
          null,
          2
        )
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "earn-compass-export.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("settings.exportSuccess"));
  };

  const handleClearData = async () => {
    setIsClearing(true);

    try {
      await clearAllData();
      setClearDialogOpen(false);
      toast.success(t("settings.clearSuccess"));
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("settings.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("settings.subtitle")}
          </p>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t("common.profile")}</CardTitle>
                  <CardDescription>{t("settings.profileDescription")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("common.displayName")}</Label>
                  <Input
                    id="name"
                    placeholder={t("settings.namePlaceholder")}
                    value={profile.name}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("common.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("settings.emailPlaceholder")}
                    value={profile.email}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        email: event.target.value
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
                  <Bell className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t("common.notifications")}</CardTitle>
                  <CardDescription>{t("settings.notificationsDescription")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("settings.earningsUpdates")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.earningsUpdatesDescription")}
                  </p>
                </div>
                <Switch
                  checked={notifications.earnings}
                  onCheckedChange={(checked) =>
                    setNotifications((current) => ({ ...current, earnings: checked }))
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("settings.maturityAlerts")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.maturityAlertsDescription")}
                  </p>
                </div>
                <Switch
                  checked={notifications.maturity}
                  onCheckedChange={(checked) =>
                    setNotifications((current) => ({ ...current, maturity: checked }))
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("settings.weeklySummary")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.weeklySummaryDescription")}
                  </p>
                </div>
                <Switch
                  checked={notifications.weekly}
                  onCheckedChange={(checked) =>
                    setNotifications((current) => ({ ...current, weekly: checked }))
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("settings.monthlyReport")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.monthlyReportDescription")}
                  </p>
                </div>
                <Switch
                  checked={notifications.monthly}
                  onCheckedChange={(checked) =>
                    setNotifications((current) => ({ ...current, monthly: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
                  <Shield className="h-5 w-5 text-chart-3" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t("common.displayPreferences")}</CardTitle>
                  <CardDescription>{t("settings.displayDescription")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("common.defaultCurrency")}</Label>
                  <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPLAY_CURRENCIES.map((currencyCode) => (
                        <SelectItem key={currencyCode} value={currencyCode}>
                          {CURRENCY_LABELS[currencyCode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("common.timezone")}</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("common.language")}</Label>
                  <Select value={locale} onValueChange={setLocale}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t("common.languages.en")}</SelectItem>
                      <SelectItem value="zh">{t("common.languages.zh")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                  <Database className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t("common.dataManagement")}</CardTitle>
                  <CardDescription>{t("settings.dataManagementDescription")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" className="gap-2" onClick={handleExport}>
                  <Download className="h-4 w-4" />
                  {t("common.exportData")}
                </Button>

                <AlertDialog
                  open={clearDialogOpen}
                  onOpenChange={(open) => {
                    if (!isClearing) {
                      setClearDialogOpen(open);
                    }
                  }}
                >
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2" disabled={isClearing}>
                      <Trash2 className="h-4 w-4" />
                      {t("common.clearAllData")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("settings.clearDataTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("settings.clearDataDescription")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isClearing}>
                        {t("common.cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(event) => {
                          event.preventDefault();
                          void handleClearData();
                        }}
                        loading={isClearing}
                        disabled={isClearing}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t("settings.deleteAllData")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => void handleSave()} className="gap-2" loading={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? t("common.saving") : t("common.saveChanges")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
