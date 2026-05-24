import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StoreType, CameraView } from '../types';
import { getInitialState, sampleLayers, sampleSlots, sampleSKUs, sampleColdStorage } from '../data/mockData';
import { generateInventoryReport, exportReportJSON, exportReportCSV } from '../utils/reportGenerator';

export const useStore = create<StoreType>()(
  persist(
    (set, get) => ({
      ...getInitialState(),

      setSelectedLayers: (layerIds: string[]) => {
        set({ selectedLayerIds: layerIds });
      },

      toggleLayer: (layerId: string) => {
        const { selectedLayerIds } = get();
        const newSelected = selectedLayerIds.includes(layerId)
          ? selectedLayerIds.filter((id) => id !== layerId)
          : [...selectedLayerIds, layerId];
        set({ selectedLayerIds: newSelected });
      },

      setSelectedSlot: (slotId: string | null) => {
        set({ selectedSlotId: slotId });
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      setExpiryFilterDays: (days: number) => {
        set({ expiryFilterDays: days });
      },

      setCameraView: (view: CameraView) => {
        set({ cameraView: view });
      },

      loadSampleData: () => {
        const freshState = getInitialState();
        set({
          coldStorage: freshState.coldStorage,
          layers: freshState.layers,
          slots: freshState.slots,
          skus: freshState.skus,
          selectedLayerIds: freshState.selectedLayerIds,
          selectedSlotId: null,
          timestamp: Date.now(),
        });
      },

      resetState: () => {
        const freshState = getInitialState();
        set(freshState);
      },

      toggleLeftPanel: () => {
        set((state) => ({ leftPanelOpen: !state.leftPanelOpen }));
      },

      toggleRightPanel: () => {
        set((state) => ({ rightPanelOpen: !state.rightPanelOpen }));
      },

      generateReport: () => {
        const { layers, slots, skus, expiryFilterDays } = get();
        return generateInventoryReport(layers, slots, skus, expiryFilterDays);
      },

      exportReportJSON: () => {
        const report = get().generateReport();
        exportReportJSON(report);
      },

      exportReportCSV: () => {
        const report = get().generateReport();
        exportReportCSV(report);
      },
    }),
    {
      name: 'cold-storage-visualization',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedLayerIds: state.selectedLayerIds,
        selectedSlotId: state.selectedSlotId,
        searchQuery: state.searchQuery,
        expiryFilterDays: state.expiryFilterDays,
        cameraView: state.cameraView,
        leftPanelOpen: state.leftPanelOpen,
        rightPanelOpen: state.rightPanelOpen,
      }),
    },
  ),
);
