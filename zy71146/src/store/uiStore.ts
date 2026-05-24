import { create } from 'zustand';
import { ToolType } from '@/types';

interface UIState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  timelineExpanded: boolean;
  activeTool: ToolType;
  showStats: boolean;
  showCompass: boolean;
  sampleModalOpen: boolean;
  reportModalOpen: boolean;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setTimelineExpanded: (expanded: boolean) => void;
  setActiveTool: (tool: ToolType) => void;
  setShowStats: (show: boolean) => void;
  setShowCompass: (show: boolean) => void;
  setSampleModalOpen: (open: boolean) => void;
  setReportModalOpen: (open: boolean) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleTimeline: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  timelineExpanded: false,
  activeTool: 'select',
  showStats: false,
  showCompass: true,
  sampleModalOpen: false,
  reportModalOpen: false,
  
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setTimelineExpanded: (expanded) => set({ timelineExpanded: expanded }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setShowStats: (show) => set({ showStats: show }),
  setShowCompass: (show) => set({ showCompass: show }),
  setSampleModalOpen: (open) => set({ sampleModalOpen: open }),
  setReportModalOpen: (open) => set({ reportModalOpen: open }),
  
  toggleLeftPanel: () => set({ leftPanelOpen: !get().leftPanelOpen }),
  toggleRightPanel: () => set({ rightPanelOpen: !get().rightPanelOpen }),
  toggleTimeline: () => set({ timelineExpanded: !get().timelineExpanded }),
}));
