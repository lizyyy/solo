import { create } from 'zustand';
import { getDB } from '@/utils/db';
import type { Beat, OperationLog } from '@/types';
import { generateId } from '@/types';

interface BeatState {
  beats: Beat[];
  loading: boolean;
  error: string | null;
  loadBeats: (trackId: string) => Promise<void>;
  addBeat: (trackId: string, time: number, isManual?: boolean, driftNote?: string) => Promise<Beat>;
  updateBeat: (id: string, updates: Partial<Beat>, reason?: string) => Promise<void>;
  deleteBeat: (id: string) => Promise<void>;
  clearBeats: (trackId: string) => Promise<void>;
}

const getOperator = (): string => {
  return localStorage.getItem('dj-operator') || 'DJ';
};

export const useBeatStore = create<BeatState>((set, get) => ({
  beats: [],
  loading: false,
  error: null,

  loadBeats: async (trackId: string) => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const beats = await db.getAllFromIndex('beats', 'trackId', trackId);
      beats.sort((a, b) => a.time - b.time);
      set({ beats, loading: false });
    } catch (error) {
      set({ error: '加载拍点失败', loading: false });
    }
  },

  addBeat: async (trackId: string, time: number, isManual = true, driftNote?: string): Promise<Beat> => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const beat: Beat = {
        id: generateId(),
        trackId,
        time,
        confidence: isManual ? 1 : 0.8,
        isManual,
        driftNote,
        createdAt: new Date(),
      };

      await db.add('beats', beat);

      const log: OperationLog = {
        id: generateId(),
        trackId,
        operationType: 'beat',
        fieldName: 'beat',
        oldValue: '',
        newValue: String(time),
        reason: driftNote || '添加拍点',
        operator: getOperator(),
        timestamp: new Date(),
      };
      await db.add('operationLogs', log);

      const beats = [...get().beats, beat].sort((a, b) => a.time - b.time);
      set({ beats, loading: false });
      return beat;
    } catch (error) {
      set({ error: '添加拍点失败', loading: false });
      throw error;
    }
  },

  updateBeat: async (id: string, updates: Partial<Beat>, reason = '调整拍点'): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const beat = await db.get('beats', id);
      if (!beat) throw new Error('拍点不存在');

      const oldTime = beat.time;
      const updatedBeat: Beat = {
        ...beat,
        ...updates,
      };

      await db.put('beats', updatedBeat);

      const log: OperationLog = {
        id: generateId(),
        trackId: beat.trackId,
        operationType: 'beat',
        fieldName: 'time',
        oldValue: String(oldTime),
        newValue: String(updates.time ?? oldTime),
        reason,
        operator: getOperator(),
        timestamp: new Date(),
      };
      await db.add('operationLogs', log);

      const beats = get().beats
        .map(b => b.id === id ? updatedBeat : b)
        .sort((a, b) => a.time - b.time);
      set({ beats, loading: false });
    } catch (error) {
      set({ error: '更新拍点失败', loading: false });
    }
  },

  deleteBeat: async (id: string): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const beat = await db.get('beats', id);
      if (!beat) throw new Error('拍点不存在');

      await db.delete('beats', id);

      const log: OperationLog = {
        id: generateId(),
        trackId: beat.trackId,
        operationType: 'beat',
        fieldName: 'beat',
        oldValue: String(beat.time),
        newValue: '',
        reason: '删除拍点',
        operator: getOperator(),
        timestamp: new Date(),
      };
      await db.add('operationLogs', log);

      const beats = get().beats.filter(b => b.id !== id);
      set({ beats, loading: false });
    } catch (error) {
      set({ error: '删除拍点失败', loading: false });
    }
  },

  clearBeats: async (trackId: string): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const beats = await db.getAllFromIndex('beats', 'trackId', trackId);
      
      for (const beat of beats) {
        await db.delete('beats', beat.id);
      }

      set({ beats: [], loading: false });
    } catch (error) {
      set({ error: '清除拍点失败', loading: false });
    }
  },
}));
