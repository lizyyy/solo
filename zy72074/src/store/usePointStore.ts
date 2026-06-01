import { create } from 'zustand';
import type { Point, PointStatus, RemarkItem } from '../types';
import { samplePoints } from '../data/sampleData';
import { getLocalStorageItem, setLocalStorageItem, STORAGE_KEYS } from '../hooks/useLocalStorage';
import { generateId } from '../utils/export';

interface PointStore {
  points: Point[];
  selectedPointId: string | null;
  filteredStatus: PointStatus | 'all';
  setPoints: (points: Point[]) => void;
  addPoint: (point: Omit<Point, 'id'>) => void;
  updatePoint: (id: string, updates: Partial<Point>) => void;
  updatePointStatus: (id: string, status: PointStatus, isAnomaly: boolean) => void;
  selectPoint: (id: string | null) => void;
  addRemark: (pointId: string, remark: Omit<RemarkItem, 'id' | 'timestamp'>) => void;
  setFilteredStatus: (status: PointStatus | 'all') => void;
  getFilteredPoints: () => Point[];
  getSelectedPoint: () => Point | undefined;
  initializeFromStorage: () => void;
}

export const usePointStore = create<PointStore>((set, get) => ({
  points: samplePoints,
  selectedPointId: null,
  filteredStatus: 'all',

  setPoints: (points) => {
    set({ points });
    setLocalStorageItem(STORAGE_KEYS.POINTS, points);
  },

  addPoint: (pointData) => {
    const newPoint: Point = {
      ...pointData,
      id: generateId(),
    };
    const points = [...get().points, newPoint];
    set({ points });
    setLocalStorageItem(STORAGE_KEYS.POINTS, points);
  },

  updatePoint: (id, updates) => {
    const points = get().points.map(p =>
      p.id === id ? { ...p, ...updates } : p
    );
    set({ points });
    setLocalStorageItem(STORAGE_KEYS.POINTS, points);
  },

  updatePointStatus: (id, status, isAnomaly) => {
    const points = get().points.map(p =>
      p.id === id ? { ...p, status, isAnomaly } : p
    );
    set({ points });
    setLocalStorageItem(STORAGE_KEYS.POINTS, points);
  },

  selectPoint: (id) => {
    set({ selectedPointId: id });
  },

  addRemark: (pointId, remark) => {
    const newRemark: RemarkItem = {
      ...remark,
      id: generateId(),
      timestamp: new Date().toLocaleString('zh-CN'),
    };
    const points = get().points.map(p =>
      p.id === pointId
        ? { ...p, remarks: [...p.remarks, newRemark] }
        : p
    );
    set({ points });
    setLocalStorageItem(STORAGE_KEYS.POINTS, points);
  },

  setFilteredStatus: (status) => {
    set({ filteredStatus: status });
  },

  getFilteredPoints: () => {
    const { points, filteredStatus } = get();
    if (filteredStatus === 'all') return points;
    return points.filter(p => p.status === filteredStatus);
  },

  getSelectedPoint: () => {
    const { points, selectedPointId } = get();
    return points.find(p => p.id === selectedPointId);
  },

  initializeFromStorage: () => {
    const storedPoints = getLocalStorageItem<Point[] | null>(STORAGE_KEYS.POINTS, null);
    if (storedPoints && storedPoints.length > 0) {
      set({ points: storedPoints });
    }
  },
}));
