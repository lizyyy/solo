import { create } from 'zustand';

interface UIState {
  showDetailPanel: boolean;
  showTimeline: boolean;
  showConflictCenter: boolean;
  showReportModal: boolean;
  detailPanelShelterId: string | null;
  activeTab: 'map' | 'conflicts' | 'report';
}

interface UIActions {
  openDetailPanel: (shelterId: string) => void;
  closeDetailPanel: () => void;
  toggleTimeline: () => void;
  setActiveTab: (tab: 'map' | 'conflicts' | 'report') => void;
  openReportModal: () => void;
  closeReportModal: () => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  showDetailPanel: false,
  showTimeline: true,
  showConflictCenter: false,
  showReportModal: false,
  detailPanelShelterId: null,
  activeTab: 'map',

  openDetailPanel: (shelterId) => set({
    showDetailPanel: true,
    detailPanelShelterId: shelterId
  }),

  closeDetailPanel: () => set({
    showDetailPanel: false,
    detailPanelShelterId: null
  }),

  toggleTimeline: () => set(state => ({
    showTimeline: !state.showTimeline
  })),

  setActiveTab: (tab) => set({ activeTab: tab }),

  openReportModal: () => set({ showReportModal: true }),
  closeReportModal: () => set({ showReportModal: false })
}));
