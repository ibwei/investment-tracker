import "@/app/globals.css";
import { Geist_Mono, Inter } from "next/font/google";

import { AuthProvider } from "@/components/auth-provider";
import { I18nProvider } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { getUserById } from "@/lib/users";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

export const metadata = {
  title: "Earn Compass - CeFi & DeFi Investment Management",
  description:
    "Track and manage your CeFi and DeFi investments with real-time earnings analytics"
};

export const viewport = {
  themeColor: "#0f1117",
  width: "device-width",
  initialScale: 1
};

export default async function RootLayout({ children }) {
  const session = await getSession();
  const user = session ? await getUserById(session.userId) : null;

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} bg-background font-sans text-foreground antialiased`}
      >
        <Analytics />
        <AuthProvider initialUser={user}>
          <I18nProvider>
            {children}
            <Toaster />
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
