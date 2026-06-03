import { create } from 'zustand';
import type { PointRecord, OriginSpec, HistoryLog, ObstructionPoint, StepStatus, PointRecordStatus, RecordStatus } from '@/types';
import { mockPointRecords, mockOriginSpecs, mockHistoryLogs } from '@/data/mockData';

interface AppState {
  currentStep: number;
  selectedRecordId: string | null;
  pointRecords: PointRecord[];
  originSpecs: OriginSpec[];
  historyLogs: HistoryLog[];
  obstructionPoints: ObstructionPoint[];
  isImporting: boolean;
  stepStatus: {
    import: StepStatus;
    review: StepStatus;
    update: StepStatus;
  };
  selectRecord: (id: string) => void;
  setStep: (step: number) => void;
  importRadiusTable: () => Promise<void>;
  supplementMissingRow: (recordId: string, x: number, y: number, source: string) => void;
  reviewRecord: (recordId: string, approve: boolean) => void;
  calculateObstructionPoints: () => void;
  getSelectedRecord: () => PointRecord | undefined;
  getLogsByRecordId: (recordId: string) => HistoryLog[];
  resetProcess: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentStep: 1,
  selectedRecordId: null,
  pointRecords: [...mockPointRecords],
  originSpecs: [...mockOriginSpecs],
  historyLogs: [...mockHistoryLogs],
  obstructionPoints: [],
  isImporting: false,
  stepStatus: {
    import: 'pending',
    review: 'pending',
    update: 'pending',
  },

  selectRecord: (id: string) => {
    set({ selectedRecordId: id });
  },

  setStep: (step: number) => {
    set({ currentStep: step });
  },

  importRadiusTable: async () => {
    const { selectedRecordId } = get();
    if (!selectedRecordId) return;

    set({ isImporting: true });
    await new Promise(resolve => setTimeout(resolve, 1000));

    set(state => ({
      isImporting: false,
      stepStatus: { ...state.stepStatus, import: 'completed', review: 'active' },
    }));
  },

  supplementMissingRow: (recordId: string, x: number, y: number, source: string) => {
    set(state => {
      const records = state.pointRecords.map(rec => {
        if (rec.id === recordId) {
          const newCoord = {
            id: `ce-${Date.now()}`,
            recordId,
            rowIndex: 4,
            x,
            y,
            radius: rec.safetyRadius,
            isMissing: false,
            isSupplemented: true,
            supplementSource: source,
          };
          return {
            ...rec,
            status: 'supplemented' as const,
            recordStatus: 'supplemented' as const,
            coordinateRowCount: 6,
            coordinates: [...rec.coordinates, newCoord].sort((a, b) => a.rowIndex - b.rowIndex),
          };
        }
        return rec;
      });

      const newLog: HistoryLog = {
        id: `log-${Date.now()}`,
        recordId,
        action: '补录旧口径数据',
        operator: '阿景',
        timestamp: new Date().toLocaleString('zh-CN'),
        detail: `补录第 4 行坐标，来源：${source}`,
      };

      return {
        pointRecords: records,
        historyLogs: [...state.historyLogs, newLog],
        stepStatus: { ...state.stepStatus, review: 'completed', update: 'active' },
      };
    });
  },

  reviewRecord: (recordId: string, approve: boolean) => {
    set(state => {
      const records = state.pointRecords.map(rec => {
        if (rec.id === recordId) {
          return {
            ...rec,
            status: (approve ? 'normal' : 'pending_review') as PointRecordStatus,
            recordStatus: (approve ? 'completed' : 'reviewing') as RecordStatus,
          };
        }
        return rec;
      });

      const newLog: HistoryLog = {
        id: `log-${Date.now()}`,
        recordId,
        action: approve ? '安全员复核通过' : '安全员退回补充',
        operator: '安全员',
        timestamp: new Date().toLocaleString('zh-CN'),
        detail: approve ? '复核通过，数据有效' : '退回补充，请补录缺失数据',
      };

      return {
        pointRecords: records,
        historyLogs: [...state.historyLogs, newLog],
        stepStatus: approve
          ? { ...state.stepStatus, review: 'completed', update: 'active' }
          : state.stepStatus,
      };
    });
  },

  calculateObstructionPoints: () => {
    const { pointRecords } = get();
    const obstructions: ObstructionPoint[] = [];

    pointRecords.forEach(rec => {
      rec.coordinates.forEach(coord => {
        const distance = Math.sqrt(
          Math.pow(coord.x - 100, 2) + Math.pow(coord.y - 50, 2)
        );
        obstructions.push({
          id: `ob-${rec.id}-${coord.rowIndex}`,
          recordId: rec.id,
          pointCode: rec.pointCode,
          rowIndex: coord.rowIndex,
          distance: parseFloat(distance.toFixed(2)),
          isObstructed: distance < rec.safetyRadius,
          status: rec.status,
        });
      });
    });

    set({
      obstructionPoints: obstructions,
      stepStatus: { import: 'completed', review: 'completed', update: 'completed' },
    });
  },

  getSelectedRecord: () => {
    const { pointRecords, selectedRecordId } = get();
    return pointRecords.find(r => r.id === selectedRecordId);
  },

  getLogsByRecordId: (recordId: string) => {
    return get().historyLogs.filter(log => log.recordId === recordId).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  },

  resetProcess: () => {
    set({
      currentStep: 1,
      selectedRecordId: null,
      stepStatus: {
        import: 'pending',
        review: 'pending',
        update: 'pending',
      },
    });
  },
}));
