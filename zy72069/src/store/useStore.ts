import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PointLocation, Scheme, SchemePoint, AnomalyRecord, PointStatus } from '@/types';
import {
  SAMPLE_POINTS,
  SAMPLE_SCHEMES,
  SAMPLE_SCHEME_POINTS,
  SAMPLE_ANOMALIES,
  DEFAULT_FILTER_STATUS,
  DEFAULT_FILTER_SOURCE,
} from '@/data/sampleData';

interface AppState {
  points: PointLocation[];
  schemes: Scheme[];
  currentSchemeId: string;
  schemePoints: SchemePoint[];
  anomalies: AnomalyRecord[];
  selectedPointId: string | null;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  filterStatus: PointStatus[];
  filterSource: string[];

  setSelectedPointId: (id: string | null) => void;
  setCameraState: (position: [number, number, number], target: [number, number, number]) => void;
  setFilterStatus: (status: PointStatus[]) => void;
  setFilterSource: (source: string[]) => void;
  setCurrentSchemeId: (id: string) => void;
  updatePointStatus: (pointId: string, status: PointStatus, processNote: string) => void;
  addScheme: (scheme: Scheme) => void;
  updateScheme: (id: string, updates: Partial<Scheme>) => void;
  deleteScheme: (id: string) => void;
  updateSchemePoint: (schemeId: string, pointId: string, updates: Partial<SchemePoint>) => void;
  addAnomaly: (anomaly: AnomalyRecord) => void;
  updateAnomaly: (id: string, updates: Partial<AnomalyRecord>) => void;
  resolveAnomaly: (id: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      points: SAMPLE_POINTS,
      schemes: SAMPLE_SCHEMES,
      currentSchemeId: 'scheme-v2',
      schemePoints: SAMPLE_SCHEME_POINTS,
      anomalies: SAMPLE_ANOMALIES,
      selectedPointId: null,
      cameraPosition: [10, 8, 10],
      cameraTarget: [0, 0, 0],
      filterStatus: DEFAULT_FILTER_STATUS,
      filterSource: DEFAULT_FILTER_SOURCE,

      setSelectedPointId: (id) => set({ selectedPointId: id }),
      setCameraState: (position, target) => set({ cameraPosition: position, cameraTarget: target }),
      setFilterStatus: (status) => set({ filterStatus: status }),
      setFilterSource: (source) => set({ filterSource: source }),
      setCurrentSchemeId: (id) => set({ currentSchemeId: id }),

      updatePointStatus: (pointId, status, processNote) =>
        set((state) => ({
          points: state.points.map((p) =>
            p.id === pointId
              ? { ...p, status, processNote, processTime: new Date().toLocaleString('zh-CN') }
              : p
          ),
        })),

      addScheme: (scheme) =>
        set((state) => ({ schemes: [...state.schemes, scheme] })),

      updateScheme: (id, updates) =>
        set((state) => ({
          schemes: state.schemes.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date().toLocaleString('zh-CN') } : s
          ),
        })),

      deleteScheme: (id) =>
        set((state) => ({
          schemes: state.schemes.filter((s) => s.id !== id),
          schemePoints: state.schemePoints.filter((sp) => sp.schemeId !== id),
          currentSchemeId: state.currentSchemeId === id ? state.schemes[0]?.id ?? '' : state.currentSchemeId,
        })),

      updateSchemePoint: (schemeId, pointId, updates) =>
        set((state) => ({
          schemePoints: state.schemePoints.some((sp) => sp.schemeId === schemeId && sp.pointId === pointId)
            ? state.schemePoints.map((sp) =>
                sp.schemeId === schemeId && sp.pointId === pointId ? { ...sp, ...updates } : sp
              )
            : [...state.schemePoints, { schemeId, pointId, overrideNote: '', overrideCoord: '', ...updates }],
        })),

      addAnomaly: (anomaly) =>
        set((state) => ({ anomalies: [...state.anomalies, anomaly] })),

      updateAnomaly: (id, updates) =>
        set((state) => ({
          anomalies: state.anomalies.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      resolveAnomaly: (id) =>
        set((state) => ({
          anomalies: state.anomalies.map((a) =>
            a.id === id ? { ...a, resolved: true, processTime: new Date().toLocaleString('zh-CN') } : a
          ),
        })),
    }),
    {
      name: 'efl-spatial-station',
      partialize: (state) => ({
        points: state.points,
        schemes: state.schemes,
        currentSchemeId: state.currentSchemeId,
        schemePoints: state.schemePoints,
        anomalies: state.anomalies,
        cameraPosition: state.cameraPosition,
        cameraTarget: state.cameraTarget,
        filterStatus: state.filterStatus,
        filterSource: state.filterSource,
      }),
    }
  )
);
