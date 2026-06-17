import { create } from 'zustand';
import { GarbagePoint, SourceData, OperationLog, MergeConfig, PointStatus, MergeCandidate, DEFAULT_MERGE_CONFIG } from '@/types';
import { db, initDatabase } from '@/db';
import { generateMockData, mockPhotos } from '@/data/mockData';
import { generateShortId } from '@/utils/stringUtils';
import { mergeEngine as engine } from '@/utils/mergeEngine';

interface AppState {
  points: GarbagePoint[];
  logs: OperationLog[];
  mergeConfig: MergeConfig;
  photos: Record<string, string>;
  selectedPointId: string | null;
  filters: {
    street: string | null;
    status: PointStatus | null;
    search: string;
    dateFrom: Date | null;
    dateTo: Date | null;
  };
  loading: boolean;
  initialized: boolean;
  operator: string;
  
  init: () => Promise<void>;
  loadMockData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  
  setSelectedPoint: (id: string | null) => void;
  setFilters: (filters: Partial<AppState['filters']>) => void;
  updateMergeConfig: (config: Partial<MergeConfig>) => void;
  setOperator: (name: string) => void;
  
  getFilteredPoints: () => GarbagePoint[];
  getPendingReviewPoints: () => GarbagePoint[];
  getPointById: (id: string) => GarbagePoint | undefined;
  getLogsByPointId: (pointId: string) => OperationLog[];
  getStreets: () => string[];
  getStats: () => {
    total: number;
    confirmed: number;
    pending: number;
    conflict: number;
    pendingReview: number;
  };
  
  addSourceData: (sourceData: SourceData) => Promise<{ point: GarbagePoint; candidate?: MergeCandidate }>;
  importSourceDataBatch: (sourceDataList: SourceData[]) => Promise<{
    autoMerged: number;
    pendingReview: number;
    newPoints: number;
    total: number;
  }>;
  
  confirmMerge: (pointId: string, sourceId: string, reason: string) => Promise<void>;
  rejectMerge: (pointId: string, sourceId: string, reason: string) => Promise<void>;
  createNewPointFromSource: (sourceId: string) => Promise<GarbagePoint>;
  splitSourceFromPoint: (pointId: string, sourceId: string) => Promise<{ mainPoint: GarbagePoint; newPoint: GarbagePoint }>;
  confirmPoint: (pointId: string, reason: string) => Promise<void>;
  
  addLog: (log: Omit<OperationLog, 'id' | 'timestamp'>) => void;
  
  savePhoto: (photoId: string, dataUrl: string) => Promise<void>;
  getPhotoUrl: (photoId: string) => string | undefined;
}

export const useAppStore = create<AppState>((set, get) => ({
  points: [],
  logs: [],
  mergeConfig: DEFAULT_MERGE_CONFIG,
  photos: {},
  selectedPointId: null,
  filters: {
    street: null,
    status: null,
    search: '',
    dateFrom: null,
    dateTo: null,
  },
  loading: false,
  initialized: false,
  operator: '城市规划师小赵',

  init: async () => {
    set({ loading: true });
    try {
      await initDatabase();
      
      const config = await db.config.toArray();
      if (config.length > 0) {
        set({ mergeConfig: config[0] });
        engine.updateConfig(config[0]);
      }
      
      const points = await db.points.orderBy('updatedAt').reverse().toArray();
      for (const point of points) {
        point.sources = await db.sources.where('pointId').equals(point.id).toArray();
      }
      
      const logs = await db.logs.orderBy('timestamp').reverse().toArray();
      
      const photoRecords = await db.photos.toArray();
      const photos: Record<string, string> = {};
      photoRecords.forEach(p => {
        photos[p.id] = p.data;
      });
      
      set({
        points,
        logs,
        photos,
        initialized: true,
        loading: false,
      });
      
      if (points.length === 0) {
        await get().loadMockData();
      }
    } catch (error) {
      console.error('Init failed:', error);
      set({ loading: false, initialized: true });
    }
  },

  loadMockData: async () => {
    set({ loading: true });
    try {
      const mockData = generateMockData();
      
      await db.transaction('rw', ['points', 'sources', 'logs', 'config', 'photos'], async () => {
        await db.points.bulkAdd(mockData.points);
        await db.sources.bulkAdd(mockData.sources);
        await db.logs.bulkAdd(mockData.logs);
        await db.config.put({ id: 'default', ...mockData.config });
        
        for (const [id, url] of Object.entries(mockData.photos)) {
          await db.photos.put({ id, data: url });
        }
      });
      
      const points = await db.points.orderBy('updatedAt').reverse().toArray();
      for (const point of points) {
        point.sources = await db.sources.where('pointId').equals(point.id).toArray();
      }
      
      const logs = await db.logs.orderBy('timestamp').reverse().toArray();
      
      set({
        points,
        logs,
        photos: mockPhotos,
        mergeConfig: mockData.config,
        loading: false,
      });
      
      engine.updateConfig(mockData.config);
    } catch (error) {
      console.error('Load mock data failed:', error);
      set({ loading: false });
    }
  },

  clearAllData: async () => {
    set({ loading: true });
    try {
      await db.transaction('rw', ['points', 'sources', 'logs', 'photos'], async () => {
        await db.points.clear();
        await db.sources.clear();
        await db.logs.clear();
        await db.photos.clear();
      });
      set({ points: [], logs: [], photos: {}, loading: false });
    } catch (error) {
      console.error('Clear data failed:', error);
      set({ loading: false });
    }
  },

  setSelectedPoint: (id) => set({ selectedPointId: id }),

  setFilters: (filters) => set(state => ({
    filters: { ...state.filters, ...filters },
  })),

  updateMergeConfig: async (config) => {
    const newConfig = { ...get().mergeConfig, ...config };
    set({ mergeConfig: newConfig });
    engine.updateConfig(newConfig);
    await db.config.put({ id: 'default', ...newConfig });
  },

  setOperator: (name) => set({ operator: name }),

  getFilteredPoints: () => {
    const { points, filters } = get();
    return points.filter(point => {
      if (filters.street && point.street !== filters.street) return false;
      if (filters.status && point.status !== filters.status) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matchName = point.canonicalName.toLowerCase().includes(search);
        const matchAddress = point.address.toLowerCase().includes(search);
        const matchSource = point.sources.some(s => s.sourceName.toLowerCase().includes(search));
        if (!matchName && !matchAddress && !matchSource) return false;
      }
      if (filters.dateFrom && new Date(point.createdAt) < filters.dateFrom) return false;
      if (filters.dateTo && new Date(point.createdAt) > filters.dateTo) return false;
      return true;
    });
  },

  getPendingReviewPoints: () => {
    const { points } = get();
    return points.filter(p => 
      p.status === PointStatus.PENDING || 
      p.status === PointStatus.CONFLICT
    );
  },

  getPointById: (id) => get().points.find(p => p.id === id),

  getLogsByPointId: (pointId) => get().logs.filter(l => l.pointId === pointId),

  getStreets: () => {
    const streets = new Set(get().points.map(p => p.street));
    return Array.from(streets).sort();
  },

  getStats: () => {
    const { points } = get();
    return {
      total: points.length,
      confirmed: points.filter(p => p.status === PointStatus.CONFIRMED).length,
      pending: points.filter(p => p.status === PointStatus.PENDING).length,
      conflict: points.filter(p => p.status === PointStatus.CONFLICT).length,
      pendingReview: points.filter(p => 
        p.status === PointStatus.PENDING || p.status === PointStatus.CONFLICT
      ).length,
    };
  },

  addSourceData: async (sourceData) => {
    const { points, operator } = get();
    const candidates = engine.findMergeCandidates(sourceData, points);
    
    let targetPoint: GarbagePoint;
    let candidate: MergeCandidate | undefined;
    
    if (candidates.length > 0) {
      candidate = candidates[0];
      if (engine.shouldAutoMerge(candidate)) {
        targetPoint = engine.mergeSourceToPoint(candidate.targetPoint, sourceData, candidate.confidence, operator);
        sourceData.pointId = targetPoint.id;
        
        await db.transaction('rw', ['points', 'sources'], async () => {
          await db.points.put(targetPoint);
          await db.sources.put({ ...sourceData, pointId: targetPoint.id });
        });
        
        get().addLog({
          pointId: targetPoint.id,
          action: 'merge',
          operator,
          detail: `自动归并「${sourceData.sourceName}」到「${targetPoint.canonicalName}」`,
          evidence: candidate.reason,
        });
      } else {
        targetPoint = engine.mergeSourceToPoint(candidate.targetPoint, sourceData, candidate.confidence, operator);
        sourceData.pointId = targetPoint.id;
        
        await db.transaction('rw', ['points', 'sources'], async () => {
          await db.points.put(targetPoint);
          await db.sources.put({ ...sourceData, pointId: targetPoint.id });
        });
        
        get().addLog({
          pointId: targetPoint.id,
          action: 'merge',
          operator,
          detail: `待复核归并「${sourceData.sourceName}」到「${targetPoint.canonicalName}」`,
          evidence: candidate.reason,
        });
      }
    } else {
      targetPoint = engine.createNewPointFromSource(sourceData, operator);
      sourceData.pointId = targetPoint.id;
      
      await db.transaction('rw', 'points', 'sources', async () => {
        await db.points.add(targetPoint);
        await db.sources.put({ ...sourceData, pointId: targetPoint.id });
      });
      
      get().addLog({
        pointId: targetPoint.id,
        action: 'import',
        operator,
        detail: `创建新点位：${targetPoint.canonicalName}`,
        evidence: `来源：${sourceData.sourceType}`,
      });
    }
    
    const updatedPoints = await db.points.orderBy('updatedAt').reverse().toArray();
    for (const p of updatedPoints) {
      p.sources = await db.sources.where('pointId').equals(p.id).toArray();
    }
    set({ points: updatedPoints });
    
    return { point: targetPoint, candidate };
  },

  importSourceDataBatch: async (sourceDataList) => {
    let autoMerged = 0;
    let pendingReview = 0;
    let newPoints = 0;
    
    for (const sourceData of sourceDataList) {
      const result = await get().addSourceData(sourceData);
      if (result.candidate) {
        if (engine.shouldAutoMerge(result.candidate)) {
          autoMerged++;
        } else {
          pendingReview++;
        }
      } else {
        newPoints++;
      }
    }
    
    return {
      autoMerged,
      pendingReview,
      newPoints,
      total: sourceDataList.length,
    };
  },

  confirmMerge: async (pointId, sourceId, reason) => {
    const { points, operator } = get();
    const point = points.find(p => p.id === pointId);
    if (!point) return;
    
    const source = point.sources.find(s => s.id === sourceId);
    if (!source) return;
    
    const updatedPoint = engine.confirmPoint(point, operator, reason);
    
    await db.points.put(updatedPoint);
    
    get().addLog({
      pointId,
      action: 'confirm',
      operator,
      detail: `人工确认归并：${source.sourceName}`,
      evidence: reason || '人工审核通过',
    });
    
    const updatedPoints = await db.points.orderBy('updatedAt').reverse().toArray();
    for (const p of updatedPoints) {
      p.sources = await db.sources.where('pointId').equals(p.id).toArray();
    }
    set({ points: updatedPoints });
  },

  rejectMerge: async (pointId, sourceId, reason) => {
    const { points, operator } = get();
    const point = points.find(p => p.id === pointId);
    if (!point) return;
    
    const source = point.sources.find(s => s.id === sourceId);
    if (!source) return;
    
    const updatedPoint = engine.rejectMerge(point, source, operator, reason);
    
    await db.transaction('rw', db.points, db.sources, async () => {
      await db.points.put(updatedPoint);
      await db.sources.delete(sourceId);
    });
    
    get().addLog({
      pointId,
      action: 'reject',
      operator,
      detail: `驳回归并：${source.sourceName}`,
      evidence: reason,
    });
    
    const updatedPoints = await db.points.orderBy('updatedAt').reverse().toArray();
    for (const p of updatedPoints) {
      p.sources = await db.sources.where('pointId').equals(p.id).toArray();
    }
    set({ points: updatedPoints });
  },

  createNewPointFromSource: async (sourceId) => {
    const { points, operator } = get();
    let sourceData: SourceData | undefined;
    
    for (const point of points) {
      sourceData = point.sources.find(s => s.id === sourceId);
      if (sourceData) break;
    }
    
    if (!sourceData) {
      throw new Error('Source data not found');
    }
    
    const newPoint = engine.createNewPointFromSource(sourceData, operator);
    sourceData.pointId = newPoint.id;
    
    await db.transaction('rw', db.points, db.sources, async () => {
      await db.points.add(newPoint);
      await db.sources.put({ ...sourceData, pointId: newPoint.id });
    });
    
    get().addLog({
      pointId: newPoint.id,
      action: 'import',
      operator,
      detail: `作为新点位：${newPoint.canonicalName}`,
      evidence: '人工判定为独立点位',
    });
    
    const updatedPoints = await db.points.orderBy('updatedAt').reverse().toArray();
    for (const p of updatedPoints) {
      p.sources = await db.sources.where('pointId').equals(p.id).toArray();
    }
    set({ points: updatedPoints });
    
    return newPoint;
  },

  splitSourceFromPoint: async (pointId, sourceId) => {
    const { points, operator } = get();
    const point = points.find(p => p.id === pointId);
    if (!point) throw new Error('Point not found');
    
    const source = point.sources.find(s => s.id === sourceId);
    if (!source) throw new Error('Source not found');
    
    const { mainPoint, newPoint } = engine.splitPoint(point, source, operator);
    source.pointId = newPoint.id;
    
    await db.transaction('rw', db.points, db.sources, async () => {
      await db.points.put(mainPoint);
      await db.points.add(newPoint);
      await db.sources.put({ ...source, pointId: newPoint.id });
    });
    
    get().addLog({
      pointId: mainPoint.id,
      action: 'split',
      operator,
      detail: `拆分来源「${source.sourceName}」为独立点位`,
      evidence: `原点位：${mainPoint.canonicalName}，新点位：${newPoint.canonicalName}`,
    });
    
    const updatedPoints = await db.points.orderBy('updatedAt').reverse().toArray();
    for (const p of updatedPoints) {
      p.sources = await db.sources.where('pointId').equals(p.id).toArray();
    }
    set({ points: updatedPoints });
    
    return { mainPoint, newPoint };
  },

  confirmPoint: async (pointId, reason) => {
    const { points, operator } = get();
    const point = points.find(p => p.id === pointId);
    if (!point) return;
    
    const updatedPoint = engine.confirmPoint(point, operator, reason);
    await db.points.put(updatedPoint);
    
    get().addLog({
      pointId,
      action: 'confirm',
      operator,
      detail: `确认点位：${point.canonicalName}`,
      evidence: reason || '人工审核通过',
    });
    
    const updatedPoints = await db.points.orderBy('updatedAt').reverse().toArray();
    for (const p of updatedPoints) {
      p.sources = await db.sources.where('pointId').equals(p.id).toArray();
    }
    set({ points: updatedPoints });
  },

  addLog: async (log) => {
    const newLog: OperationLog = {
      ...log,
      id: generateShortId(),
      timestamp: new Date(),
    };
    
    await db.logs.add(newLog);
    
    set(state => ({
      logs: [newLog, ...state.logs],
    }));
  },

  savePhoto: async (photoId, dataUrl) => {
    await db.photos.put({ id: photoId, data: dataUrl });
    set(state => ({
      photos: { ...state.photos, [photoId]: dataUrl },
    }));
  },

  getPhotoUrl: (photoId) => {
    return get().photos[photoId];
  },
}));
