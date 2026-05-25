import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, AppActions, AlertLevel, DataCenter, TimeSeriesData, Rack } from '../types';
import { sampleData } from '../data/sampleData';

const initialState: Omit<AppState, 'dataCenter' | 'timeSeriesData'> = {
  currentTimeIndex: 0,
  isPlaying: false,
  playSpeed: 1,
  alertFilters: ['critical', 'warning'],
  selectedRackId: null,
  selectedRowId: null,
  showHeatLayer: true,
  showLabels: true,
  showRacks: true,
  showAirFlow: true,
  cameraViews: [],
  currentCameraView: 'overview',
  currentAlerts: [],
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,
      dataCenter: null,
      timeSeriesData: [],

      loadSampleData: () => {
        const { dataCenter, timeSeriesData, cameraViews } = sampleData;
        set({
          dataCenter,
          timeSeriesData,
          cameraViews,
          currentTimeIndex: timeSeriesData.length - 1,
          currentAlerts: timeSeriesData[timeSeriesData.length - 1]?.alerts || [],
        });
      },

      importData: (data: { dataCenter: DataCenter; timeSeriesData: TimeSeriesData[] }) => {
        const { cameraViews } = sampleData;
        set({
          dataCenter: data.dataCenter,
          timeSeriesData: data.timeSeriesData,
          cameraViews,
          currentTimeIndex: data.timeSeriesData.length - 1,
          currentAlerts: data.timeSeriesData[data.timeSeriesData.length - 1]?.alerts || [],
        });
      },

      resetState: () => {
        set({
          ...initialState,
          dataCenter: null,
          timeSeriesData: [],
          cameraViews: [],
        });
      },

      setCurrentTimeIndex: (index: number) => {
        const { timeSeriesData } = get();
        const safeIndex = Math.max(0, Math.min(timeSeriesData.length - 1, index));
        set({
          currentTimeIndex: safeIndex,
          currentAlerts: timeSeriesData[safeIndex]?.alerts || [],
        });
      },

      setIsPlaying: (playing: boolean) => {
        set({ isPlaying: playing });
      },

      setPlaySpeed: (speed: number) => {
        set({ playSpeed: speed });
      },

      toggleAlertFilter: (level: AlertLevel) => {
        const { alertFilters } = get();
        if (alertFilters.includes(level)) {
          set({ alertFilters: alertFilters.filter((f) => f !== level) });
        } else {
          set({ alertFilters: [...alertFilters, level] });
        }
      },

      setSelectedRackId: (id: string | null) => {
        set({ selectedRackId: id });
      },

      setSelectedRowId: (id: string | null) => {
        set({ selectedRowId: id });
      },

      setShowHeatLayer: (show: boolean) => {
        set({ showHeatLayer: show });
      },

      setShowLabels: (show: boolean) => {
        set({ showLabels: show });
      },

      setShowRacks: (show: boolean) => {
        set({ showRacks: show });
      },

      setShowAirFlow: (show: boolean) => {
        set({ showAirFlow: show });
      },

      setCurrentCameraView: (viewId: string) => {
        set({ currentCameraView: viewId });
      },

      getFilteredAlerts: () => {
        const { currentAlerts, alertFilters } = get();
        return currentAlerts.filter((alert) => alertFilters.includes(alert.level));
      },

      getFilteredRacks: () => {
        const { dataCenter, timeSeriesData, currentTimeIndex, alertFilters } = get();
        if (!dataCenter) return [];

        const statusToAlertLevel: Record<string, AlertLevel> = {
          critical: 'critical',
          warning: 'warning',
          normal: 'info',
          offline: 'critical',
        };

        return dataCenter.racks
          .map((rack) => {
            const timeData = timeSeriesData[currentTimeIndex]?.racks.find(
              (r) => r.id === rack.id
            );
            return {
              ...rack,
              power: timeData?.power ?? rack.power,
              temperature: timeData?.temperature ?? rack.temperature,
              status: timeData?.status ?? rack.status,
            } as Rack;
          })
          .filter((rack) => {
            const alertLevel = statusToAlertLevel[rack.status];
            return alertFilters.includes(alertLevel);
          });
      },

      getCurrentRackData: (rackId: string) => {
        const { dataCenter, timeSeriesData, currentTimeIndex } = get();
        const rack = dataCenter?.racks.find((r) => r.id === rackId);
        const timeRackData = timeSeriesData[currentTimeIndex]?.racks.find(
          (r) => r.id === rackId
        );
        
        if (!rack) return undefined;
        
        return {
          ...rack,
          power: timeRackData?.power ?? rack.power,
          temperature: timeRackData?.temperature ?? rack.temperature,
          status: timeRackData?.status ?? rack.status,
        };
      },
    }),
    {
      name: 'datacenter-3d-storage',
      partialize: (state) => ({
        alertFilters: state.alertFilters,
        showHeatLayer: state.showHeatLayer,
        showLabels: state.showLabels,
        showRacks: state.showRacks,
        showAirFlow: state.showAirFlow,
        currentCameraView: state.currentCameraView,
        playSpeed: state.playSpeed,
      }),
    }
  )
);
