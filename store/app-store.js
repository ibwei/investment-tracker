"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_MODES } from "@/lib/storage-mode";

export const useAppStore = create(
  persist(
    (set) => ({
      storageMode: STORAGE_MODES.REMOTE,
      setStorageMode: (storageMode) => set({ storageMode })
    }),
    {
      name: "cefidefi-app-store-v2"
    }
  )
);
