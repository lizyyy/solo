import { create } from 'zustand';
import { getDB } from '@/utils/db';
import type { Segment, OperationLog, SegmentType } from '@/types';
import { generateId } from '@/types';

interface SegmentState {
  segments: Segment[];
  loading: boolean;
  error: string | null;
  loadSegments: (trackId: string) => Promise<void>;
  addSegment: (trackId: string, type: SegmentType, startTime: number, endTime: number, label?: string) => Promise<Segment>;
  updateSegment: (id: string, updates: Partial<Segment>, reason?: string) => Promise<void>;
  deleteSegment: (id: string) => Promise<void>;
  clearSegments: (trackId: string) => Promise<void>;
}

const getOperator = (): string => {
  return localStorage.getItem('dj-operator') || 'DJ';
};

export const useSegmentStore = create<SegmentState>((set, get) => ({
  segments: [],
  loading: false,
  error: null,

  loadSegments: async (trackId: string) => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const segments = await db.getAllFromIndex('segments', 'trackId', trackId);
      segments.sort((a, b) => a.startTime - b.startTime);
      set({ segments, loading: false });
    } catch (error) {
      set({ error: '加载段落失败', loading: false });
    }
  },

  addSegment: async (trackId: string, type: SegmentType, startTime: number, endTime: number, label?: string): Promise<Segment> => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      
      const existingSegments = await db.getAllFromIndex('segments', 'trackId', trackId);
      const maxVersion = existingSegments.reduce((max, s) => Math.max(max, s.version), 0);
      
      const segment: Segment = {
        id: generateId(),
        trackId,
        type,
        startTime,
        endTime,
        label,
        version: maxVersion + 1,
        createdAt: new Date(),
      };

      await db.add('segments', segment);

      const log: OperationLog = {
        id: generateId(),
        trackId,
        operationType: 'segment',
        fieldName: 'segment',
        oldValue: '',
        newValue: `${type}: ${startTime}-${endTime}`,
        reason: '添加段落标注',
        operator: getOperator(),
        timestamp: new Date(),
      };
      await db.add('operationLogs', log);

      const segments = [...get().segments, segment].sort((a, b) => a.startTime - b.startTime);
      set({ segments, loading: false });
      return segment;
    } catch (error) {
      set({ error: '添加段落失败', loading: false });
      throw error;
    }
  },

  updateSegment: async (id: string, updates: Partial<Segment>, reason = '更新段落'): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const segment = await db.get('segments', id);
      if (!segment) throw new Error('段落不存在');

      const previousValue = JSON.stringify({
        type: segment.type,
        startTime: segment.startTime,
        endTime: segment.endTime,
        label: segment.label,
      });

      const updatedSegment: Segment = {
        ...segment,
        ...updates,
        version: segment.version + 1,
        previousValue,
      };

      await db.put('segments', updatedSegment);

      const log: OperationLog = {
        id: generateId(),
        trackId: segment.trackId,
        operationType: 'segment',
        fieldName: 'segment',
        oldValue: previousValue,
        newValue: JSON.stringify({
          type: updates.type ?? segment.type,
          startTime: updates.startTime ?? segment.startTime,
          endTime: updates.endTime ?? segment.endTime,
          label: updates.label ?? segment.label,
        }),
        reason,
        operator: getOperator(),
        timestamp: new Date(),
      };
      await db.add('operationLogs', log);

      const segments = get().segments
        .map(s => s.id === id ? updatedSegment : s)
        .sort((a, b) => a.startTime - b.startTime);
      set({ segments, loading: false });
    } catch (error) {
      set({ error: '更新段落失败', loading: false });
    }
  },

  deleteSegment: async (id: string): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const segment = await db.get('segments', id);
      if (!segment) throw new Error('段落不存在');

      await db.delete('segments', id);

      const log: OperationLog = {
        id: generateId(),
        trackId: segment.trackId,
        operationType: 'segment',
        fieldName: 'segment',
        oldValue: `${segment.type}: ${segment.startTime}-${segment.endTime}`,
        newValue: '',
        reason: '删除段落',
        operator: getOperator(),
        timestamp: new Date(),
      };
      await db.add('operationLogs', log);

      const segments = get().segments.filter(s => s.id !== id);
      set({ segments, loading: false });
    } catch (error) {
      set({ error: '删除段落失败', loading: false });
    }
  },

  clearSegments: async (trackId: string): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const segments = await db.getAllFromIndex('segments', 'trackId', trackId);
      
      for (const segment of segments) {
        await db.delete('segments', segment.id);
      }

      set({ segments: [], loading: false });
    } catch (error) {
      set({ error: '清除段落失败', loading: false });
    }
  },
}));
