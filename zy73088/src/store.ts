import { create } from 'zustand';
import type {
  SchemeComparisonRecord,
  ActiveTab,
  ViewPoint,
  AddMaterialPayload,
  ReplaceScreenshotPayloadUI,
  ResolvePendingPayloadUI,
  ReviseConclusionPayloadUI,
} from '@/shared/types';
import { api } from '@/lib/api';

interface WorkbenchState {
  operator: string;
  record: SchemeComparisonRecord | null;
  selectedCollisionId: string | null;
  activeTab: ActiveTab;
  showBottomPanel: boolean;
  loading: boolean;
  reconcileModal: boolean;
  reviseModal: boolean;
  setRecord: (record: SchemeComparisonRecord | null) => void;
  setOperator: (operator: string) => void;
  selectCollision: (collisionId: string | null) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setShowBottomPanel: (show: boolean) => void;
  setReconcileModal: (show: boolean) => void;
  setReviseModal: (show: boolean) => void;
  fetchRecord: (id: string) => Promise<boolean>;
  updateViewpoint: (vp: ViewPoint) => Promise<void>;
  addMaterial: (payload: AddMaterialPayload) => Promise<void>;
  addRemark: (itemId: string, content: string) => Promise<void>;
  replaceScreenshot: (
    itemId: string,
    colId: string,
    payload: ReplaceScreenshotPayloadUI
  ) => Promise<void>;
  resolvePending: (
    pendingId: string,
    payload: ResolvePendingPayloadUI
  ) => Promise<void>;
  reviseConclusion: (payload: ReviseConclusionPayloadUI) => Promise<void>;
  exportRecord: () => Promise<any>;
  createDemoRecord: () => Promise<void>;
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  operator: '施工经理阿乔',
  record: null,
  selectedCollisionId: null,
  activeTab: 'materials',
  showBottomPanel: true,
  loading: false,
  reconcileModal: false,
  reviseModal: false,

  setRecord: (record) => set({ record }),
  setOperator: (operator) => set({ operator }),
  selectCollision: (collisionId) => set({ selectedCollisionId: collisionId }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setShowBottomPanel: (show) => set({ showBottomPanel: show }),
  setReconcileModal: (show) => set({ reconcileModal: show }),
  setReviseModal: (show) => set({ reviseModal: show }),

  fetchRecord: async (id) => {
    set({ loading: true });
    try {
      const record = await api.getRecord(id);
      set({ record, loading: false });
      return true;
    } catch (error) {
      console.error('fetchRecord error:', error);
      set({ loading: false });
      return false;
    }
  },

  createDemoRecord: async () => {
    set({ loading: true });
    try {
      const { operator } = get();
      const record = await api.createRecord({
        project_name: '城东综合办公楼结构加固工程',
        project_code: 'PRJ-DEMO',
        structural_element: '四层框架柱 FZ-4',
        operator,
      });
      set({ record, loading: false });
    } catch (error) {
      console.error('createDemoRecord error:', error);
      set({ loading: false });
    }
  },

  updateViewpoint: async (vp) => {
    const { record, operator } = get();
    if (!record) return;
    try {
      const updated = await api.updateViewpoint(record.record_id, vp, operator);
      set({ record: updated });
    } catch (error) {
      console.error('updateViewpoint error:', error);
    }
  },

  addMaterial: async (payload) => {
    const { record, operator } = get();
    if (!record) return;
    try {
      const updated = await api.addMaterial(record.record_id, {
        ...payload,
        created_by: payload.created_by || operator,
        operator,
      });
      set({ record: updated });
    } catch (error) {
      console.error('addMaterial error:', error);
    }
  },

  addRemark: async (itemId, content) => {
    const { record, operator } = get();
    if (!record) return;
    try {
      const updated = await api.addRemark(
        record.record_id,
        itemId,
        content,
        operator
      );
      set({ record: updated });
    } catch (error) {
      console.error('addRemark error:', error);
    }
  },

  replaceScreenshot: async (itemId, colId, payload) => {
    const { record, operator } = get();
    if (!record) return;
    try {
      const updated = await api.replaceScreenshot(
        record.record_id,
        itemId,
        colId,
        {
          image_url: payload.image_url,
          append_to_history: payload.append,
          operator,
        }
      );
      set({ record: updated });
    } catch (error) {
      console.error('replaceScreenshot error:', error);
    }
  },

  resolvePending: async (pendingId, payload) => {
    const { record, operator } = get();
    if (!record) return;
    try {
      const updated = await api.resolvePending(
        record.record_id,
        pendingId,
        {
          keep_collision_id: payload.keep_collision_id,
          resolution: payload.resolution,
          operator,
        }
      );
      set({ record: updated });
    } catch (error) {
      console.error('resolvePending error:', error);
    }
  },

  reviseConclusion: async (payload) => {
    const { record, operator } = get();
    if (!record) return;
    try {
      const extra = payload.extra_remarks?.trim();
      const updated = await api.reviseConclusion(record.record_id, {
        new_conclusion: payload.new_conclusion,
        revise_reason: payload.revise_reason,
        new_confidence: payload.confidence,
        extra_remarks: extra
          ? [{ content: extra, operator }]
          : undefined,
        operator,
      });
      set({ record: updated });
    } catch (error) {
      console.error('reviseConclusion error:', error);
    }
  },

  exportRecord: async () => {
    const { record } = get();
    if (!record) return null;
    try {
      return await api.exportRecord(record.record_id);
    } catch (error) {
      console.error('exportRecord error:', error);
      return null;
    }
  },
}));
