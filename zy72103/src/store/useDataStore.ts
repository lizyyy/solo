import { create } from 'zustand';
import type {
  BatteryRecord,
  PhotoAttachment,
  AnalysisResult,
  DataQualityReport,
  RecommendationItem,
  AppState,
  SupplementNote,
  FieldType,
} from '@/types';
import {
  checkDataQuality,
  analyzeRecords,
  generateRecommendations,
} from '@/algorithms/thresholdJudgment';
import { generateSampleRecords } from '@/mock/sampleData';

interface DataStore extends AppState {
  setRecords: (records: BatteryRecord[]) => void;
  addPhoto: (photo: PhotoAttachment) => void;
  removePhoto: (photoId: string) => void;
  loadSampleData: () => void;
  runAnalysis: () => void;
  addSupplementNote: (
    recordId: string,
    content: string,
    author: string,
    affectedFields: FieldType[],
  ) => void;
  setSelectedRecordId: (id: string | null) => void;
  clearAll: () => void;
}

export const useDataStore = create<DataStore>((set, get) => ({
  records: [],
  photos: [],
  currentAnalysis: null,
  previousAnalysis: null,
  dataQualityReport: null,
  recommendations: [],
  selectedRecordId: null,
  isAnalyzed: false,

  setRecords: (records) => {
    set({ records, isAnalyzed: false, currentAnalysis: null });
  },

  addPhoto: (photo) => {
    set((state) => ({ photos: [...state.photos, photo] }));
  },

  removePhoto: (photoId) => {
    set((state) => ({
      photos: state.photos.filter((p) => p.id !== photoId),
    }));
  },

  loadSampleData: () => {
    const sampleRecords = generateSampleRecords();
    set({
      records: sampleRecords,
      isAnalyzed: false,
      currentAnalysis: null,
      previousAnalysis: null,
      recommendations: [],
      dataQualityReport: null,
      photos: [],
    });
  },

  runAnalysis: () => {
    const { records, currentAnalysis } = get();

    if (records.length === 0) return;

    const { records: qualityChecked, report } = checkDataQuality(records);
    const { records: analyzed, result } = analyzeRecords(qualityChecked);
    const recommendations = generateRecommendations(analyzed, result, report);

    report.extremeCount = analyzed.filter((r) => r.dataQuality.isExtreme).length;
    report.extremeRecords = analyzed
      .filter((r) => r.dataQuality.isExtreme)
      .map((r) => r.id);

    set({
      records: analyzed,
      dataQualityReport: report,
      previousAnalysis: currentAnalysis,
      currentAnalysis: result,
      recommendations,
      isAnalyzed: true,
    });
  },

  addSupplementNote: (recordId, content, author, affectedFields) => {
    const { records, currentAnalysis } = get();
    const record = records.find((r) => r.id === recordId);

    if (!record || !currentAnalysis) return;

    const beforeAnalysis = { ...currentAnalysis };

    const updatedRecords = records.map((r) => {
      if (r.id === recordId) {
        const note: SupplementNote = {
          id: `NOTE-${Date.now()}`,
          content,
          author,
          timestamp: new Date(),
          affectedFields,
          beforeAnalysis,
          afterAnalysis: beforeAnalysis,
        };
        return { ...r, supplementNote: note };
      }
      return r;
    });

    const { records: reAnalyzed, result } = analyzeRecords(updatedRecords);
    const qualityReport = get().dataQualityReport;
    const newRecommendations = generateRecommendations(
      reAnalyzed,
      result,
      qualityReport!,
    );

    const finalRecords = reAnalyzed.map((r) => {
      if (r.id === recordId && r.supplementNote) {
        return {
          ...r,
          supplementNote: {
            ...r.supplementNote,
            afterAnalysis: result,
          },
        };
      }
      return r;
    });

    set({
      records: finalRecords,
      currentAnalysis: result,
      previousAnalysis: beforeAnalysis,
      recommendations: newRecommendations,
    });
  },

  setSelectedRecordId: (id) => {
    set({ selectedRecordId: id });
  },

  clearAll: () => {
    set({
      records: [],
      photos: [],
      currentAnalysis: null,
      previousAnalysis: null,
      dataQualityReport: null,
      recommendations: [],
      selectedRecordId: null,
      isAnalyzed: false,
    });
  },
}));
