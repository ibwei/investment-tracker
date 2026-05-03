"use client";

import { useEffect } from "react";
import { initGA } from "@/app/analytics/gtag";

export default function GAInit() {
  useEffect(() => {
    try {
      initGA();
    } catch (e) {
      // fail silently
    }
  }, []);

  return null;
}
