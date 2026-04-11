"use client";

import { useEffect, useState, useTransition } from "react";
import { getInvestmentRepository } from "@/lib/storage/repositories";
import { useAppStore } from "@/store/app-store";

export function useInvestmentWorkspace(initialSnapshot) {
  const storageMode = useAppStore((state) => state.storageMode);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function loadSnapshot() {
      try {
        const repository = getInvestmentRepository(storageMode);
        const nextSnapshot = await repository.getSnapshot();
        if (!isMounted) {
          return;
        }

        startTransition(() => {
          setSnapshot(nextSnapshot);
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(error.message);
      }
    }

    loadSnapshot();

    return () => {
      isMounted = false;
    };
  }, [storageMode]);

  async function runMutation(task) {
    try {
      setErrorMessage("");
      const nextSnapshot = await task(getInvestmentRepository(storageMode));
      startTransition(() => {
        setSnapshot(nextSnapshot);
      });
      return nextSnapshot;
    } catch (error) {
      setErrorMessage(error.message);
      throw error;
    }
  }

  return {
    storageMode,
    snapshot,
    setSnapshot,
    errorMessage,
    isPending,
    createInvestment: (payload) =>
      runMutation((repository) => repository.create(payload)),
    updateInvestment: (id, payload) =>
      runMutation((repository) => repository.update(id, payload)),
    deleteInvestment: (id, confirmationText) =>
      runMutation((repository) => repository.remove(id, confirmationText)),
    earlyCloseInvestment: (id, payload) =>
      runMutation((repository) => repository.earlyClose(id, payload))
  };
}
