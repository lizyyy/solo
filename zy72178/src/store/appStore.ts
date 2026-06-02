import { create } from 'zustand';

interface AppState {
  currentUser: string;
  isInitialized: boolean;
  isLoading: boolean;
  sidebarOpen: boolean;
  setCurrentUser: (user: string) => void;
  setInitialized: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: localStorage.getItem('rag_checkup_user') || '小乔',
  isInitialized: false,
  isLoading: false,
  sidebarOpen: true,
  setCurrentUser: (user) => {
    localStorage.setItem('rag_checkup_user', user);
    set({ currentUser: user });
  },
  setInitialized: (value) => set({ isInitialized: value }),
  setLoading: (value) => set({ isLoading: value }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
