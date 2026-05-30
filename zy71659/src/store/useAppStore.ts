import { create } from 'zustand';
import type { 
  AlignedSample, 
  OperationSegment, 
  Anomaly, 
  HistoryRecord,
  ImportBatch,
  AnalysisReport
} from '../types';
import { getAnomalyCounts } from '../services/anomalyService';
import { getRecentHistory } from '../services/historyService';
import { getImportBatches } from '../services/importService';
import { getReports } from '../services/reportService';

export interface Device {
  id: string;
  name: string;
  model: string;
}

export interface AppState {
  currentUser: string;
  currentDeviceId: string;
  devices: Device[];
  timeRange: [number, number] | null;
  selectedBatchId: string | null;
  selectedSegmentId: string | null;
  selectedAnomalyId: string | null;
  selectedSampleId: string | null;
  
  batches: ImportBatch[];
  alignedSamples: AlignedSample[];
  segments: OperationSegment[];
  anomalies: Anomaly[];
  history: HistoryRecord[];
  reports: AnalysisReport[];
  
  anomalyCounts: {
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  };
  
  isLoading: boolean;
  error: string | null;
  
  setCurrentUser: (user: string) => void;
  setCurrentDeviceId: (deviceId: string) => void;
  setTimeRange: (range: [number, number] | null) => void;
  setSelectedBatchId: (id: string | null) => void;
  setSelectedSegmentId: (id: string | null) => void;
  setSelectedAnomalyId: (id: string | null) => void;
  setSelectedSampleId: (id: string | null) => void;
  
  setBatches: (batches: ImportBatch[]) => void;
  setAlignedSamples: (samples: AlignedSample[]) => void;
  setSegments: (segments: OperationSegment[]) => void;
  setAnomalies: (anomalies: Anomaly[]) => void;
  setHistory: (history: HistoryRecord[]) => void;
  setReports: (reports: AnalysisReport[]) => void;
  setAnomalyCounts: (counts: AppState['anomalyCounts']) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  loadDashboardData: () => Promise<void>;
  refreshData: () => Promise<void>;
  
  highlightSample: (sampleId: string | null) => void;
  highlightAnomaly: (anomalyId: string | null) => void;
}

const initialTimeRange = (): [number, number] => {
  const now = Date.now();
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;
  return [twoHoursAgo, now];
};

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: '工程师_001',
  currentDeviceId: 'MOTOR-001',
  devices: [
    { id: 'MOTOR-001', name: '测试电机A', model: 'Y2-132M-4' },
    { id: 'MOTOR-002', name: '测试电机B', model: 'Y2-160M-4' },
    { id: 'MOTOR-003', name: '测试电机C', model: 'Y2-180M-4' },
  ],
  timeRange: initialTimeRange(),
  selectedBatchId: null,
  selectedSegmentId: null,
  selectedAnomalyId: null,
  selectedSampleId: null,
  
  batches: [],
  alignedSamples: [],
  segments: [],
  anomalies: [],
  history: [],
  reports: [],
  
  anomalyCounts: {
    total: 0,
    byStatus: {},
    bySeverity: {},
    byType: {}
  },
  
  isLoading: false,
  error: null,
  
  setCurrentUser: (user) => set({ currentUser: user }),
  setCurrentDeviceId: (deviceId) => set({ currentDeviceId: deviceId }),
  setTimeRange: (range) => set({ timeRange: range }),
  setSelectedBatchId: (id) => set({ selectedBatchId: id }),
  setSelectedSegmentId: (id) => set({ selectedSegmentId: id }),
  setSelectedAnomalyId: (id) => set({ selectedAnomalyId: id }),
  setSelectedSampleId: (id) => set({ selectedSampleId: id }),
  
  setBatches: (batches) => set({ batches }),
  setAlignedSamples: (alignedSamples) => set({ alignedSamples }),
  setSegments: (segments) => set({ segments }),
  setAnomalies: (anomalies) => set({ anomalies }),
  setHistory: (history) => set({ history }),
  setReports: (reports) => set({ reports }),
  setAnomalyCounts: (anomalyCounts) => set({ anomalyCounts }),
  
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  loadDashboardData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [batches, reports, history, anomalyCounts] = await Promise.all([
        getImportBatches(),
        getReports(),
        getRecentHistory(20),
        getAnomalyCounts()
      ]);
      
      set({
        batches,
        reports,
        history,
        anomalyCounts,
        isLoading: false
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '加载数据失败',
        isLoading: false 
      });
    }
  },
  
  refreshData: async () => {
    await get().loadDashboardData();
  },
  
  highlightSample: (sampleId) => {
    set({ selectedSampleId: sampleId, selectedSegmentId: null });
  },
  
  highlightAnomaly: (anomalyId) => {
    set({ selectedAnomalyId: anomalyId });
    
    if (anomalyId) {
      const { anomalies, segments, alignedSamples } = get();
      const anomaly = anomalies.find(a => a.id === anomalyId);
      
      if (anomaly) {
        const relatedSegment = segments.find(s => s.anomalyIds.includes(anomalyId));
        if (relatedSegment) {
          set({ selectedSegmentId: relatedSegment.id });
        }
        
        const relatedSample = alignedSamples.find(s => s.anomalyIds.includes(anomalyId));
        if (relatedSample) {
          set({ selectedSampleId: relatedSample.id });
        }
      }
    }
  }
}));
