import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SensorData,
  DeviceParams,
  FieldNote,
  ManualCorrection,
  EnergyAnalysis,
  Anomaly,
} from '../types';
import { defaultDeviceParams } from '../data/mockData';
import { performEnergyCalculation } from '../utils/energyCalculator';
import { detectAllAnomalies, findExtremeValues } from '../utils/anomalyDetector';

interface AnalysisState {
  sensorData: SensorData[];
  deviceParams: DeviceParams;
  fieldNotes: FieldNote[];
  manualCorrections: ManualCorrection[];
  currentAnalysis: EnergyAnalysis | null;
  analysisHistory: EnergyAnalysis[];
  sourceFiles: string[];
  isAnalyzing: boolean;
  selectedAnomalyIds: string[];
  highlightedDataIndex: number | null;

  setSensorData: (data: SensorData[]) => void;
  setDeviceParams: (params: Partial<DeviceParams>) => void;
  addFieldNote: (note: Omit<FieldNote, 'id' | 'createdAt'>) => void;
  removeFieldNote: (id: string) => void;
  addManualCorrection: (correction: Omit<ManualCorrection, 'id' | 'createdAt'>) => void;
  removeManualCorrection: (id: string) => void;
  setSourceFiles: (files: string[]) => void;
  runAnalysis: (batchName: string, reason?: string) => void;
  saveToHistory: () => void;
  clearCurrent: () => void;
  deleteFromHistory: (id: string) => void;
  loadAnalysis: (analysis: EnergyAnalysis) => void;
  acknowledgeAnomaly: (id: string) => void;
  setHighlightedDataIndex: (index: number | null) => void;
  toggleAnomalySelection: (id: string) => void;
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set, get) => ({
      sensorData: [],
      deviceParams: defaultDeviceParams,
      fieldNotes: [],
      manualCorrections: [],
      currentAnalysis: null,
      analysisHistory: [],
      sourceFiles: [],
      isAnalyzing: false,
      selectedAnomalyIds: [],
      highlightedDataIndex: null,

      setSensorData: (data) => set({ sensorData: data }),

      setDeviceParams: (params) =>
        set((state) => ({
          deviceParams: { ...state.deviceParams, ...params, updatedAt: Date.now() },
        })),

      addFieldNote: (note) =>
        set((state) => ({
          fieldNotes: [
            ...state.fieldNotes,
            { ...note, id: 'note-' + Date.now(), createdAt: Date.now() },
          ],
        })),

      removeFieldNote: (id) =>
        set((state) => ({
          fieldNotes: state.fieldNotes.filter((n) => n.id !== id),
        })),

      addManualCorrection: (correction) =>
        set((state) => ({
          manualCorrections: [
            ...state.manualCorrections,
            { ...correction, id: 'corr-' + Date.now(), createdAt: Date.now() },
          ],
        })),

      removeManualCorrection: (id) =>
        set((state) => ({
          manualCorrections: state.manualCorrections.filter((c) => c.id !== id),
        })),

      setSourceFiles: (files) => set({ sourceFiles: files }),

      runAnalysis: (batchName: string, reason?: string) => {
        const state = get();
        if (state.sensorData.length === 0) return;

        set({ isAnalyzing: true });

        let adjustedData = [...state.sensorData];
        state.manualCorrections.forEach((corr) => {
          if (adjustedData[corr.dataPointIndex]) {
            adjustedData[corr.dataPointIndex] = {
              ...adjustedData[corr.dataPointIndex],
              [corr.field]: corr.correctedValue,
            };
          }
        });

        const energyResult = performEnergyCalculation(adjustedData, state.deviceParams);
        const anomalies = detectAllAnomalies(
          adjustedData,
          state.deviceParams,
          energyResult.totalEnergy
        );
        const extremeValues = findExtremeValues(adjustedData);

        const maxTemperature = Math.max(...adjustedData.map((d) => d.temperature));
        const maxVibration = Math.max(...adjustedData.map((d) => d.vibration));
        const criticalAnomalies = anomalies.filter((a) => a.severity === 'critical');
        const duration =
          adjustedData.length > 0
            ? adjustedData[adjustedData.length - 1].timestamp - adjustedData[0].timestamp
            : 0;

        const analysis: EnergyAnalysis = {
          id: 'analysis-' + Date.now(),
          batchName,
          sensorData: adjustedData,
          deviceParams: { ...state.deviceParams },
          fieldNotes: [...state.fieldNotes],
          manualCorrections: [...state.manualCorrections],
          ...energyResult,
          anomalies,
          extremeValues,
          summary: {
            totalSamples: adjustedData.length,
            avgKineticEnergy: energyResult.avgKineticEnergy,
            avgPotentialEnergy: energyResult.avgPotentialEnergy,
            totalEnergyLoss: energyResult.totalEnergyLoss,
            maxTemperature,
            maxVibration,
            anomalyCount: anomalies.length,
            criticalAnomalyCount: criticalAnomalies.length,
            duration,
          },
          createdAt: Date.now(),
          sourceFiles: [...state.sourceFiles],
          analysisReason: reason,
        };

        set({
          currentAnalysis: analysis,
          isAnalyzing: false,
          selectedAnomalyIds: [],
          highlightedDataIndex: null,
        });
      },

      saveToHistory: () => {
        const state = get();
        if (!state.currentAnalysis) return;

        set((prev) => ({
          analysisHistory: [state.currentAnalysis!, ...prev.analysisHistory].slice(0, 50),
        }));
      },

      clearCurrent: () =>
        set({
          sensorData: [],
          fieldNotes: [],
          manualCorrections: [],
          currentAnalysis: null,
          sourceFiles: [],
          selectedAnomalyIds: [],
          highlightedDataIndex: null,
        }),

      deleteFromHistory: (id) =>
        set((state) => ({
          analysisHistory: state.analysisHistory.filter((a) => a.id !== id),
        })),

      loadAnalysis: (analysis: EnergyAnalysis) =>
        set({
          sensorData: analysis.sensorData,
          deviceParams: analysis.deviceParams,
          fieldNotes: analysis.fieldNotes,
          manualCorrections: analysis.manualCorrections,
          currentAnalysis: analysis,
          sourceFiles: analysis.sourceFiles,
          selectedAnomalyIds: [],
          highlightedDataIndex: null,
        }),

      acknowledgeAnomaly: (id) =>
        set((state) => {
          if (!state.currentAnalysis) return state;
          return {
            currentAnalysis: {
              ...state.currentAnalysis,
              anomalies: state.currentAnalysis.anomalies.map((a) =>
                a.id === id ? { ...a, acknowledged: true } : a
              ),
            },
          };
        }),

      setHighlightedDataIndex: (index) => set({ highlightedDataIndex: index }),

      toggleAnomalySelection: (id) =>
        set((state) => ({
          selectedAnomalyIds: state.selectedAnomalyIds.includes(id)
            ? state.selectedAnomalyIds.filter((i) => i !== id)
            : [...state.selectedAnomalyIds, id],
        })),
    }),
    {
      name: 'ski-slope-analysis-storage',
      partialize: (state) => ({
        analysisHistory: state.analysisHistory,
        deviceParams: state.deviceParams,
      }),
    }
  )
);
