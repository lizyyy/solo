import { create } from "zustand";
import type {
  PlaybackState,
  FilterState,
  SamplingRecord,
  AnomalyMarker,
  SensorDrift,
  WithdrawalRecord,
  ProjectSummary,
  RecordStatus,
  AnomalyType,
  SamplingParameter,
} from "@/types";
import {
  samplingRecords as initialRecords,
  anomalyMarkers as initialAnomalies,
  sensorDrifts as initialDrifts,
  withdrawalRecords as initialWithdrawals,
  generateProjectSummary,
} from "@/data/mockData";

interface StoreState {
  records: SamplingRecord[];
  anomalies: AnomalyMarker[];
  drifts: SensorDrift[];
  withdrawals: WithdrawalRecord[];
  selectedRecordId: string | null;
  selectedAnomalyId: string | null;
  activeTab: "timeline" | "kanban" | "summary";
  playback: PlaybackState;
  filters: FilterState;
  projectSummary: ProjectSummary;
  getFilteredRecords: () => SamplingRecord[];
  getRecordById: (id: string) => SamplingRecord | undefined;
  getAnomaliesForRecord: (recordId: string) => AnomalyMarker[];
  getDriftsForRecord: (recordId: string) => SensorDrift[];
  getWithdrawalForRecord: (recordId: string) => WithdrawalRecord | undefined;
  selectRecord: (id: string | null) => void;
  selectAnomaly: (id: string | null) => void;
  setActiveTab: (tab: "timeline" | "kanban" | "summary") => void;
  setPlayback: (state: Partial<PlaybackState>) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  togglePlay: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToIndex: (index: number) => void;
  updateRecordStatus: (recordId: string, status: RecordStatus) => void;
  addEvidence: (recordId: string, evidence: { type: string; description: string; reference: string }) => void;
  refreshSummary: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
  records: initialRecords,
  anomalies: initialAnomalies,
  drifts: initialDrifts,
  withdrawals: initialWithdrawals,
  selectedRecordId: null,
  selectedAnomalyId: null,
  activeTab: "timeline",
  playback: {
    isPlaying: false,
    currentIndex: 0,
    speed: 1,
    timeRange: null,
  },
  filters: {
    status: "all",
    anomalyType: "all",
    parameter: "all",
    showWithdrawn: true,
    showDriftAffected: true,
  },
  projectSummary: generateProjectSummary(),

  getFilteredRecords: () => {
    const { records, filters } = get();
    return records.filter((record) => {
      if (filters.status !== "all" && record.status !== filters.status) return false;
      if (filters.anomalyType !== "all") {
        const hasAnomalyType = record.anomalies.some((aId) => {
          const anomaly = get().anomalies.find((a) => a.id === aId);
          return anomaly?.type === filters.anomalyType;
        });
        if (!hasAnomalyType) return false;
      }
      if (filters.parameter !== "all" && record.parameters[filters.parameter as SamplingParameter] === null) {
        return false;
      }
      if (!filters.showWithdrawn && record.withdrawalId) return false;
      if (!filters.showDriftAffected && record.driftIds.length > 0) return false;
      return true;
    });
  },

  getRecordById: (id) => {
    return get().records.find((r) => r.id === id);
  },

  getAnomaliesForRecord: (recordId) => {
    const { records, anomalies } = get();
    const record = records.find((r) => r.id === recordId);
    return anomalies.filter((a) => record?.anomalies.includes(a.id));
  },

  getDriftsForRecord: (recordId) => {
    const { records, drifts } = get();
    const record = records.find((r) => r.id === recordId);
    return drifts.filter((d) => record?.driftIds.includes(d.id));
  },

  getWithdrawalForRecord: (recordId) => {
    const { records, withdrawals } = get();
    const record = records.find((r) => r.id === recordId);
    return withdrawals.find((w) => w.id === record?.withdrawalId);
  },

  selectRecord: (id) => set({ selectedRecordId: id }),
  selectAnomaly: (id) => set({ selectedAnomalyId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  setPlayback: (state) =>
    set((prev) => ({
      playback: { ...prev.playback, ...state },
    })),

  setFilters: (filters) =>
    set((prev) => ({
      filters: { ...prev.filters, ...filters },
    })),

  togglePlay: () =>
    set((prev) => ({
      playback: { ...prev.playback, isPlaying: !prev.playback.isPlaying },
    })),

  stepForward: () =>
    set((prev) => {
      const filtered = get().getFilteredRecords();
      const nextIndex = Math.min(prev.playback.currentIndex + 1, filtered.length - 1);
      return {
        playback: { ...prev.playback, currentIndex: nextIndex },
        selectedRecordId: filtered[nextIndex]?.id || null,
      };
    }),

  stepBackward: () =>
    set((prev) => {
      const filtered = get().getFilteredRecords();
      const prevIndex = Math.max(prev.playback.currentIndex - 1, 0);
      return {
        playback: { ...prev.playback, currentIndex: prevIndex },
        selectedRecordId: filtered[prevIndex]?.id || null,
      };
    }),

  jumpToIndex: (index) =>
    set((prev) => {
      const filtered = get().getFilteredRecords();
      const safeIndex = Math.max(0, Math.min(index, filtered.length - 1));
      return {
        playback: { ...prev.playback, currentIndex: safeIndex },
        selectedRecordId: filtered[safeIndex]?.id || null,
      };
    }),

  updateRecordStatus: (recordId, status) =>
    set((prev) => ({
      records: prev.records.map((r) =>
        r.id === recordId ? { ...r, status } : r
      ),
    })),

  addEvidence: (recordId, evidence) =>
    set((prev) => ({
      records: prev.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              evidence: [
                ...r.evidence,
                {
                  id: `ev-${Date.now()}`,
                  type: evidence.type as any,
                  description: evidence.description,
                  reference: evidence.reference,
                  uploadedAt: new Date().toISOString(),
                },
              ],
            }
          : r
      ),
    })),

  refreshSummary: () => {
    set({ projectSummary: generateProjectSummary() });
  },
}));
