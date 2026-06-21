import { create } from 'zustand';
import type { Annotation, AuditTrail, BleachingSeverity, AnnotationStatus, CloudMask } from '@/shared/types';
import { seedAnnotations, seedAuditTrails } from '@/data/seedData';

interface EditWithAuditOptions {
  reason?: string;
  operator?: string;
  screenshotAnchor?: string;
  action?: '改判' | '编辑' | '补录' | '标记云遮挡';
}

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
  editWithAudit: (
    id: string,
    patch: Partial<Annotation>,
    options?: EditWithAuditOptions,
  ) => { changed: boolean; changedFields: string[] };
  markCloudCover: (
    id: string,
    cloudMask: CloudMask,
    options?: { operator?: string; reason?: string },
  ) => void;
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

  editWithAudit: (id, patch, options = {}) => {
    const annotation = get().getAnnotation(id);
    if (!annotation) return { changed: false, changedFields: [] };

    const {
      reason = '编辑更新',
      operator = '小宋',
      screenshotAnchor,
      action = '编辑',
    } = options;

    const comparableFields = [
      'severity',
      'bleachingArea',
      'sceneLabel',
      'sideNote',
      'status',
      'hasCloudCover',
      'badDataRef',
    ] as const;

    const changedFields: string[] = [];
    const oldValues: string[] = [];
    const newValues: string[] = [];

    comparableFields.forEach((field) => {
      if (field in patch) {
        const oldVal = String(annotation[field] ?? '');
        const newVal = String((patch as Record<string, unknown>)[field] ?? '');
        if (oldVal !== newVal) {
          changedFields.push(field);
          oldValues.push(oldVal.length > 40 ? oldVal.slice(0, 40) + '…' : oldVal);
          newValues.push(newVal.length > 40 ? newVal.slice(0, 40) + '…' : newVal);
        }
      }
    });

    if (changedFields.length === 0) {
      return { changed: false, changedFields: [] };
    }

    const readableReason = [
      reason,
      ``,
      `变更字段：${changedFields.join('、')}`,
      `遥感数据源：${annotation.screenshotMeta.dataSource}`,
      `轨道号：${annotation.screenshotMeta.orbitId}`,
    ].join('\n');

    set((state) => {
      const annotations = state.annotations.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a,
      );
      const newTrail: AuditTrail = {
        id: `AUDIT-${Date.now()}`,
        annotationId: id,
        operator,
        action,
        fieldChanged: changedFields.join(','),
        oldValue: oldValues.join(' | '),
        newValue: newValues.join(' | '),
        reason: readableReason,
        screenshotAnchor: screenshotAnchor ?? annotation.badDataRef ?? undefined,
        timestamp: new Date().toISOString(),
      };
      const auditTrails = [...state.auditTrails, newTrail];
      saveToStorage(annotations, auditTrails);
      return { annotations, auditTrails };
    });

    return { changed: true, changedFields };
  },

  markCloudCover: (id, cloudMask, options = {}) => {
    const annotation = get().getAnnotation(id);
    if (!annotation) return;

    const { operator = '小宋', reason = '标记云遮挡并从汇总排除' } = options;
    const affectedArea = cloudMask.affectedArea.toFixed(2);
    const validArea = (annotation.totalArea - cloudMask.affectedArea).toFixed(2);
    const oldRate = ((annotation.bleachingArea / annotation.totalArea) * 100).toFixed(2) + '%';
    const newRate = ((annotation.bleachingArea / (annotation.totalArea - cloudMask.affectedArea)) * 100).toFixed(2) + '%';

    const fullReason = [
      reason,
      ``,
      `影响范围：${affectedArea} km²`,
      `原调查面积：${annotation.totalArea.toFixed(2)} km² → 有效调查面积：${validArea} km²`,
      `原白化率：${oldRate} → 修正白化率：${newRate}`,
      `补看来源：${cloudMask.reviewSource}`,
      `遮挡说明：${cloudMask.description || '无'}`,
      `遥感对象：${annotation.screenshotMeta.dataSource} / ${annotation.screenshotMeta.orbitId}`,
      `处理方式：已从正常汇总排除，标记为云遮挡记录`,
    ].join('\n');

    const newSceneLabel = annotation.sceneLabel +
      `\n\n【云遮挡说明】影响面积${affectedArea}km²，已从白化汇总中排除。补看来源：${cloudMask.reviewSource}。`;
    const newSideNote = annotation.sideNote +
      `\n\n【云遮挡补看】${cloudMask.description} | 影响${affectedArea}km² | 补看来源：${cloudMask.reviewSource}`;

    set((state) => {
      const annotations = state.annotations.map((a) =>
        a.id === id
          ? {
              ...a,
              hasCloudCover: true,
              status: '云遮挡' as AnnotationStatus,
              cloudMask,
              sceneLabel: newSceneLabel,
              sideNote: newSideNote,
              updatedAt: new Date().toISOString(),
            }
          : a,
      );

      const trail: AuditTrail = {
        id: `AUDIT-${Date.now()}`,
        annotationId: id,
        operator,
        action: '标记云遮挡',
        fieldChanged: 'hasCloudCover,status,cloudMask,sceneLabel,sideNote',
        oldValue: `false,正常,无,${oldRate}`,
        newValue: `true,云遮挡,${affectedArea}km²,${newRate}`,
        reason: fullReason,
        screenshotAnchor: cloudMask.polygon,
        timestamp: new Date().toISOString(),
      };

      const auditTrails = [...state.auditTrails, trail];
      saveToStorage(annotations, auditTrails);
      return { annotations, auditTrails };
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
