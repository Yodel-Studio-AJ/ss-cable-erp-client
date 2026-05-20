"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type ViewMode = "list" | "grid";

interface ViewState {
  views: Record<string, ViewMode>;
  setView: (page: string, mode: ViewMode) => void;
  getView: (page: string) => ViewMode;
}

export const useViewStore = create<ViewState>()(
  persist(
    (set, get) => ({
      views: {},
      setView: (page, mode) =>
        set((s) => ({ views: { ...s.views, [page]: mode } })),
      getView: (page) => get().views[page] ?? "list",
    }),
    {
      name: "ss-cable-views",
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") return localStorage;
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
      }),
    }
  )
);
