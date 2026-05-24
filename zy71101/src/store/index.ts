import { create } from 'zustand';
import { AppStore, Mission, Point3D, Alert } from '@/types';

const initialState = {
  currentMission: null as Mission | null,
  selectedWaypoint: null as string | null,
  isPlaying: false,
  currentTime: 0,
  totalDuration: 120,
  playbackSpeed: 1,
  cameraView: 'orbit' as const,
  cameraState: {
    position: [100, 100, 100] as [number, number, number],
    target: [0, 0, 0] as [number, number, number]
  },
  filters: {
    showBuildings: true,
    showNoFlyZones: true,
    showFlightPath: true,
    showBatteryCurve: true
  },
  alerts: [] as Alert[],
  dronePosition: null as Point3D | null
};

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  setCurrentMission: (mission: Mission | null) => {
    let totalDuration = 120;
    if (mission && mission.flightPaths.length > 0) {
      const waypoints = mission.flightPaths[0].waypoints;
      totalDuration = waypoints.reduce((acc, wp) => acc + wp.stayTime, 0) + waypoints.length * 10;
    }
    set({ currentMission: mission, totalDuration, currentTime: 0, alerts: [] });
  },

  setSelectedWaypoint: (id: string | null) => set({ selectedWaypoint: id }),

  setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),

  setCurrentTime: (time: number) => {
    const { totalDuration } = get();
    const clampedTime = Math.max(0, Math.min(time, totalDuration));
    set({ currentTime: clampedTime });
  },

  setPlaybackSpeed: (speed: number) => set({ playbackSpeed: speed }),

  setCameraView: (view: 'orbit' | 'firstPerson' | 'topDown') => set({ cameraView: view }),

  setCameraState: (state) => set({ cameraState: state }),

  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters }
  })),

  addAlert: (alert: Omit<Alert, 'id'>) => set((state) => ({
    alerts: [...state.alerts, { ...alert, id: `alert-${Date.now()}-${Math.random()}` }]
  })),

  clearAlerts: () => set({ alerts: [] }),

  updateWaypoint: (id: string, position: Point3D) => set((state) => {
    if (!state.currentMission) return state;
    const updatedMission = {
      ...state.currentMission,
      flightPaths: state.currentMission.flightPaths.map(fp => ({
        ...fp,
        waypoints: fp.waypoints.map(wp =>
          wp.id === id ? { ...wp, position } : wp
        )
      }))
    };
    return { currentMission: updatedMission };
  }),

  setDronePosition: (position: Point3D | null) => set({ dronePosition: position }),

  resetState: () => set(initialState)
}));
