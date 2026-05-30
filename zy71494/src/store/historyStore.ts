import { create } from 'zustand';
import { getDB } from '@/utils/db';
import type { OperationLog, BPMHistory, EvidenceChainItem, Beat, Segment } from '@/types';

interface HistoryState {
  logs: OperationLog[];
  bpmHistory: BPMHistory[];
  loading: boolean;
  error: string | null;
  loadLogs: (trackId?: string, operationType?: string) => Promise<void>;
  loadBPMHistory: (trackId: string) => Promise<void>;
  addBPMHistory: (trackId: string, detectedBPM: number, adjustedBPM: number, reason: string, isHalfSpeedFix: boolean, isDoubleSpeedFix: boolean) => Promise<void>;
  getEvidenceChain: (trackId: string) => Promise<EvidenceChainItem[]>;
  clearLogs: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  logs: [],
  bpmHistory: [],
  loading: false,
  error: null,

  loadLogs: async (trackId?: string, operationType?: string) => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      let logs: OperationLog[];
      
      if (trackId) {
        logs = await db.getAllFromIndex('operationLogs', 'trackId', trackId);
      } else {
        logs = await db.getAllFromIndex('operationLogs', 'timestamp');
      }
      
      if (operationType) {
        logs = logs.filter(l => l.operationType === operationType);
      }
      
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      set({ logs, loading: false });
    } catch (error) {
      set({ error: '加载历史记录失败', loading: false });
    }
  },

  loadBPMHistory: async (trackId: string) => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const bpmHistory = await db.getAllFromIndex('bpmHistory', 'trackId', trackId);
      bpmHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      set({ bpmHistory, loading: false });
    } catch (error) {
      set({ error: '加载BPM历史失败', loading: false });
    }
  },

  addBPMHistory: async (trackId: string, detectedBPM: number, adjustedBPM: number, reason: string, isHalfSpeedFix: boolean, isDoubleSpeedFix: boolean): Promise<void> => {
    try {
      const db = await getDB();
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const history: BPMHistory = {
        id,
        trackId,
        detectedBPM,
        adjustedBPM,
        reason,
        isHalfSpeedFix,
        isDoubleSpeedFix,
        createdAt: new Date(),
      };

      await db.add('bpmHistory', history);

      const bpmHistory = [...get().bpmHistory, history].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      set({ bpmHistory });
    } catch (error) {
      set({ error: '保存BPM历史失败' });
    }
  },

  getEvidenceChain: async (trackId: string): Promise<EvidenceChainItem[]> => {
    const db = await getDB();
    const logs = await db.getAllFromIndex('operationLogs', 'trackId', trackId);
    const beats = await db.getAllFromIndex('beats', 'trackId', trackId);
    const segments = await db.getAllFromIndex('segments', 'trackId', trackId);
    const bpmHistory = await db.getAllFromIndex('bpmHistory', 'trackId', trackId);

    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const chain: EvidenceChainItem[] = [];

    for (const log of logs) {
      let relatedData: Beat | Segment | BPMHistory | undefined;
      let type: 'bpm' | 'beat' | 'segment' = 'bpm';

      if (log.operationType === 'bpm') {
        relatedData = bpmHistory.find(h => 
          Math.abs(new Date(h.createdAt).getTime() - new Date(log.timestamp).getTime()) < 1000
        );
        type = 'bpm';
      } else if (log.operationType === 'beat') {
        const beatTime = parseFloat(log.newValue || log.oldValue);
        relatedData = beats.find(b => Math.abs(b.time - beatTime) < 0.01);
        type = 'beat';
      } else if (log.operationType === 'segment') {
        relatedData = segments.find(s => {
          try {
            const newValue = JSON.parse(log.newValue || '{}');
            return s.type === newValue.type;
          } catch {
            return false;
          }
        });
        type = 'segment';
      }

      chain.push({ log, relatedData, type });
    }

    return chain;
  },

  clearLogs: () => {
    set({ logs: [], bpmHistory: [] });
  },
}));
