import { create } from 'zustand';
import type {
  CollisionRecord,
  CollisionStatus,
  ListFilterParams,
  RejudgePayload,
  SummaryData,
  HistoryRecord,
} from '@/types';
import { CollisionService } from '@/services/collisionService';

interface CollisionState {
  loading: boolean;
  list: CollisionRecord[];
  summary: SummaryData;
  detail: CollisionRecord | null;
  history: HistoryRecord[];
  filters: ListFilterParams;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  actions: {
    setFilters: (f: Partial<ListFilterParams>) => void;
    loadList: () => Promise<void>;
    loadDetail: (id: string) => Promise<void>;
    loadHistory: (id: string) => Promise<void>;
    rejudge: (id: string, payload: RejudgePayload) => Promise<void>;
    toggleSample: (id: string, isSample: boolean) => Promise<void>;
    exportCSV: (filters?: ListFilterParams) => Promise<void>;
    showToast: (t: CollisionState['toast']) => void;
    dismissToast: () => void;
  };
}

function statusCSVLabel(s: CollisionStatus, rejudgeCount: number): string {
  if (rejudgeCount > 0) return '人工改过';
  switch (s) {
    case 'PASSED': return '已放行';
    case 'PENDING_EVIDENCE': return '待补证据';
    case 'REJECTED': return '驳回';
    case 'MANUAL_REJUDGED': return '人工改过';
  }
}

function buildCSV(rows: CollisionRecord[]): Blob {
  const header = [
    '碰撞编号', '是否样例', '项目名称', '楼层', '节点编号', '碰撞类型',
    '构件A', '构件B', '状态分类', '改判次数', '是否坐标偏移异常', '异常说明',
    '负责人', '初判结论摘要', '创建时间', '最后修改', '历史操作摘要'
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const histSummary = r.history.map((h) => `${h.timestamp.slice(0,10)} ${h.operator}:${h.previousStatus}→${h.newStatus}`).join(' / ');
    lines.push([
      r.id,
      r.isSample ? '★样例' : '',
      esc(r.projectName),
      r.floor,
      r.nodeCode,
      esc(r.collisionType),
      esc(r.elementA),
      esc(r.elementB),
      statusCSVLabel(r.status, r.rejudgeCount),
      r.rejudgeCount,
      r.isCoordinateOffset ? '⚠️是' : '否',
      esc(r.coordinateOffsetNote || ''),
      r.responsiblePerson,
      esc(r.initialConclusion),
      r.createdAt.replace('T', ' ').slice(0, 19),
      r.updatedAt.replace('T', ' ').slice(0, 19),
      esc(histSummary),
    ].join(','));
  }
  const BOM = '\uFEFF';
  return new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const useCollisionStore = create<CollisionState>((set, get) => ({
  loading: false,
  list: [],
  summary: { total: 0, passed: 0, pendingEvidence: 0, manualRejudged: 0, coordinateOffset: 0 },
  detail: null,
  history: [],
  filters: { status: 'ALL', coordinateOffsetOnly: false },
  toast: null,

  actions: {
    setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),

    loadList: async () => {
      set({ loading: true });
      try {
        const { data, summary } = await CollisionService.list(get().filters);
        set({ list: data, summary, loading: false });
      } catch (e: any) {
        set({ loading: false });
        get().actions.showToast({ message: e.message || '加载失败', type: 'error' });
      }
    },

    loadDetail: async (id: string) => {
      set({ loading: true, detail: null });
      try {
        const d = await CollisionService.get(id);
        set({ detail: d, loading: false });
      } catch (e: any) {
        set({ loading: false });
        get().actions.showToast({ message: e.message || '加载详情失败', type: 'error' });
      }
    },

    loadHistory: async (id: string) => {
      try {
        const h = await CollisionService.getHistory(id);
        set({ history: h });
      } catch {}
    },

    rejudge: async (id: string, payload: RejudgePayload) => {
      set({ loading: true });
      try {
        const updated = await CollisionService.rejudge(id, payload);
        set((s) => ({
          detail: updated,
          list: s.list.map((c) => (c.id === id ? updated : c)),
          loading: false,
        }));
        await get().actions.loadList();
        get().actions.showToast({ message: '改判已写入，并记录历史', type: 'success' });
      } catch (e: any) {
        set({ loading: false });
        get().actions.showToast({ message: e.message || '改判失败', type: 'error' });
      }
    },

    toggleSample: async (id: string, isSample: boolean) => {
      try {
        const updated = await CollisionService.toggleSample(id, isSample);
        set((s) => ({
          detail: s.detail && s.detail.id === id ? updated : s.detail,
          list: s.list.map((c) => (c.id === id ? updated : c)),
        }));
        get().actions.showToast({
          message: isSample ? '已标记为样例' : '已取消样例标记',
          type: 'success',
        });
      } catch (e: any) {
        get().actions.showToast({ message: e.message || '操作失败', type: 'error' });
      }
    },

    exportCSV: async (filters) => {
      set({ loading: true });
      try {
        const { data } = await CollisionService.list(filters || get().filters);
        const blob = buildCSV(data);
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
        downloadBlob(blob, `幕墙节点碰撞预审明细_${stamp}.csv`);
        set({ loading: false });
        get().actions.showToast({ message: `已导出 ${data.length} 条记录`, type: 'success' });
      } catch (e: any) {
        set({ loading: false });
        get().actions.showToast({ message: e.message || '导出失败', type: 'error' });
      }
    },

    showToast: (t) => {
      set({ toast: t });
      setTimeout(() => set({ toast: null }), 2800);
    },
    dismissToast: () => set({ toast: null }),
  },
}));
