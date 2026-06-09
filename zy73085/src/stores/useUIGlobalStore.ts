import { create } from "zustand";

interface UIGlobalState {
  sidebarCollapsed: boolean;
  toast: { type: "success" | "warning" | "error" | "info"; message: string } | null;
  toggleSidebar: () => void;
  showToast: (type: UIGlobalState["toast"]["type"], message: string, duration?: number) => void;
  clearToast: () => void;
}

export const useUIGlobalStore = create<UIGlobalState>((set, get) => ({
  sidebarCollapsed: false,
  toast: null,
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  showToast: (type, message, duration = 3000) => {
    set({ toast: { type, message } });
    setTimeout(() => {
      if (get().toast?.message === message) set({ toast: null });
    }, duration);
  },
  clearToast: () => set({ toast: null }),
}));
