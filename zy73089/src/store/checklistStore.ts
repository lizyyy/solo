import { create } from 'zustand';
import type {
  Batch,
  BatchSnapshot,
  HistoryEvent,
  ModelComponent,
  SampleData,
} from '@/shared/types';
import { generateBatchId, isoNow, buildRerunBatch } from '@/utils/batchRunner';
import { resolveBatchStatus, runBatchMatching } from '@/utils/dataMatcher';

interface ChecklistState {
  batches: Record<string, Batch>;
  currentBatchId: string | null;
  visaForms: Record<string, SampleData['visaForms'][number]>;
  materialSubmissions: Record<string, SampleData['materialSubmissions'][number]>;
  modelComponents: Record<string, ModelComponent>;
  historyEvents: HistoryEvent[];
  snapshots: Record<string, BatchSnapshot>;

  createBatch: (name: string, parentId?: string | null, remark?: string) => string;
  runBatch: (batchId: string) => void;
  rerunBatch: (batchId: string, newRemark: string) => string;
  addItemRemark: (itemId: string, remark: string) => void;
  setCurrentBatchId: (id: string | null) => void;
  loadSampleData: (data: SampleData) => { batchId: string };
  importVisaForms: (list: SampleData['visaForms']) => void;
  importMaterialSubmissions: (list: SampleData['materialSubmissions']) => void;
  importModelComponents: (list: ModelComponent[]) => void;
  saveSnapshot: (snap: BatchSnapshot) => void;
  getAllBatchesSorted: () => Batch[];
}

const LS_KEY = 'structure-checklist-state-v1';

function loadPersisted(): Partial<ChecklistState> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      batches: parsed.batches || {},
      visaForms: parsed.visaForms || {},
      materialSubmissions: parsed.materialSubmissions || {},
      modelComponents: parsed.modelComponents || {},
      historyEvents: parsed.historyEvents || [],
      snapshots: parsed.snapshots || {},
      currentBatchId: parsed.currentBatchId || null,
    };
  } catch {
    return {};
  }
}

function persistSlice(state: ChecklistState) {
  try {
    const toSave = {
      batches: state.batches,
      visaForms: state.visaForms,
      materialSubmissions: state.materialSubmissions,
      modelComponents: state.modelComponents,
      historyEvents: state.historyEvents,
      snapshots: state.snapshots,
      currentBatchId: state.currentBatchId,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(toSave));
  } catch {}
}

export const useChecklistStore = create<ChecklistState>((set, get) => {
  const persisted = loadPersisted();

  const baseState: ChecklistState = {
    batches: {},
    currentBatchId: null,
    visaForms: {},
    materialSubmissions: {},
    modelComponents: {},
    historyEvents: [],
    snapshots: {},
    ...persisted,

    createBatch: (name, parentId = null, remark = '') => {
      const id = generateBatchId();
      const batch: Batch = {
        batchId: id,
        parentBatchId: parentId,
        name,
        status: 'draft',
        runType: parentId ? 'rerun' : 'first',
        createdAt: isoNow(),
        remark,
        items: [],
        issues: [],
      };
      const evt: HistoryEvent = {
        eventId: `evt-${Date.now()}`,
        batchId: id,
        timestamp: isoNow(),
        eventType: 'batch_created',
        description: parentId ? `基于 ${parentId} 创建重跑批次 ${id}` : `创建新批次 ${id}`,
      };
      set((s) => {
        const ns: ChecklistState = {
          ...s,
          batches: { ...s.batches, [id]: batch },
          currentBatchId: id,
          historyEvents: [evt, ...s.historyEvents],
        };
        persistSlice(ns);
        return ns;
      });
      return id;
    },

    runBatch: (batchId) => {
      const s = get();
      const batch = s.batches[batchId];
      if (!batch) return;
      const { items, issues } = runBatchMatching({
        batchId,
        components: s.modelComponents,
        visaForms: s.visaForms,
        materialSubmissions: s.materialSubmissions,
      });
      const newBatch: Batch = { ...batch, items, issues };
      newBatch.status = resolveBatchStatus(newBatch);
      const evt: HistoryEvent = {
        eventId: `evt-${Date.now()}-run`,
        batchId,
        timestamp: isoNow(),
        eventType: 'batch_run',
        description: `执行比对：${items.length} 个构件，${issues.length} 个疑点，状态=${newBatch.status}`,
      };
      set((state) => {
        const ns: ChecklistState = {
          ...state,
          batches: { ...state.batches, [batchId]: newBatch },
          historyEvents: [evt, ...state.historyEvents],
        };
        persistSlice(ns);
        return ns;
      });
    },

    rerunBatch: (batchId, newRemark) => {
      const original = get().batches[batchId];
      if (!original) return '';
      const { batch, event } = buildRerunBatch(original, newRemark);
      batch.status = resolveBatchStatus(batch);
      set((s) => {
        const ns: ChecklistState = {
          ...s,
          batches: { ...s.batches, [batch.batchId]: batch },
          currentBatchId: batch.batchId,
          historyEvents: [event, ...s.historyEvents],
        };
        persistSlice(ns);
        return ns;
      });
      return batch.batchId;
    },

    addItemRemark: (itemId, remark) => {
      set((s) => {
        const newBatches = { ...s.batches };
        Object.keys(newBatches).forEach((bid) => {
          const b = newBatches[bid];
          const idx = b.items.findIndex((it) => it.itemId === itemId);
          if (idx >= 0) {
            const newItems = b.items.slice();
            newItems[idx] = { ...newItems[idx], remarks: remark };
            newBatches[bid] = { ...b, items: newItems };
          }
        });
        const ns: ChecklistState = { ...s, batches: newBatches };
        persistSlice(ns);
        return ns;
      });
    },

    setCurrentBatchId: (id) => {
      set((s) => {
        const ns = { ...s, currentBatchId: id };
        persistSlice(ns);
        return ns;
      });
    },

    loadSampleData: (data) => {
      const visaMap: ChecklistState['visaForms'] = {};
      const matMap: ChecklistState['materialSubmissions'] = {};
      const compMap: ChecklistState['modelComponents'] = {};
      data.visaForms.forEach((v) => (visaMap[v.visaFormId] = v));
      data.materialSubmissions.forEach((m) => (matMap[m.materialId] = m));
      data.modelComponents.forEach((c) => (compMap[c.id] = c));
      let batchId = '';
      set((s) => {
        const ns: ChecklistState = {
          ...s,
          visaForms: { ...s.visaForms, ...visaMap },
          materialSubmissions: { ...s.materialSubmissions, ...matMap },
          modelComponents: { ...s.modelComponents, ...compMap },
        };
        persistSlice(ns);
        return ns;
      });
      batchId = get().createBatch('XX大厦结构加固样例批次', null, '导入样例数据包自动创建');
      get().runBatch(batchId);
      return { batchId };
    },

    importVisaForms: (list) => {
      set((s) => {
        const map: ChecklistState['visaForms'] = {};
        list.forEach((v) => (map[v.visaFormId] = v));
        const ns = { ...s, visaForms: { ...s.visaForms, ...map } };
        persistSlice(ns);
        return ns;
      });
    },

    importMaterialSubmissions: (list) => {
      set((s) => {
        const map: ChecklistState['materialSubmissions'] = {};
        list.forEach((m) => (map[m.materialId] = m));
        const ns = { ...s, materialSubmissions: { ...s.materialSubmissions, ...map } };
        persistSlice(ns);
        return ns;
      });
    },

    importModelComponents: (list) => {
      set((s) => {
        const map: ChecklistState['modelComponents'] = {};
        list.forEach((c) => (map[c.id] = c));
        const ns = { ...s, modelComponents: { ...s.modelComponents, ...map } };
        persistSlice(ns);
        return ns;
      });
    },

    saveSnapshot: (snap) => {
      set((s) => {
        const evt: HistoryEvent = {
          eventId: `evt-${Date.now()}-snap`,
          batchId: snap.batchId,
          timestamp: isoNow(),
          eventType: 'snapshot_created',
          description: `导出快照：${snap.exportFormat.toUpperCase()} 格式 (${snap.snapshotId})`,
        };
        const ns = {
          ...s,
          snapshots: { ...s.snapshots, [snap.snapshotId]: snap },
          historyEvents: [evt, ...s.historyEvents],
        };
        persistSlice(ns as ChecklistState);
        return ns;
      });
    },

    getAllBatchesSorted: () => {
      return Object.values(get().batches).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };

  return baseState;
});
