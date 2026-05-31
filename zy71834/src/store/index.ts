import { create } from 'zustand';
import type {
  MaterialPack, TestRecord, UnitEntry, TerrainRule, Anomaly,
  ReviewReport, ConfirmationLog, HighlightState
} from '@/types';
import { mockMaterialPacks, getMockData } from '@/mock/data';

interface AppState {
  materialPacks: MaterialPack[];
  currentMaterialId: string | null;
  testRecords: TestRecord[];
  unitEntries: UnitEntry[];
  terrainRules: TerrainRule[];
  anomalies: Anomaly[];
  reviewReports: ReviewReport[];
  confirmationLogs: ConfirmationLog[];
  selectedRecordId: string | null;
  selectedAnomalyId: string | null;
  highlight: HighlightState;
  detailPanelOpen: boolean;
  loadMaterialPack: (id: string) => void;
  setCurrentMaterial: (id: string | null) => void;
  selectRecord: (id: string | null) => void;
  selectAnomaly: (id: string | null) => void;
  setHighlight: (highlight: Partial<HighlightState>) => void;
  setDetailPanelOpen: (open: boolean) => void;
  confirmAnomaly: (anomalyId: string, operator: string, remark?: string) => void;
  unconfirmAnomaly: (anomalyId: string, operator: string) => void;
  addMockMaterialPack: (pack: MaterialPack, data: {
    testRecords: TestRecord[];
    unitEntries: UnitEntry[];
    terrainRules: TerrainRule[];
    anomalies: Anomaly[];
    reviewReports: ReviewReport[];
  }) => void;
  importMaterialPack: (pack: MaterialPack, data: {
    testRecords: TestRecord[];
    unitEntries: UnitEntry[];
    terrainRules: TerrainRule[];
    anomalies: Anomaly[];
  }) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  materialPacks: mockMaterialPacks,
  currentMaterialId: null,
  testRecords: [],
  unitEntries: [],
  terrainRules: [],
  anomalies: [],
  reviewReports: [],
  confirmationLogs: [],
  selectedRecordId: null,
  selectedAnomalyId: null,
  highlight: { round: null, recordId: null },
  detailPanelOpen: false,

  loadMaterialPack: (id: string) => {
    const data = getMockData(id);
    set({
      currentMaterialId: id,
      testRecords: data.testRecords,
      unitEntries: data.unitEntries,
      terrainRules: data.terrainRules,
      anomalies: data.anomalies,
      reviewReports: data.reviewReports,
      selectedRecordId: null,
      selectedAnomalyId: null,
    });
  },

  setCurrentMaterial: (id: string | null) => {
    set({ currentMaterialId: id });
    if (id) {
      get().loadMaterialPack(id);
    }
  },

  selectRecord: (id: string | null) => {
    set({ selectedRecordId: id, detailPanelOpen: !!id });
  },

  selectAnomaly: (id: string | null) => {
    set({ selectedAnomalyId: id });
  },

  setHighlight: (highlight: Partial<HighlightState>) => {
    set(state => ({ highlight: { ...state.highlight, ...highlight } }));
  },

  setDetailPanelOpen: (open: boolean) => {
    set({ detailPanelOpen: open });
  },

  confirmAnomaly: (anomalyId: string, operator: string, remark?: string) => {
    set(state => {
      const log: ConfirmationLog = {
        id: `log-${Date.now()}`,
        anomalyId,
        operator,
        timestamp: new Date(),
        action: 'confirm',
        remark,
      };
      return {
        anomalies: state.anomalies.map(a =>
          a.id === anomalyId
            ? { ...a, status: 'confirmed', confirmedBy: operator, confirmedAt: new Date(), remark }
            : a
        ),
        confirmationLogs: [...state.confirmationLogs, log],
      };
    });
  },

  unconfirmAnomaly: (anomalyId: string, operator: string) => {
    set(state => {
      const log: ConfirmationLog = {
        id: `log-${Date.now()}`,
        anomalyId,
        operator,
        timestamp: new Date(),
        action: 'unconfirm',
      };
      return {
        anomalies: state.anomalies.map(a =>
          a.id === anomalyId
            ? { ...a, status: 'pending', confirmedBy: undefined, confirmedAt: undefined }
            : a
        ),
        confirmationLogs: [...state.confirmationLogs, log],
      };
    });
  },

  addMockMaterialPack: (pack, _data) => {
    set(state => ({
      materialPacks: [...state.materialPacks, pack],
    }));
  },

  importMaterialPack: (pack, data) => {
    set(state => ({
      materialPacks: [...state.materialPacks, pack],
      currentMaterialId: pack.id,
      testRecords: data.testRecords,
      unitEntries: data.unitEntries,
      terrainRules: data.terrainRules,
      anomalies: data.anomalies,
      reviewReports: [],
      confirmationLogs: [],
    }));
  },
}));
