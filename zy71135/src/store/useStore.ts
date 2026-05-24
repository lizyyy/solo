import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, AppActions, Bay, LoadRecord } from '../types';
import { sampleCargoList, generateSampleBays } from '../utils/sampleData';
import { calculateCenterOfGravity } from '../utils/gravity';
import { validateRules } from '../utils/rules';
import { generateReport } from '../utils/export';

type StoreState = AppState & AppActions;

const initialBays = generateSampleBays();
const initialCargoList = [...sampleCargoList];

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      cargoList: initialCargoList,
      bays: initialBays,
      loadHistory: [],
      currentStep: 0,
      centerOfGravity: {
        x: 0,
        y: 0,
        z: 0,
        isWarning: false,
        offset: 0,
      },
      alerts: [],
      selectedCargo: null,
      selectedBay: null,
      filterType: 'all',
      cameraView: 'overview',
      isPlaying: false,

      setSelectedCargo: (id) => set({ selectedCargo: id }),
      setSelectedBay: (id) => set({ selectedBay: id }),
      setFilterType: (type) => set({ filterType: type }),
      setCameraView: (view) => set({ cameraView: view }),

      loadCargo: (cargoId, bayId) => {
        const state = get();
        const newBays = state.bays.map((bay) =>
          bay.id === bayId ? { ...bay, occupiedBy: cargoId } : bay
        );

        const newRecord: LoadRecord = {
          timestamp: Date.now(),
          cargoId,
          bayId,
          action: 'load',
        };

        const newHistory = [...state.loadHistory.slice(0, state.currentStep), newRecord];

        const newCog = calculateCenterOfGravity(newBays, state.cargoList);
        const newAlerts = validateRules(newBays, state.cargoList);

        set({
          bays: newBays,
          loadHistory: newHistory,
          currentStep: newHistory.length,
          centerOfGravity: newCog,
          alerts: newAlerts,
          selectedCargo: null,
        });
      },

      unloadCargo: (bayId) => {
        const state = get();
        const bay = state.bays.find((b) => b.id === bayId);
        if (!bay || !bay.occupiedBy) return;

        const cargoId = bay.occupiedBy;
        const newBays = state.bays.map((b) =>
          b.id === bayId ? { ...b, occupiedBy: undefined } : b
        );

        const newRecord: LoadRecord = {
          timestamp: Date.now(),
          cargoId,
          bayId,
          action: 'unload',
        };

        const newHistory = [...state.loadHistory.slice(0, state.currentStep), newRecord];
        const newCog = calculateCenterOfGravity(newBays, state.cargoList);
        const newAlerts = validateRules(newBays, state.cargoList);

        set({
          bays: newBays,
          loadHistory: newHistory,
          currentStep: newHistory.length,
          centerOfGravity: newCog,
          alerts: newAlerts,
        });
      },

      jumpToStep: (step) => {
        const state = get();
        if (step < 0 || step > state.loadHistory.length) return;

        let newBays: Bay[] = generateSampleBays();

        for (let i = 0; i < step; i++) {
          const record = state.loadHistory[i];
          if (record.action === 'load') {
            newBays = newBays.map((bay) =>
              bay.id === record.bayId ? { ...bay, occupiedBy: record.cargoId } : bay
            );
          } else {
            newBays = newBays.map((bay) =>
              bay.id === record.bayId ? { ...bay, occupiedBy: undefined } : bay
            );
          }
        }

        const newCog = calculateCenterOfGravity(newBays, state.cargoList);
        const newAlerts = validateRules(newBays, state.cargoList);

        set({
          bays: newBays,
          currentStep: step,
          centerOfGravity: newCog,
          alerts: newAlerts,
        });
      },

      togglePlay: () => {
        set((state) => ({ isPlaying: !state.isPlaying }));
      },

      resetState: () => {
        set({
          bays: generateSampleBays(),
          loadHistory: [],
          currentStep: 0,
          centerOfGravity: {
            x: 0,
            y: 0,
            z: 0,
            isWarning: false,
            offset: 0,
          },
          alerts: [],
          selectedCargo: null,
          selectedBay: null,
          isPlaying: false,
        });
      },

      loadSampleData: () => {
        set({
          cargoList: [...sampleCargoList],
          bays: generateSampleBays(),
          loadHistory: [],
          currentStep: 0,
          centerOfGravity: {
            x: 0,
            y: 0,
            z: 0,
            isWarning: false,
            offset: 0,
          },
          alerts: [],
          selectedCargo: null,
          selectedBay: null,
          isPlaying: false,
        });
      },

      exportReport: () => {
        const state = get();
        return generateReport(
          state.bays,
          state.cargoList,
          state.centerOfGravity,
          state.alerts,
          state.loadHistory
        );
      },

      recalculate: () => {
        const state = get();
        const newCog = calculateCenterOfGravity(state.bays, state.cargoList);
        const newAlerts = validateRules(state.bays, state.cargoList);
        set({
          centerOfGravity: newCog,
          alerts: newAlerts,
        });
      },
    }),
    {
      name: 'ship-load-simulator-storage',
      partialize: (state) => ({
        bays: state.bays,
        loadHistory: state.loadHistory,
        currentStep: state.currentStep,
        filterType: state.filterType,
        cameraView: state.cameraView,
        cargoList: state.cargoList,
      }),
    }
  )
);
