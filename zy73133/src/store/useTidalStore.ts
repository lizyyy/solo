import { create } from 'zustand';
import type {
  BatchResponse,
  DeltaReport,
  RemarkInput,
  RightTab,
  Stats,
  StationRecord,
  VerifyResult,
} from '@/types';
import {
  exportCsv as apiExportCsv,
  handoffVerify,
  loadSample as apiLoadSample,
  parseLogs as apiParseLogs,
  remarkReprocess,
} from '@/lib/api';

interface TidalState {
  // 核心数据
  batch_id: string;
  stations: StationRecord[];
  deltas: DeltaReport[];
  stats: Stats;
  exports: Record<string, string>;
  current_version: number;
  processed_at: string;

  // UI 状态
  selected_station_id: string | null;
  right_tab: RightTab;
  loading: boolean;
  error_msg: string;
  verify_result: VerifyResult | null;

  // Actions
  loadSample: () => Promise<void>;
  parseLogs: (text: string) => Promise<void>;
  applyRemarks: (remarks: RemarkInput[]) => Promise<void>;
  selectStation: (id: string | null) => void;
  setTab: (t: RightTab) => void;
  exportCsv: (version: '1' | '2') => void;
  runVerify: (version: '1' | '2') => Promise<void>;
  clearVerify: () => void;
  clearError: () => void;
}

const emptyStats: Stats = {
  total: 0,
  normal: 0,
  pending: 0,
  exception: 0,
  same_count: 0,
  changed_count: 0,
  still_pending: 0,
};

function applyBatch(state: TidalState, batch: BatchResponse): Partial<TidalState> {
  return {
    batch_id: batch.batch_id,
    stations: batch.stations,
    deltas: batch.deltas,
    stats: batch.stats,
    exports: batch.exports,
    processed_at: batch.processed_at,
    current_version: batch.deltas.length > 0 ? 2 : 1,
    selected_station_id:
      batch.stations.length > 0
        ? state.selected_station_id &&
          batch.stations.some((s) => s.annotation_id === state.selected_station_id)
          ? state.selected_station_id
          : batch.stations[0].annotation_id
        : null,
  };
}

export const useTidalStore = create<TidalState>((set, get) => ({
  batch_id: '',
  stations: [],
  deltas: [],
  stats: emptyStats,
  exports: {},
  current_version: 1,
  processed_at: '',
  selected_station_id: null,
  right_tab: 'scene',
  loading: false,
  error_msg: '',
  verify_result: null,

  // 加载示例
  loadSample: async () => {
    set({ loading: true, error_msg: '' });
    try {
      const batch = await apiLoadSample();
      set((s) => applyBatch(s, batch));
    } catch (e) {
      set({ error_msg: e instanceof Error ? e.message : '加载示例失败' });
    } finally {
      set({ loading: false });
    }
  },

  // 解析粘贴日志
  parseLogs: async (text: string) => {
    set({ loading: true, error_msg: '' });
    try {
      const batch = await apiParseLogs(text);
      set((s) => applyBatch(s, batch));
    } catch (e) {
      set({ error_msg: e instanceof Error ? e.message : '解析日志失败' });
    } finally {
      set({ loading: false });
    }
  },

  // 应用备注并重算
  applyRemarks: async (remarks: RemarkInput[]) => {
    const { batch_id } = get();
    if (!batch_id) {
      set({ error_msg: '没有批次可处理' });
      return;
    }
    set({ loading: true, error_msg: '' });
    try {
      const batch = await remarkReprocess(batch_id, remarks);
      set((s) => applyBatch(s, batch));
    } catch (e) {
      set({ error_msg: e instanceof Error ? e.message : '应用备注失败' });
    } finally {
      set({ loading: false });
    }
  },

  // 选中站点
  selectStation: (id: string | null) => set({ selected_station_id: id }),

  // 切换右栏 Tab
  setTab: (t: RightTab) => set({ right_tab: t }),

  // 导出 CSV
  exportCsv: (version: '1' | '2') => {
    const { batch_id } = get();
    if (!batch_id) {
      set({ error_msg: '没有批次可导出' });
      return;
    }
    try {
      apiExportCsv(batch_id, version);
    } catch (e) {
      set({ error_msg: e instanceof Error ? e.message : '导出失败' });
    }
  },

  // 运行接班验证
  runVerify: async (version: '1' | '2') => {
    const { batch_id } = get();
    if (!batch_id) {
      set({ error_msg: '没有批次可验证' });
      return;
    }
    set({ loading: true, error_msg: '' });
    try {
      const res = await handoffVerify(batch_id, version);
      set({ verify_result: res });
    } catch (e) {
      set({ error_msg: e instanceof Error ? e.message : '验证失败' });
    } finally {
      set({ loading: false });
    }
  },

  clearVerify: () => set({ verify_result: null }),
  clearError: () => set({ error_msg: '' }),
}));
