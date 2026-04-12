"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Compass, Eye, EyeOff } from "lucide-react";
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

function createLoginSchema(t) {
  return z.object({
    email: z.string().email(t("validation.validEmail")),
    password: z.string().min(8, t("validation.passwordMin"))
  });
}

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState({
    google: false,
    github: false
  });
  const { t, localizeErrorMessage } = useI18n();
  const { setUser } = useAuth();
  const loginSchema = createLoginSchema(t);

  useEffect(() => {
    const oauthError = new URLSearchParams(window.location.search).get("oauth_error");

    if (!oauthError) {
      return;
    }

    toast.error(localizeErrorMessage(oauthError));
    router.replace("/login");
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

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const onSubmit = async (data) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || t("auth.loginFailed"));
      }

      setUser(payload.user);
      toast.success(t("auth.loginSuccess"));
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error(localizeErrorMessage(error.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
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
            <CardTitle className="text-2xl font-semibold">{t("auth.loginTitle")}</CardTitle>
            <CardDescription>{t("auth.loginSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.email")}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t("auth.emailPlaceholder")} {...field} />
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
                            placeholder={t("auth.currentPasswordPlaceholder")}
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

                <div className="flex items-center justify-end">
                  {/* <Link href="#" className="text-sm text-muted-foreground hover:text-primary">
                    {t("auth.forgotPassword")}
                  </Link> */}
                </div>

                <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                  {isLoading ? t("auth.signingIn") : t("auth.signIn")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </Form>

            <OAuthButtons providers={oauthProviders} />

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("auth.noAccount")}{" "}
              <Link href="/register" className="font-medium text-primary hover:underline">
                {t("auth.signUp")}
              </Link>
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
