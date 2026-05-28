import { create } from 'zustand';
import type {
  AcousticDataset,
  DisplayParameter,
  RayFilterOptions,
  Seat,
  AcousticReading,
} from '../data/models/acoustic';
import type { Anomaly } from '../data/models/anomalies';
import { validateDataset } from '../data/validators/inputValidator';
import { generateNormalDataset } from '../data/demo/normalCase';
import { generateAnomalyDataset } from '../data/demo/anomalyCase';

interface AcousticState {
  dataset: AcousticDataset | null;
  anomalies: Anomaly[];
  isLoading: boolean;
  displayParam: DisplayParameter;
  rayFilter: RayFilterOptions;
  selectedSeatId: string | null;
  hoveredSeatId: string | null;
  showHallWireframe: boolean;
  showRays: boolean;
  showSeats: boolean;
  showSources: boolean;
  showColorLegend: boolean;
  cameraView: 'perspective' | 'top' | 'front' | 'side';
  loadDataset: (type: 'normal' | 'anomaly') => Promise<void>;
  loadCustomDataset: (dataset: AcousticDataset) => void;
  updateDisplayParam: (param: DisplayParameter) => void;
  updateRayFilter: (options: Partial<RayFilterOptions>) => void;
  selectSeat: (seatId: string | null) => void;
  hoverSeat: (seatId: string | null) => void;
  toggleHallWireframe: () => void;
  toggleRays: () => void;
  toggleSeats: () => void;
  toggleSources: () => void;
  toggleColorLegend: () => void;
  setCameraView: (view: 'perspective' | 'top' | 'front' | 'side') => void;
  getSelectedSeatData: () => (Seat & { reading?: AcousticReading }) | null;
  getFilteredRays: () => AcousticDataset['rayPaths'];
  clearDataset: () => void;
}

export const useAcousticStore = create<AcousticState>((set, get) => ({
  dataset: null,
  anomalies: [],
  isLoading: false,
  displayParam: 'reverberationTime',
  rayFilter: {
    minOrder: 1,
    maxOrder: 5,
    minEnergy: 0,
    showOnlySelectedSeat: false,
  },
  selectedSeatId: null,
  hoveredSeatId: null,
  showHallWireframe: false,
  showRays: true,
  showSeats: true,
  showSources: true,
  showColorLegend: true,
  cameraView: 'perspective',

  loadDataset: async (type: 'normal' | 'anomaly') => {
    set({ isLoading: true });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const dataset = type === 'normal' ? generateNormalDataset() : generateAnomalyDataset();
    const anomalies = validateDataset(dataset);
    set({
      dataset,
      anomalies,
      isLoading: false,
      selectedSeatId: null,
      hoveredSeatId: null,
    });
  },

  loadCustomDataset: (dataset: AcousticDataset) => {
    const anomalies = validateDataset(dataset);
    set({
      dataset,
      anomalies,
      selectedSeatId: null,
      hoveredSeatId: null,
    });
  },

  updateDisplayParam: (param: DisplayParameter) => {
    set({ displayParam: param });
  },

  updateRayFilter: (options: Partial<RayFilterOptions>) => {
    set((state) => ({
      rayFilter: { ...state.rayFilter, ...options },
    }));
  },

  selectSeat: (seatId: string | null) => {
    set({ selectedSeatId: seatId });
  },

  hoverSeat: (seatId: string | null) => {
    set({ hoveredSeatId: seatId });
  },

  toggleHallWireframe: () => {
    set((state) => ({ showHallWireframe: !state.showHallWireframe }));
  },

  toggleRays: () => {
    set((state) => ({ showRays: !state.showRays }));
  },

  toggleSeats: () => {
    set((state) => ({ showSeats: !state.showSeats }));
  },

  toggleSources: () => {
    set((state) => ({ showSources: !state.showSources }));
  },

  toggleColorLegend: () => {
    set((state) => ({ showColorLegend: !state.showColorLegend }));
  },

  setCameraView: (view) => {
    set({ cameraView: view });
  },

  getSelectedSeatData: () => {
    const { dataset, selectedSeatId } = get();
    if (!dataset || !selectedSeatId) return null;
    const seat = dataset.seats.find((s) => s.id === selectedSeatId);
    const reading = dataset.acousticReadings.find((r) => r.seatId === selectedSeatId);
    return seat ? { ...seat, reading } : null;
  },

  getFilteredRays: () => {
    const { dataset, rayFilter, selectedSeatId } = get();
    if (!dataset) return [];

    let rays = dataset.rayPaths.filter(
      (ray) =>
        ray.order >= rayFilter.minOrder &&
        ray.order <= rayFilter.maxOrder &&
        ray.energy >= rayFilter.minEnergy
    );

    if (rayFilter.showOnlySelectedSeat && selectedSeatId) {
      const seat = dataset.seats.find((s) => s.id === selectedSeatId);
      if (seat) {
        rays = rays.filter((ray) => {
          const lastPoint = ray.points[ray.points.length - 1];
          return (
            Math.abs(lastPoint.x - seat.position.x) < 2 &&
            Math.abs(lastPoint.z - seat.position.z) < 2
          );
        });
      }
    }

    return rays;
  },

  clearDataset: () => {
    set({
      dataset: null,
      anomalies: [],
      selectedSeatId: null,
      hoveredSeatId: null,
    });
  },
}));
