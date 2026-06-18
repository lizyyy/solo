import { create } from 'zustand';
import type { AppState, AppActions, Station, TidalRecord, SourceChainItem, Remark, ReviewLog, ReviewStatus, TideUnit } from '../types';
import { stations as mockStations } from '../data/stations';
import { allRecords } from '../data/records';
import { getSourceChain } from '../data/sourceChains';
import { getRemarks } from '../data/remarks';

const initialSourceChains: Record<string, SourceChainItem[]> = {};
const initialRemarks: Record<string, Remark[]> = {};
const initialReviewLogs: Record<string, ReviewLog[]> = {};

allRecords.forEach(record => {
  initialSourceChains[record.id] = getSourceChain(record.id, record.anomalyType);
  initialRemarks[record.id] = getRemarks(record.id);
  initialReviewLogs[record.id] = [];
});

const useAppStore = create<AppState & AppActions>((set, get) => ({
  stations: mockStations,
  records: allRecords,
  sourceChains: initialSourceChains,
  remarks: initialRemarks,
  reviewLogs: initialReviewLogs,
  selectedStationId: 'st-001',
  selectedRecordId: null,
  timeRange: { start: '2026-06-16T00:00:00', end: '2026-06-18T00:00:00' },
  statusFilter: 'all',
  unitFilter: 'all',
  anomalyFilter: 'all',
  isPlaying: false,
  playSpeed: 1,
  currentTimeIndex: 0,
  showDetail: false,
  showReport: false,

  setSelectedStation: (id: string) => set({ selectedStationId: id, selectedRecordId: null, showDetail: false }),

  setSelectedRecord: (id: string | null) => set({ selectedRecordId: id, showDetail: id !== null }),

  setStatusFilter: (status: ReviewStatus | 'all') => set({ statusFilter: status }),

  setUnitFilter: (unit: 'all' | TideUnit | 'mixed') => set({ unitFilter: unit }),

  setAnomalyFilter: (filter: 'all' | 'anomaly' | 'normal') => set({ anomalyFilter: filter }),

  setTimeRange: (start: string, end: string) => set({ timeRange: { start, end } }),

  togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),

  setPlaySpeed: (speed: number) => set({ playSpeed: speed }),

  setCurrentTimeIndex: (index: number) => set({ currentTimeIndex: index }),

  toggleDetail: (show?: boolean) => set(state => ({
    showDetail: show !== undefined ? show : !state.showDetail,
  })),

  toggleReport: (show?: boolean) => set(state => ({
    showReport: show !== undefined ? show : !state.showReport,
  })),

  updateRecordStatus: (recordId: string, status: ReviewStatus, remark?: string) => set(state => {
    const newRecords = state.records.map(r =>
      r.id === recordId ? { ...r, status } : r
    );
    
    const newLog: ReviewLog = {
      id: `log-${Date.now()}`,
      recordId,
      action: 'status_change',
      fromStatus: state.records.find(r => r.id === recordId)?.status,
      toStatus: status,
      operator: '小宋',
      time: new Date().toISOString(),
      remark,
    };
    
    const newReviewLogs = {
      ...state.reviewLogs,
      [recordId]: [...(state.reviewLogs[recordId] || []), newLog],
    };
    
    return { records: newRecords, reviewLogs: newReviewLogs };
  }),

  addRemark: (recordId: string, content: string, isVerbal: boolean) => set(state => {
    const newRemark: Remark = {
      id: `rm-${Date.now()}`,
      recordId,
      content,
      author: '小宋',
      time: new Date().toISOString(),
      isVerbal,
    };
    
    return {
      remarks: {
        ...state.remarks,
        [recordId]: [...(state.remarks[recordId] || []), newRemark],
      },
    };
  }),

  getFilteredRecords: () => {
    const state = get();
    const { records, selectedStationId, statusFilter, unitFilter, anomalyFilter, timeRange } = state;
    
    return records.filter(r => {
      if (r.stationId !== selectedStationId) return false;
      
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      
      if (unitFilter !== 'all') {
        if (unitFilter === 'mixed') {
          if (r.originalUnit === r.unit) return false;
        } else {
          if (r.unit !== unitFilter) return false;
        }
      }
      
      if (anomalyFilter === 'anomaly' && !r.isAnomaly) return false;
      if (anomalyFilter === 'normal' && r.isAnomaly) return false;
      
      const recordTime = new Date(r.timestamp).getTime();
      const startTime = new Date(timeRange.start).getTime();
      const endTime = new Date(timeRange.end).getTime();
      if (recordTime < startTime || recordTime > endTime) return false;
      
      return true;
    });
  },

  getCurrentStationRecords: () => {
    const state = get();
    return state.records.filter(r => r.stationId === state.selectedStationId);
  },
}));

export default useAppStore;
