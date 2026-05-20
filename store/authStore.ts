"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "@/types/auth";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (token: string, user: User, refreshToken?: string) => void;
  logout: () => void;
}

const ssrSafeStorage = createJSONStorage(() => {
  if (typeof window !== "undefined") return localStorage;
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, user, refreshToken) =>
        set({ token, user, refreshToken: refreshToken ?? null }),
      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    {
      name: "ss-cable-auth",
      storage: ssrSafeStorage,
    }
  )
);
