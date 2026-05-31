import { create } from "zustand";

export type UserRole = "admin" | "inspector" | "reviewer";

export interface FilterState {
  dateRange: [string, string] | null;
  status: string | null;
  severity: string | null;
  towerId: string | null;
  keyword: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  read: boolean;
  createdAt: string;
}

interface AppState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  syncFiltersFromURL: (params: URLSearchParams) => void;
  filtersToSearchParams: () => URLSearchParams;

  currentUser: {
    id: string;
    name: string;
    role: UserRole;
  };
  setUser: (user: AppState["currentUser"]) => void;

  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id" | "read" | "createdAt">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadCount: () => number;
}

const defaultFilters: FilterState = {
  dateRange: null,
  status: null,
  severity: null,
  towerId: null,
  keyword: null,
};

export const useAppStore = create<AppState>((set, get) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  filters: { ...defaultFilters },
  setFilters: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),

  syncFiltersFromURL: (params) => {
    const filters: FilterState = { ...defaultFilters };
    if (params.get("status")) filters.status = params.get("status");
    if (params.get("severity")) filters.severity = params.get("severity");
    if (params.get("towerId")) filters.towerId = params.get("towerId");
    if (params.get("keyword")) filters.keyword = params.get("keyword");
    const start = params.get("startDate");
    const end = params.get("endDate");
    if (start && end) filters.dateRange = [start, end];
    set({ filters });
  },

  filtersToSearchParams: () => {
    const { filters } = get();
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.towerId) params.set("towerId", filters.towerId);
    if (filters.keyword) params.set("keyword", filters.keyword);
    if (filters.dateRange) {
      params.set("startDate", filters.dateRange[0]);
      params.set("endDate", filters.dateRange[1]);
    }
    return params;
  },

  currentUser: {
    id: "1",
    name: "巡检员A",
    role: "inspector",
  },
  setUser: (user) => set({ currentUser: user }),

  notifications: [],
  addNotification: (notification) => {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    set((s) => ({
      notifications: [{ ...notification, id, read: false, createdAt }, ...s.notifications],
    }));
  },
  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  markAllNotificationsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),
  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
