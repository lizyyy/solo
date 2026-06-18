import { create } from 'zustand';
import type { Annotation, AuditTrail, BleachingSeverity, AnnotationStatus } from '@/shared/types';
import { seedAnnotations, seedAuditTrails } from '@/data/seedData';

interface AnnotationState {
  annotations: Annotation[];
  auditTrails: AuditTrail[];
  activeId: string | null;
  filterStatus: AnnotationStatus | '全部';
  getAnnotation: (id: string) => Annotation | undefined;
  getAuditTrails: (annotationId: string) => AuditTrail[];
  setActiveId: (id: string | null) => void;
  setFilterStatus: (s: AnnotationStatus | '全部') => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  addAuditTrail: (trail: Omit<AuditTrail, 'id' | 'timestamp'>) => void;
  reviseSeverity: (
    id: string,
    oldSeverity: BleachingSeverity,
    newSeverity: BleachingSeverity,
    newBleachingArea: number,
    newSceneLabel: string,
    newSideNote: string,
    reason: string,
    operator: string,
    anchor?: string,
  ) => void;
  supplementRecord: (
    id: string,
    patch: Partial<Annotation>,
    reason: string,
    operator: string,
  ) => void;
  computeStatistics: () => {
    total: number;
    normalCount: number;
    supplementCount: number;
    anomalyCount: number;
    cloudCount: number;
    avgBleachingRate: number;
    totalBleachingArea: number;
    totalValidArea: number;
  };
}

const STORAGE_KEY = 'coral-annotation-store-v1';

const loadFromStorage = (): { annotations: Annotation[]; auditTrails: AuditTrail[] } | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveToStorage = (annotations: Annotation[], auditTrails: AuditTrail[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ annotations, auditTrails }));
  } catch {
    /* ignore */
  }
};

const initial = loadFromStorage();

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  annotations: initial?.annotations ?? seedAnnotations,
  auditTrails: initial?.auditTrails ?? seedAuditTrails,
  activeId: null,
  filterStatus: '全部',

  getAnnotation: (id) => get().annotations.find((a) => a.id === id),
  getAuditTrails: (annotationId) =>
    get()
      .auditTrails.filter((t) => t.annotationId === annotationId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),

  setActiveId: (id) => set({ activeId: id }),
  setFilterStatus: (s) => set({ filterStatus: s }),

  updateAnnotation: (id, patch) => {
    set((state) => {
      const annotations = state.annotations.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a,
      );
      saveToStorage(annotations, state.auditTrails);
      return { annotations };
    });
  },

  addAuditTrail: (trail) => {
    set((state) => {
      const newTrail: AuditTrail = {
        ...trail,
        id: `AUDIT-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
      const auditTrails = [...state.auditTrails, newTrail];
      saveToStorage(state.annotations, auditTrails);
      return { auditTrails };
    });
  },

  reviseSeverity: (
    id,
    oldSeverity,
    newSeverity,
    newBleachingArea,
    newSceneLabel,
    newSideNote,
    reason,
    operator,
    anchor,
  ) => {
    const annotation = get().getAnnotation(id);
    if (!annotation) return;
    const oldArea = annotation.bleachingArea;
    const newStatus: AnnotationStatus = '异常';
    set((state) => {
      const annotations = state.annotations.map((a) =>
        a.id === id
          ? {
              ...a,
              severity: newSeverity,
              bleachingArea: newBleachingArea,
              sceneLabel: newSceneLabel,
              sideNote: newSideNote,
              status: newStatus,
              badDataRef: anchor ?? a.badDataRef,
              updatedAt: new Date().toISOString(),
            }
          : a,
      );
      const newTrail: AuditTrail = {
        id: `AUDIT-${Date.now()}`,
        annotationId: id,
        operator,
        action: '改判',
        fieldChanged: 'severity,bleachingArea,sceneLabel,sideNote,status',
        oldValue: `${oldSeverity},${oldArea},原场景标注,原侧边说明,正常`,
        newValue: `${newSeverity},${newBleachingArea},新场景标注,新侧边说明,异常`,
        reason,
        screenshotAnchor: anchor,
        timestamp: new Date().toISOString(),
      };
      const auditTrails = [...state.auditTrails, newTrail];
      saveToStorage(annotations, auditTrails);
      return { annotations, auditTrails };
    });
  },

  supplementRecord: (id, patch, reason, operator) => {
    set((state) => {
      const annotations = state.annotations.map((a) =>
        a.id === id
          ? { ...a, ...patch, status: '补录' as AnnotationStatus, updatedAt: new Date().toISOString() }
          : a,
      );
      const annotation = annotations.find((a) => a.id === id);
      const keys = Object.keys(patch).join(',');
      const vals = Object.values(patch).map((v) => String(v)).join(',');
      const newTrail: AuditTrail = {
        id: `AUDIT-${Date.now()}`,
        annotationId: id,
        operator,
        action: '补录',
        fieldChanged: keys,
        oldValue: '(空缺)',
        newValue: vals,
        reason,
        timestamp: new Date().toISOString(),
      };
      const auditTrails = [...state.auditTrails, newTrail];
      saveToStorage(annotations, auditTrails);
      return { annotations, auditTrails };
    });
  },

  computeStatistics: () => {
    const { annotations } = get();
    const total = annotations.length;
    const normalCount = annotations.filter((a) => a.status === '正常').length;
    const supplementCount = annotations.filter((a) => a.status === '补录').length;
    const anomalyCount = annotations.filter((a) => a.status === '异常').length;
    const cloudCount = annotations.filter((a) => a.status === '云遮挡').length;
    let totalBleachingArea = 0;
    let totalValidArea = 0;
    annotations.forEach((a) => {
      totalBleachingArea += a.bleachingArea;
      const valid = a.hasCloudCover && a.cloudMask
        ? a.totalArea - a.cloudMask.affectedArea
        : a.totalArea;
      totalValidArea += valid;
    });
    const avgBleachingRate = totalValidArea > 0 ? (totalBleachingArea / totalValidArea) * 100 : 0;
    return {
      total,
      normalCount,
      supplementCount,
      anomalyCount,
      cloudCount,
      avgBleachingRate,
      totalBleachingArea,
      totalValidArea,
    };
  },
}));
