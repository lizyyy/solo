import { create } from 'zustand';
import type {
  WorkOrder,
  FilterState,
  Statistics,
  Judgment,
  DuplicateResolutionResult,
  DuplicateWarning,
  Shift,
} from '../types';
import { mockWorkOrders } from '../utils/mockData';
import { applyFilters } from '../utils/filterEngine';
import { calculateStatistics } from '../utils/statisticsCalculator';
import { applyDuplicateAction, detectDuplicates } from '../utils/duplicateDetector';

const getCurrentShift = (): Shift => {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return 'morning';
  if (h >= 14 && h < 22) return 'afternoon';
  return 'night';
};

const STORAGE_KEY = 'elevator-workorder-store-v1';

const DEFAULT_FILTERS: FilterState = {
  dateRange: null,
  deviceNo: null,
  status: null,
  judgment: null,
  shift: null,
  priority: null,
  hasLateArrival: null,
  hitsOldTerminology: null,
};

interface WorkOrderStore {
  workOrders: WorkOrder[];
  filters: FilterState;
  selectedOrderId: string | null;
  currentUser: string;
  currentRole: 'reviewer' | 'supervisor';
  showHandoverGuide: boolean;
  duplicateWarningsFromImport: DuplicateWarning[];
  lastImportResult: DuplicateResolutionResult | null;

  get filteredWorkOrders(): WorkOrder[];
  get statistics(): Statistics;
  get abnormalQueue(): WorkOrder[];
  get sampleOrder(): WorkOrder | undefined;

  setFilters: (partial: Partial<FilterState>) => void;
  resetFilters: () => void;
  selectOrder: (id: string | null) => void;
  updateJudgment: (orderId: string, judgment: Judgment, reason?: string) => void;
  updateManualRemark: (orderId: string, remark: string) => void;
  importWorkOrders: (newOrders: WorkOrder[], actionMap?: Record<string, 'skip' | 'merge' | 'overwrite'>) => DuplicateResolutionResult;
  setRole: (role: 'reviewer' | 'supervisor') => void;
  toggleHandoverGuide: (show?: boolean) => void;
  locateSampleOrder: () => void;
  exportFilteredCSV: () => string;
  persist: () => void;
  hydrate: () => void;
  resetAll: () => void;
}

export const useWorkOrderStore = create<WorkOrderStore>((set, get) => ({
  workOrders: mockWorkOrders,
  filters: { ...DEFAULT_FILTERS },
  selectedOrderId: null,
  currentUser: '维保主管-阿敏',
  currentRole: 'supervisor',
  showHandoverGuide: true,
  duplicateWarningsFromImport: [],
  lastImportResult: null,

  get filteredWorkOrders() {
    return applyFilters(get().workOrders, get().filters);
  },
  get statistics() {
    return calculateStatistics(get().filteredWorkOrders);
  },
  get abnormalQueue() {
    return get().filteredWorkOrders.filter(o => o.judgment === 'abnormal' || o.judgment === 'pending_review');
  },
  get sampleOrder() {
    return get().workOrders.find(o => o.photos.some(p => p.hitsOldTerminology));
  },

  setFilters: (partial) =>
    set((s) => ({ filters: { ...s.filters, ...partial } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
  selectOrder: (id) => set({ selectedOrderId: id }),

  updateJudgment: (orderId, judgment, reason) => {
    const state = get();
    const { workOrders, currentUser, currentRole } = state;
    const shift = getCurrentShift();
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const updated = workOrders.map((o) => {
      if (o.id !== orderId) return o;
      const needRecord =
        currentRole === 'supervisor'
          ? true
          : o.judgment !== judgment;
      if (!needRecord) return o;
      const historyRecord = {
        id: `jh-${orderId}-${Date.now()}`,
        workOrderId: orderId,
        operator: currentUser,
        operatorRole: currentRole,
        oldJudgment: o.judgment,
        newJudgment: judgment,
        reason: reason || (currentRole === 'supervisor' ? '主管复核确认' : '审核员调整'),
        changedAt: now,
        shift,
      };
      return {
        ...o,
        judgment,
        judgmentBy: currentUser,
        judgmentAt: now,
        judgmentHistory: [...o.judgmentHistory, historyRecord],
      };
    });
    set({ workOrders: updated });
    get().persist();
  },

  updateManualRemark: (orderId, remark) => {
    const updated = get().workOrders.map((o) =>
      o.id === orderId ? { ...o, manualRemark: remark } : o
    );
    set({ workOrders: updated });
    get().persist();
  },

  importWorkOrders: (newOrders, actionMap = {}) => {
    const existing = get().workOrders;
    const warnings = detectDuplicates(existing, newOrders);
    for (const w of warnings) {
      const key = `${w.deviceNo}::${w.newOrderId}`;
      if (!(key in actionMap)) {
        actionMap[key] = w.suggestion;
      }
    }
    const { orders, result } = applyDuplicateAction(existing, newOrders, actionMap);
    set({
      workOrders: orders, duplicateWarningsFromImport: warnings, lastImportResult: result,
    });
    get().persist();
    return result;
  },

  setRole: (role) => set({ currentRole: role, currentUser: role === 'supervisor' ? '维保主管-阿敏' : '审核员-王审核' }),

  toggleHandoverGuide: (show) => set({ showHandoverGuide: typeof show === 'boolean' ? show : !get().showHandoverGuide }),

  locateSampleOrder: () => {
    const sample = get().sampleOrder;
    if (sample) {
      set({ selectedOrderId: sample.id, filters: { ...DEFAULT_FILTERS } });
    }
  },

  exportFilteredCSV: () => {
    const orders = get().filteredWorkOrders;
    const header = ['工单编号', '设备编号', '设备名称', '故障类型', '上报时间', '上报人', '优先级', '工单状态', '审核判断', '班次', '人工备注', '晚到附件数', '旧说法命中', '判断人', '判断时间'];
    const rows = orders.map(o => [
      o.orderNo, o.deviceNo, o.deviceName, o.faultType, o.reportTime, o.reporter,
      o.priority, o.status, o.judgment, o.shift,
      o.manualRemark,
      String(o.photos.filter(p => p.isLateArrival).length + o.attachments.filter(a => a.isLateArrival).length),
      o.photos.some(p => p.hitsOldTerminology) ? '是' : '否',
      o.judgmentBy || '', o.judgmentAt || '',
    ]);
    const escape = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    return [header, ...rows].map(r => r.map(escape).join(',')).join('\n');
  },

  persist: () => {
    try {
      const s = get();
      const data = { workOrders: s.workOrders, filters: s.filters, currentRole: s.currentRole, currentUser: s.currentUser };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  },

  hydrate: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.workOrders) {
        set({ workOrders: data.workOrders });
      }
      if (data.currentRole) set({ currentRole: data.currentRole });
      if (data.currentUser) set({ currentUser: data.currentUser });
    } catch {}
  },

  resetAll: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ workOrders: mockWorkOrders, filters: { ...DEFAULT_FILTERS }, selectedOrderId: null, duplicateWarningsFromImport: [], lastImportResult: null });
  },
}));
