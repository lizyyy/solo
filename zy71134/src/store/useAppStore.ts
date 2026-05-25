import { create } from 'zustand';
import { AppStore, FilterStatusType, CameraViewType } from '../types';
import { sampleFloors, sampleWards, samplePipelines, sampleValves } from '../data/mockData';

const getInitialState = () => ({
  floors: sampleFloors,
  wards: sampleWards,
  pipelines: samplePipelines,
  valves: sampleValves,
  selectedFloorId: 'floor-1',
  selectedValveId: null,
  filterStatus: [] as FilterStatusType[],
  cameraView: 'perspective' as CameraViewType,
  timeline: {
    currentTime: new Date(),
    speed: 1,
    isPlaying: false,
  },
  operationLogs: [],
  showAffectedArea: true,
  leftPanelOpen: undefined as boolean | undefined,
  rightPanelOpen: undefined as boolean | undefined,
});

export const useAppStore = create<AppStore>((set, get) => ({
  ...getInitialState(),

  setSelectedFloor: (floorId: string | null) => {
    set({ selectedFloorId: floorId, selectedValveId: null });
  },

  setSelectedValve: (valveId: string | null) => {
    set({ selectedValveId: valveId });
  },

  toggleValve: (valveId: string) => {
    const { valves, addOperationLog } = get();
    const valve = valves.find((v) => v.id === valveId);
    if (!valve) return;

    set({
      valves: valves.map((v) =>
        v.id === valveId ? { ...v, isOpen: !v.isOpen } : v
      ),
    });

    addOperationLog(valveId, valve.name, valve.isOpen ? 'close' : 'open');
  },

  setFilterStatus: (status: FilterStatusType[]) => {
    set({ filterStatus: status });
  },

  setCameraView: (view: CameraViewType) => {
    set({ cameraView: view });
  },

  setTimelineTime: (time: Date) => {
    set((state) => ({
      timeline: { ...state.timeline, currentTime: time },
    }));
  },

  toggleTimelinePlay: () => {
    set((state) => ({
      timeline: { ...state.timeline, isPlaying: !state.timeline.isPlaying },
    }));
  },

  resetState: () => {
    const { leftPanelOpen, rightPanelOpen } = get();
    set({ ...getInitialState(), leftPanelOpen, rightPanelOpen });
  },

  importSampleData: () => {
    const { leftPanelOpen, rightPanelOpen } = get();
    set({ ...getInitialState(), leftPanelOpen, rightPanelOpen });
  },

  setLeftPanelOpen: (open: boolean) => {
    set({ leftPanelOpen: open });
  },

  setRightPanelOpen: (open: boolean) => {
    set({ rightPanelOpen: open });
  },

  toggleLeftPanel: () => {
    set((state) => ({ leftPanelOpen: !state.leftPanelOpen }));
  },

  toggleRightPanel: () => {
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen }));
  },

  toggleShowAffectedArea: () => {
    set((state) => ({ showAffectedArea: !state.showAffectedArea }));
  },

  addOperationLog: (valveId: string, valveName: string, action: 'open' | 'close') => {
    const { operationLogs } = get();
    const newLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date(),
      valveId,
      valveName,
      action,
      user: '培训学员',
    };
    set({
      operationLogs: [newLog, ...operationLogs].slice(0, 50),
    });
  },
}));
