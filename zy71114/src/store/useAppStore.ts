import { create } from 'zustand';
import { Garage, Vehicle, RiskPoint, HeightReport, SimulationState, Unit } from '../types';
import { defaultGarage, defaultVehicle } from '../data/mockGarages';
import { SIMULATION_CONFIG } from '../utils/constants';

interface AppStore {
  selectedGarage: Garage;
  selectedVehicle: Vehicle;
  customVehicleHeight: number;
  customVehicleUnit: Unit;
  useCustomHeight: boolean;
  simulation: SimulationState;
  riskPoints: RiskPoint[];
  currentReport: HeightReport | null;
  cameraPreset: string;
  showRiskMarkers: boolean;
  showMeasurements: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  selectedEntrance: string | null;
  filteredEntrances: string[];
  vehicleDragEnabled: boolean;
  setSelectedGarage: (garage: Garage) => void;
  setSelectedVehicle: (vehicle: Vehicle) => void;
  setCustomVehicleHeight: (height: number) => void;
  setCustomVehicleUnit: (unit: Unit) => void;
  setUseCustomHeight: (use: boolean) => void;
  setSimulation: (simulation: Partial<SimulationState>) => void;
  setRiskPoints: (points: RiskPoint[]) => void;
  setCurrentReport: (report: HeightReport | null) => void;
  setCameraPreset: (preset: string) => void;
  setShowRiskMarkers: (show: boolean) => void;
  setShowMeasurements: (show: boolean) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setSelectedEntrance: (entranceId: string | null) => void;
  setFilteredEntrances: (entrances: string[]) => void;
  setVehicleDragEnabled: (enabled: boolean) => void;
  getEffectiveVehicle: () => Vehicle;
  togglePlay: () => void;
  setProgress: (progress: number) => void;
  resetSimulation: () => void;
  resetAll: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  selectedGarage: defaultGarage,
  selectedVehicle: defaultVehicle,
  customVehicleHeight: defaultVehicle.height,
  customVehicleUnit: defaultVehicle.unit,
  useCustomHeight: false,
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
  filteredEntrances: [],
  vehicleDragEnabled: false,

  setSelectedGarage: (garage) => set({ selectedGarage: garage }),
  setSelectedVehicle: (vehicle) => set({ selectedVehicle: vehicle, customVehicleHeight: vehicle.height, customVehicleUnit: vehicle.unit }),
  setCustomVehicleHeight: (customVehicleHeight) => set({ customVehicleHeight }),
  setCustomVehicleUnit: (customVehicleUnit) => set({ customVehicleUnit }),
  setUseCustomHeight: (useCustomHeight) => set({ useCustomHeight }),
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
  setFilteredEntrances: (filteredEntrances) => set({ filteredEntrances }),
  setVehicleDragEnabled: (vehicleDragEnabled) => set({ vehicleDragEnabled }),

  getEffectiveVehicle: () => {
    const { selectedVehicle, useCustomHeight, customVehicleHeight, customVehicleUnit } = get();
    if (useCustomHeight) {
      return { ...selectedVehicle, height: customVehicleHeight, unit: customVehicleUnit };
    }
    return selectedVehicle;
  },

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
