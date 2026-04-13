"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Compass, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function createRegisterSchema(t) {
  return z
    .object({
      name: z.string().min(2, t("validation.nameMin")),
      email: z.string().email(t("validation.validEmail")),
      verificationCode: z.string().regex(/^\d{6}$/, t("validation.verificationCode")),
      password: z.string().min(8, t("validation.passwordMin")),
      confirmPassword: z.string()
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("validation.passwordsMismatch"),
      path: ["confirmPassword"]
    });
}

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [oauthProviders, setOauthProviders] = useState({
    google: false,
    github: false
  });
  const { t, localizeErrorMessage } = useI18n();
  const { setUser } = useAuth();
  const registerSchema = createRegisterSchema(t);
  const passwordRequirements = [
    { label: t("passwordRules.minLength"), test: (password) => password.length >= 8 },
    { label: t("passwordRules.hasNumber"), test: (password) => /\d/.test(password) },
    { label: t("passwordRules.hasUppercase"), test: (password) => /[A-Z]/.test(password) },
    { label: t("passwordRules.hasLowercase"), test: (password) => /[a-z]/.test(password) }
  ];

  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      verificationCode: "",
      password: "",
      confirmPassword: ""
    }
  });

  const password = form.watch("password");

  useEffect(() => {
    if (codeCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCodeCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [codeCooldown]);

  useEffect(() => {
    const oauthError = new URLSearchParams(window.location.search).get("oauth_error");

    if (!oauthError) {
      return;
    }

    toast.error(localizeErrorMessage(oauthError));
    router.replace("/register");
  }, [localizeErrorMessage, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadProviders() {
      try {
        const response = await fetch("/api/auth/providers", {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();

        if (!cancelled) {
          setOauthProviders({
            google: Boolean(payload.google),
            github: Boolean(payload.github)
          });
        }
      } catch {
      }
    }

    loadProviders();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (data) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          verificationCode: data.verificationCode,
          password: data.password
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || t("auth.registerFailed"));
      }

      setUser(payload.user);
      toast.success(t("auth.registerSuccess"));
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error(localizeErrorMessage(error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendVerificationCode = async () => {
    const isEmailValid = await form.trigger("email");

    if (!isEmailValid || isSendingCode || codeCooldown > 0) {
      return;
    }

    setIsSendingCode(true);

    try {
      const response = await fetch("/api/auth/email-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: form.getValues("email")
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || t("auth.sendVerificationCodeFailed"));
      }

      setCodeCooldown(60);
      toast.success(t("auth.verificationCodeSent"));
    } catch (error) {
      toast.error(localizeErrorMessage(error.message));
    } finally {
      setIsSendingCode(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[600px] w-[600px] rounded-full bg-chart-2/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Compass className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold tracking-tight">{t("common.brand")}</span>
        </Link>

        <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold">{t("auth.registerTitle")}</CardTitle>
            <CardDescription>{t("auth.registerSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.fullName")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("auth.fullNamePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.email")}</FormLabel>
                      <FormControl>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            type="email"
                            placeholder={t("auth.emailPlaceholder")}
                            className="min-w-0"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full shrink-0 sm:w-auto"
                            loading={isSendingCode}
                            disabled={isLoading || isSendingCode || codeCooldown > 0}
                            onClick={handleSendVerificationCode}
                          >
                            {codeCooldown > 0
                              ? t("auth.resendVerificationCodeIn").replace("{seconds}", String(codeCooldown))
                              : t("auth.sendVerificationCode")}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="verificationCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.verificationCode")}</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          maxLength={6}
                          placeholder={t("auth.verificationCodePlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.password")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder={t("auth.passwordPlaceholder")}
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword((current) => !current)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {password && (
                  <div className="grid grid-cols-2 gap-2">
                    {passwordRequirements.map((requirement) => {
                      const met = requirement.test(password);
                      return (
                        <div
                          key={requirement.label}
                          className={cn(
                            "flex items-center gap-2 text-xs transition-colors",
                            met ? "text-success" : "text-muted-foreground"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded-full border",
                              met ? "border-success bg-success/20" : "border-border"
                            )}
                          >
                            {met && <Check className="h-2.5 w-2.5" />}
                          </div>
                          {requirement.label}
                        </div>
                      );
                    })}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.confirmPassword")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t("auth.confirmPasswordPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full gap-2" loading={isLoading}>
                  {isLoading ? t("auth.creatingAccount") : t("auth.createAccount")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </Form>

            <OAuthButtons providers={oauthProviders} />

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("auth.signInLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
