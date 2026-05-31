import { create } from 'zustand';
import type { SourceType, User } from '@/types';

interface NavigationState {
  sourceType: SourceType;
  sourceId: string;
  sourceVersion: number;
  sourceLine: number;
}

interface UIState {
  sidebarCollapsed: boolean;
  currentUser: User | null;
  currentPath: string;
  selectedBatchId: string | null;
  selectedAnalysisRunId: string | null;
  activeSourcePanel: SourceType | null;
  selectedConclusionId: string | null;
  sourcePanelOpen: boolean;
  showNotificationPanel: boolean;
  highlightLineNumber: number | null;
  navigationState: NavigationState | null;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCurrentUser: (user: User | null) => void;
  setCurrentPath: (path: string) => void;
  setSelectedBatchId: (id: string | null) => void;
  setSelectedAnalysisRunId: (id: string | null) => void;
  setActiveSourcePanel: (type: SourceType | null) => void;
  setSelectedConclusionId: (id: string | null) => void;
  setSourcePanelOpen: (open: boolean) => void;
  setShowNotificationPanel: (show: boolean) => void;
  setHighlightLineNumber: (line: number | null) => void;
  navigateToSource: (state: NavigationState) => void;
  resetNavigation: () => void;
}

const defaultUser: User = {
  id: 'user-001',
  employeeNo: 'EMP2024001',
  name: '张工程师',
  role: 'engineer',
};

export const useUIStore = create<UIState>((set, get) => ({
  sidebarCollapsed: false,
  currentUser: defaultUser,
  currentPath: '/',
  selectedBatchId: null,
  selectedAnalysisRunId: null,
  activeSourcePanel: null,
  selectedConclusionId: null,
  sourcePanelOpen: false,
  showNotificationPanel: false,
  highlightLineNumber: null,
  navigationState: null,

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed });
  },

  setCurrentUser: (user) => {
    set({ currentUser: user });
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  },

  setCurrentPath: (path) => {
    set({ currentPath: path });
  },

  setSelectedBatchId: (id) => {
    set({ selectedBatchId: id });
  },

  setSelectedAnalysisRunId: (id) => {
    set({ selectedAnalysisRunId: id });
  },

  setActiveSourcePanel: (type) => {
    set({ activeSourcePanel: type, sourcePanelOpen: type !== null });
  },

  setSelectedConclusionId: (id) => {
    set({ selectedConclusionId: id });
  },

  setSourcePanelOpen: (open) => {
    if (!open) {
      set({ sourcePanelOpen: false, activeSourcePanel: null, highlightLineNumber: null, navigationState: null });
    } else {
      set({ sourcePanelOpen: true });
    }
  },

  setShowNotificationPanel: (show) => {
    set({ showNotificationPanel: show });
  },

  setHighlightLineNumber: (line) => {
    set({ highlightLineNumber: line });
  },

  navigateToSource: (state) => {
    set({
      activeSourcePanel: state.sourceType,
      sourcePanelOpen: true,
      highlightLineNumber: state.sourceLine,
      navigationState: state,
    });

    const recordsStore = (window as unknown as { useRecordsStore?: typeof import('@/stores/recordsStore').useRecordsStore }).useRecordsStore;
    if (recordsStore) {
      const store = recordsStore.getState();
      if (state.sourceType === 'shift_record') {
        store.loadSelectedShiftRecord(state.sourceId);
      } else if (state.sourceType === 'work_log') {
        store.loadSelectedWorkLog(state.sourceId);
      } else if (state.sourceType === 'maintenance' || state.sourceType === 'maintenance_order') {
        store.loadSelectedMaintenanceOrder(state.sourceId);
      }
    }
  },

  resetNavigation: () => {
    set({
      selectedBatchId: null,
      selectedAnalysisRunId: null,
      activeSourcePanel: null,
      selectedConclusionId: null,
      sourcePanelOpen: false,
      highlightLineNumber: null,
      navigationState: null,
    });
  },
}));

export function initUserFromStorage(): void {
  const stored = localStorage.getItem('currentUser');
  if (stored) {
    try {
      const user = JSON.parse(stored) as User;
      useUIStore.getState().setCurrentUser(user);
    } catch {
      useUIStore.getState().setCurrentUser(defaultUser);
    }
  }
}
