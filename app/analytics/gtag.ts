export const GA_ID = 'G-45BYM4L7NC';

declare global {
  interface Window { dataLayer: any[]; gtag?: (...args: any[]) => void; }
}

export function initGA() {
  if (!GA_ID || typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  function gtag(){ (window.dataLayer = window.dataLayer || []).push(arguments); }
  window.gtag = window.gtag || gtag;
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { page_path: window.location.pathname });
}

export function pageview(url: string) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('config', GA_ID, { page_path: url });
}

export function event({ action, category, label, value }: { action: string; category?: string; label?: string; value?: number }) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', action, { event_category: category, event_label: label, value });
}