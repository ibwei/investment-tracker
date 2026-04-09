import "@/app/globals.css";
import { Geist_Mono, Inter } from "next/font/google";

import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";

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

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} bg-background font-sans text-foreground antialiased`}
      >
        <I18nProvider>
          {children}
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
