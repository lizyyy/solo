import { create } from 'zustand';
import type {
  ReviewStoreState,
  TimelineEvent,
  ReviewConclusion,
  Remark,
  MaterialItem,
  Anomaly,
  Snapshot,
  TimelineEventType,
  DiffItem,
  ReportData,
} from '@/types';
import {
  MOCK_ANOMALIES,
  MOCK_COMPONENTS,
  MOCK_CONCLUSIONS,
  MOCK_MATERIAL_NEW,
  MOCK_MATERIAL_OLD,
  MOCK_REMARKS,
  MOCK_REVISIONS,
  MOCK_TIMELINE,
} from '@/data/mockData';
import { buildInfluenceChain } from '@/utils/influenceChain';
import { computeSnapshotDiff } from '@/utils/diffEngine';

const STORAGE_KEY = 'cwr_review_store_v1';

const DEFAULT_UI = {
  openRemarkModal: false,
  openDiffModal: false,
  previousSnapshot: null,
  diffBeforeEventId: null,
  diffAfterEventId: null,
  defaultLinkedComponentId: null,
  defaultLinkedMaterialId: null,
};

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildConclusion(
  materials: MaterialItem[],
  remarks: Remark[],
  anomalies: Anomaly[],
  eventId: string,
): ReviewConclusion {
  const mismatches = materials.filter((m) => m.isMismatch);
  const hasAnomaly = anomalies.length > 0;
  const hasHoubu = remarks.some((r) => r.type === '后补' && r.affectsConclusion);
  let status: ReviewConclusion['status'] = '通过';
  if (hasAnomaly || mismatches.length > 0) status = '有条件通过';
  if (mismatches.filter((m) => !remarks.some((r) => r.linkedMaterialId === m.id && r.affectsConclusion)).length >= 2)
    status = '不通过';

  const advice: string[] = [];
  mismatches.forEach((m) => advice.push(`材料「${m.materialName}」口径不一致需确认`));
  anomalies.forEach((a) => advice.push(`${a.componentId} 存在${a.type}，建议现场复核`));
  if (hasHoubu) advice.push('后补备注涉及的变更单需归档');
  if (advice.length === 0) advice.push('所有条目一致，可放行');

  return {
    id: uid('concl'),
    timelineEventId: eventId,
    status,
    description: advice.join('；'),
    generatedAt: new Date().toISOString(),
    affectedMaterialIds: mismatches.map((m) => m.id),
    affectedRemarkIds: remarks.filter((r) => r.affectsConclusion).map((r) => r.id),
    affectedAnomalyIds: anomalies.map((a) => a.id),
  };
}

const initialState: Omit<
  ReviewStoreState,
  keyof ReturnType<typeof makeActions>
> = {
  timelineEvents: [],
  currentEventId: null,
  components: [],
  selectedComponentId: null,
  cameraTarget: null,
  materialRevisions: [],
  materialItems: [],
  activeRevisionId: null,
  remarks: [],
  anomalies: [],
  conclusions: [],
  filters: {
    eventTypes: [],
    mismatchOnly: false,
    anomalyOnly: false,
  },
  uiState: { ...DEFAULT_UI },
};

function makeActions(set: (partial: any) => void, get: () => ReviewStoreState) {
  return {
    loadMockData: () => {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      let baseState: Partial<ReviewStoreState> | null = null;
      if (saved) {
        try {
          baseState = JSON.parse(saved);
        } catch { /* ignore */ }
      }
      if (!baseState) {
        baseState = {
          components: MOCK_COMPONENTS,
          materialRevisions: MOCK_REVISIONS,
          materialItems: [...MOCK_MATERIAL_OLD, ...MOCK_MATERIAL_NEW],
          activeRevisionId: 'rev-old',
          remarks: MOCK_REMARKS,
          anomalies: MOCK_ANOMALIES,
          conclusions: MOCK_CONCLUSIONS,
          timelineEvents: MOCK_TIMELINE,
          currentEventId: MOCK_TIMELINE[MOCK_TIMELINE.length - 1].id,
          filters: { eventTypes: [], mismatchOnly: false, anomalyOnly: false },
        };
      }
      set({
        ...baseState,
        uiState: { ...DEFAULT_UI },
      });
    },

    selectComponent: (id: string | null) => set({ selectedComponentId: id }),
    setCameraTarget: (pos) => set({ cameraTarget: pos }),

    gotoTimelineEvent: (id: string) => {
      const ev = get().timelineEvents.find((e) => e.id === id);
      if (!ev) return;
      const patch: Partial<ReviewStoreState> = { currentEventId: id };
      if (ev.type === '送审表' && ev.linkedObjectId) {
        const rev = get().materialRevisions.find((r) => r.id === ev.linkedObjectId);
        if (rev) patch.activeRevisionId = rev.id;
      }
      if (ev.linkedObjectId) {
        const anom = get().anomalies.find((a) => a.id === ev.linkedObjectId);
        if (anom) {
          const cmp = get().components.find((c) => c.id === anom.componentId);
          if (cmp) {
            patch.selectedComponentId = cmp.id;
            patch.cameraTarget = { x: cmp.positionX, y: cmp.positionY, z: cmp.positionZ };
          }
        }
        const rmk = get().remarks.find((r) => r.id === ev.linkedObjectId);
        if (rmk && rmk.linkedComponentId) {
          const cmp = get().components.find((c) => c.id === rmk.linkedComponentId);
          if (cmp) {
            patch.selectedComponentId = cmp.id;
            patch.cameraTarget = { x: cmp.positionX, y: cmp.positionY, z: cmp.positionZ };
          }
        }
        const mat = get().materialItems.find((m) => m.id === ev.linkedObjectId);
        if (mat && mat.componentId) {
          const cmp = get().components.find((c) => c.id === mat.componentId);
          if (cmp) {
            patch.selectedComponentId = cmp.id;
            patch.cameraTarget = { x: cmp.positionX, y: cmp.positionY, z: cmp.positionZ };
          }
        }
      }
      set(patch);
    },

    setActiveRevision: (id: string | null) => set({ activeRevisionId: id }),

    toggleFilterType: (type: TimelineEventType) => {
      const cur = get().filters.eventTypes;
      set({
        filters: {
          ...get().filters,
          eventTypes: cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type],
        },
      });
    },
    setMismatchOnly: (v: boolean) => set({ filters: { ...get().filters, mismatchOnly: v } }),
    setAnomalyOnly: (v: boolean) => set({ filters: { ...get().filters, anomalyOnly: v } }),

    openRemark: (opts?: { linkedComponentId?: string; linkedMaterialId?: string }) => {
      get().takeSnapshot();
      set({
        uiState: {
          ...get().uiState,
          openRemarkModal: true,
          defaultLinkedComponentId: opts?.linkedComponentId ?? null,
          defaultLinkedMaterialId: opts?.linkedMaterialId ?? null,
        },
      });
    },
    closeRemark: () => set({ uiState: { ...get().uiState, openRemarkModal: false } }),

    addRemark: (remark: Omit<Remark, 'id' | 'createdAt'>) => {
      const newRemark: Remark = {
        ...remark,
        id: uid('rmk'),
        createdAt: new Date().toISOString(),
      };
      const event: TimelineEvent = {
        id: uid('evt'),
        type: '备注',
        timestamp: new Date().toISOString(),
        title: `${newRemark.type}备注：${(newRemark.content.slice(0, 12))}`,
        description: `${newRemark.author} 新增`,
        linkedObjectId: newRemark.id,
        operator: newRemark.author,
      };
      // 关联材料标记已修正
      let updatedMaterials = get().materialItems;
      if (newRemark.linkedMaterialId) {
        updatedMaterials = updatedMaterials.map((m) =>
          m.id === newRemark.linkedMaterialId
            ? { ...m, matchedRemarkId: newRemark.id }
            : m,
        );
      }
      const updatedEvents = [...get().timelineEvents, event].sort(
        (a, b) => a.timestamp.localeCompare(b.timestamp),
      );
      set({
        remarks: [...get().remarks, newRemark],
        timelineEvents: updatedEvents,
        materialItems: updatedMaterials,
        currentEventId: event.id,
        uiState: { ...get().uiState, openRemarkModal: false, diffAfterEventId: event.id },
      });
      const s = get();
      if (s.uiState.previousSnapshot) {
        set({ uiState: { ...get().uiState, openDiffModal: true } });
      }
    },

    openDiff: (beforeId: string, afterId: string) =>
      set({ uiState: { ...get().uiState, openDiffModal: true, diffBeforeEventId: beforeId, diffAfterEventId: afterId } }),
    closeDiff: () =>
      set({ uiState: { ...get().uiState, openDiffModal: false, previousSnapshot: null } }),

    takeSnapshot: () => {
      const s = get();
      const snap: Snapshot = {
        materialItems: JSON.parse(JSON.stringify(s.materialItems)),
        remarks: JSON.parse(JSON.stringify(s.remarks)),
        conclusions: JSON.parse(JSON.stringify(s.conclusions)),
        activeRevisionId: s.activeRevisionId,
      };
      set({ uiState: { ...get().uiState, previousSnapshot: snap, diffBeforeEventId: s.currentEventId } });
    },

    runReview: () => {
      get().takeSnapshot();
      const s = get();
      const activeMaterials = s.activeRevisionId
        ? s.materialItems.filter((m) => m.revisionId === s.activeRevisionId)
        : s.materialItems;
      const now = new Date().toISOString();
      const event: TimelineEvent = {
        id: uid('evt'),
        type: '复核',
        timestamp: now,
        title: '重新运行复核',
        description: '重新计算结论与影响链',
        operator: '岑（BIM协调）',
      };
      // 历史备注保留并重新对齐（reappliedAt）
      const reRemarks = s.remarks.map((r) => ({ ...r, reappliedAt: r.reappliedAt ?? now }));
      const conclusion = buildConclusion(activeMaterials, reRemarks, s.anomalies, event.id);
      event.linkedObjectId = conclusion.id;
      set({
        timelineEvents: [...s.timelineEvents, event],
        remarks: reRemarks,
        conclusions: [...s.conclusions, conclusion],
        currentEventId: event.id,
        uiState: { ...get().uiState, openDiffModal: true, diffAfterEventId: event.id },
      });
      return conclusion;
    },

    exportReport: (): ReportData => {
      const s = get();
      const latestConclusion = [...s.conclusions].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
      const chain = s.computeInfluenceChain(latestConclusion?.id);
      return {
        generatedAt: new Date().toISOString(),
        conclusion: latestConclusion,
        materialMismatches: s.materialItems.filter((m) => m.isMismatch),
        remarks: s.remarks,
        anomalies: s.anomalies,
        influenceChain: chain,
        timelineSummary: s.timelineEvents.map(
          (e) => `${new Date(e.timestamp).toLocaleString('zh-CN')} · ${e.type} · ${e.title}（${e.operator}）`,
        ),
      };
    },

    computeInfluenceChain: (conclusionId?: string) => {
      const s = get();
      const targetId =
        conclusionId ??
        [...s.conclusions].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0]?.id;
      const conclusion = s.conclusions.find((c) => c.id === targetId);
      return buildInfluenceChain(
        conclusion,
        s.materialItems,
        s.remarks,
        s.anomalies,
        s.components,
      );
    },

    computeDiff: (): DiffItem[] => {
      const s = get();
      const prev = s.uiState.previousSnapshot;
      if (!prev) return [];
      const current: Snapshot = {
        materialItems: s.materialItems,
        remarks: s.remarks,
        conclusions: s.conclusions,
        activeRevisionId: s.activeRevisionId,
      };
      return computeSnapshotDiff(prev, current);
    },

    flyToComponent: (id: string) => {
      const cmp = get().components.find((c) => c.id === id);
      if (!cmp) return;
      set({
        selectedComponentId: id,
        cameraTarget: { x: cmp.positionX, y: cmp.positionY, z: cmp.positionZ },
      });
    },
  };
}

export const useReviewStore = create<ReviewStoreState>((set, get) => ({
  ...initialState,
  ...makeActions(set, get),
}));

useReviewStore.subscribe((state) => {
  try {
    const { computeInfluenceChain, computeDiff, loadMockData, runReview, addRemark, exportReport, openRemark, closeRemark, openDiff, closeDiff, takeSnapshot, flyToComponent, gotoTimelineEvent, setActiveRevision, setCameraTarget, selectComponent, setAnomalyOnly, setMismatchOnly, toggleFilterType, ...persistable } = state;
    void computeInfluenceChain; void computeDiff; void loadMockData; void runReview; void addRemark; void exportReport;
    void openRemark; void closeRemark; void openDiff; void closeDiff; void takeSnapshot; void flyToComponent;
    void gotoTimelineEvent; void setActiveRevision; void setCameraTarget; void selectComponent;
    void setAnomalyOnly; void setMismatchOnly; void toggleFilterType;
    persistable.uiState = {
      ...persistable.uiState,
      openRemarkModal: false,
      openDiffModal: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch { /* ignore */ }
});
