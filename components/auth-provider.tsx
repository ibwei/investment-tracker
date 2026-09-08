"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback, Fragment, useLayoutEffect } from "react";

import { useInvestmentStore } from "@/lib/store";
import { invalidateResources } from "@/lib/client-request";
import type { AuthUser } from "@/lib/types";
import { setLocalUserScope } from "@/lib/storage/local-user-scope";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser = null
}: {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}) {
  const [user, setUserState] = useState<AuthUser | null>(initialUser);

  const setUser = useCallback((nextUser: AuthUser | null) => {
    if (nextUser?.id !== user?.id) {
      invalidateResources();
      useInvestmentStore.getState().resetScope(nextUser?.id ? `user:${nextUser.id}` : 'guest');
    }
    setUserState(nextUser);
  }, [user?.id]);

  useEffect(() => {
    const expireSession = () => setUser(null);
    window.addEventListener('earn:session-expired', expireSession);
    return () => window.removeEventListener('earn:session-expired', expireSession);
  }, [setUser]);

  useLayoutEffect(() => {
    useInvestmentStore.getState().resetScope(user?.id ? `user:${user.id}` : 'guest');
  }, [user?.id]);

  useEffect(() => {
    setLocalUserScope(user?.id ? `user:${user.id}` : "guest");
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      setUser
    }),
    [user, setUser]
  );

  return <AuthContext.Provider value={value}><Fragment key={user?.id ?? "guest"}>{children}</Fragment></AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
