import { create } from 'zustand';
import { Garage, Vehicle, RiskPoint, HeightReport, SimulationState } from '../types';
import { defaultGarage, defaultVehicle } from '../data/mockGarages';
import { SIMULATION_CONFIG } from '../utils/constants';

interface AppStore {
  selectedGarage: Garage;
  selectedVehicle: Vehicle;
  simulation: SimulationState;
  riskPoints: RiskPoint[];
  currentReport: HeightReport | null;
  cameraPreset: string;
  showRiskMarkers: boolean;
  showMeasurements: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  selectedEntrance: string | null;
  setSelectedGarage: (garage: Garage) => void;
  setSelectedVehicle: (vehicle: Vehicle) => void;
  setSimulation: (simulation: Partial<SimulationState>) => void;
  setRiskPoints: (points: RiskPoint[]) => void;
  setCurrentReport: (report: HeightReport | null) => void;
  setCameraPreset: (preset: string) => void;
  setShowRiskMarkers: (show: boolean) => void;
  setShowMeasurements: (show: boolean) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setSelectedEntrance: (entranceId: string | null) => void;
  togglePlay: () => void;
  setProgress: (progress: number) => void;
  resetSimulation: () => void;
  resetAll: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  selectedGarage: defaultGarage,
  selectedVehicle: defaultVehicle,
  simulation: {
    isPlaying: false,
    progress: 0,
    currentPosition: defaultGarage.ramps[0]?.points[0] || [0, 0, 0],
    speed: SIMULATION_CONFIG.DEFAULT_SPEED,
  },
  riskPoints: [],
  currentReport: null,
  cameraPreset: 'overview',
  showRiskMarkers: true,
  showMeasurements: true,
  leftPanelOpen: true,
  rightPanelOpen: true,
  selectedEntrance: null,

  setSelectedGarage: (garage) => set({ selectedGarage: garage }),
  setSelectedVehicle: (vehicle) => set({ selectedVehicle: vehicle }),
  setSimulation: (simulation) =>
    set((state) => ({
      simulation: { ...state.simulation, ...simulation },
    })),
  setRiskPoints: (riskPoints) => set({ riskPoints }),
  setCurrentReport: (currentReport) => set({ currentReport }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setShowRiskMarkers: (showRiskMarkers) => set({ showRiskMarkers }),
  setShowMeasurements: (showMeasurements) => set({ showMeasurements }),
  setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
  setSelectedEntrance: (selectedEntrance) => set({ selectedEntrance }),

  togglePlay: () =>
    set((state) => ({
      simulation: {
        ...state.simulation,
        isPlaying: !state.simulation.isPlaying,
      },
    })),

  setProgress: (progress) => {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const { selectedGarage } = get();
    const ramp = selectedGarage.ramps[0];
    if (ramp) {
      const points = ramp.points;
      const totalSegments = points.length - 1;
      const exactIndex = clampedProgress * totalSegments;
      const segmentIndex = Math.floor(exactIndex);
      const t = exactIndex - segmentIndex;

      if (segmentIndex < totalSegments) {
        const p1 = points[segmentIndex];
        const p2 = points[segmentIndex + 1];
        const currentPosition: [number, number, number] = [
          p1[0] + (p2[0] - p1[0]) * t,
          p1[1] + (p2[1] - p1[1]) * t,
          p1[2] + (p2[2] - p1[2]) * t,
        ];
        set((state) => ({
          simulation: {
            ...state.simulation,
            progress: clampedProgress,
            currentPosition,
          },
        }));
      }
    }
  },

  resetSimulation: () =>
    set((state) => ({
      simulation: {
        ...state.simulation,
        isPlaying: false,
        progress: 0,
        currentPosition: state.selectedGarage.ramps[0]?.points[0] || [0, 0, 0],
      },
      riskPoints: [],
      currentReport: null,
    })),

  resetAll: () =>
    set({
      simulation: {
        isPlaying: false,
        progress: 0,
        currentPosition: defaultGarage.ramps[0]?.points[0] || [0, 0, 0],
        speed: SIMULATION_CONFIG.DEFAULT_SPEED,
      },
      riskPoints: [],
      currentReport: null,
      cameraPreset: 'overview',
      selectedEntrance: null,
    }),
}));
