import "@/app/globals.css";

import { AuthProvider } from "@/components/auth-provider";
import { I18nProvider } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
const siteName = "Earn Compass";
const siteTitle = "Earn Compass - CeFi & DeFi Investment Management";
const siteDescription =
  "Track CeFi and DeFi investment positions, monitor real-time income, compare APR performance, and review portfolio snapshots in one dashboard.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: siteTitle,
    template: `%s | ${siteName}`
  },
  description: siteDescription,
  keywords: [
    "CeFi investment tracker",
    "DeFi portfolio management",
    "crypto yield dashboard",
    "APR analytics",
    "investment income tracker",
    "portfolio snapshots",
    "Earn Compass"
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  category: "finance",
  alternates: {
    canonical: "/"
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/favicon.png", sizes: "512x512", type: "image/png" }]
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title: siteTitle,
    description: siteDescription,
    locale: "en_US",
    images: [
      {
        url: "/favicon.png",
        width: 512,
        height: 512,
        alt: `${siteName} compass mark`
      }
    ]
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
    images: ["/favicon.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  }
};

export const viewport = {
  themeColor: "#0f1117",
  width: "device-width",
  initialScale: 1
};

export default async function RootLayout({ children }) {
  const session = await getSession();
  const user = session
    ? await import("@/lib/users").then(({ getUserById }) =>
        getUserById(session.userId)
      )
    : null;

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="bg-background font-sans text-foreground antialiased"
      >
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
