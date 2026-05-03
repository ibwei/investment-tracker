"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { GA_ID, pageview } from "@/app/analytics/gtag";

export default function GAInit() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!GA_ID) return;

    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;

    if (previousUrlRef.current === null) {
      previousUrlRef.current = url;
      return;
    }

    if (previousUrlRef.current !== url) {
      previousUrlRef.current = url;
      pageview(url);
    }
  }, [pathname, searchParams]);

  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { page_path: window.location.pathname + window.location.search });
        `}
      </Script>
    </>
  );
}
