"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_MODES, type StorageMode } from "@/lib/storage-mode";

interface AppStore {
  storageMode: StorageMode;
  setStorageMode: (storageMode: StorageMode) => void;
}

export const useAppStore = create<AppStore>()(
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
