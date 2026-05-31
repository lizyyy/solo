import { create } from 'zustand';
import { Record, MaterialPack, AnalysisResult, MatrixCell, ChangeItem, VersionInfo } from '@/types';
import { transformRecordsToMatrix, analyzeRecords } from '@/utils/matrixTransformer';
import { compareVersions } from '@/utils/versionComparator';
import { mockMaterialPack, mockMaterialPackV2 } from '@/data/mockData';

interface AppState {
  currentPack: MaterialPack | null;
  versionHistory: MaterialPack[];
  matrix: MatrixCell[][];
  analysisResults: AnalysisResult[];
  selectedRecordId: string | null;
  changes: ChangeItem[];
  isAnalyzing: boolean;
  loadMockData: () => void;
  loadMockDataV2: () => void;
  setSelectedRecord: (id: string | null) => void;
  uploadMaterialPack: (records: Record[]) => void;
  compareWithVersion: (versionIndex: number) => void;
  clearChanges: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  currentPack: null,
  versionHistory: [],
  matrix: [],
  analysisResults: [],
  selectedRecordId: null,
  changes: [],
  isAnalyzing: false,

  loadMockData: () => {
    set({ isAnalyzing: true });
    const matrix = transformRecordsToMatrix(mockMaterialPack.records);
    const analysisResults = analyzeRecords(mockMaterialPack.records);
    set({
      currentPack: mockMaterialPack,
      versionHistory: [mockMaterialPack],
      matrix,
      analysisResults,
      isAnalyzing: false
    });
  },

  loadMockDataV2: () => {
    set({ isAnalyzing: true });
    const matrix = transformRecordsToMatrix(mockMaterialPackV2.records);
    const analysisResults = analyzeRecords(mockMaterialPackV2.records);
    const changes = compareVersions(mockMaterialPack, mockMaterialPackV2);
    set({
      currentPack: mockMaterialPackV2,
      versionHistory: [mockMaterialPack, mockMaterialPackV2],
      matrix,
      analysisResults,
      changes,
      isAnalyzing: false
    });
  },

  setSelectedRecord: (id: string | null) => {
    set({ selectedRecordId: id });
  },

  uploadMaterialPack: (records: Record[]) => {
    set({ isAnalyzing: true });
    const newPack: MaterialPack = {
      id: `pack_${Date.now()}`,
      name: `材料包 ${new Date().toLocaleDateString('zh-CN')}`,
      records,
      version: get().versionHistory.length + 1,
      createdAt: new Date().toISOString()
    };
    
    const matrix = transformRecordsToMatrix(records);
    const analysisResults = analyzeRecords(records);
    
    const oldPack = get().currentPack;
    const changes = oldPack ? compareVersions(oldPack, newPack) : [];
    
    set(state => ({
      currentPack: newPack,
      versionHistory: [...state.versionHistory, newPack],
      matrix,
      analysisResults,
      changes,
      isAnalyzing: false
    }));
  },

  compareWithVersion: (versionIndex: number) => {
    const { versionHistory, currentPack } = get();
    if (!currentPack || versionIndex >= versionHistory.length) return;
    
    const oldPack = versionHistory[versionIndex];
    const changes = compareVersions(oldPack, currentPack);
    set({ changes });
  },

  clearChanges: () => {
    set({ changes: [] });
  }
}));
