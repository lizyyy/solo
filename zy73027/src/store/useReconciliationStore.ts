import { create } from 'zustand';
import type {
  RawRecord,
  ProcessedRecord,
  StatusFilter,
  FilterState,
  DisplayStatus,
  ReconciliationStore,
} from '../types/reconciliation';
import { mockRecords } from '../data/mockRecords';

const STATUS_MAP: Record<RawRecord['status'], DisplayStatus> = {
  confirmed: '已确认',
  pending: '待补件',
  returned: '退回',
};

const FILTER_TO_STATUS: Record<Exclude<StatusFilter, 'all'>, RawRecord['status']> = {
  confirmed: 'confirmed',
  pending: 'pending',
  returned: 'returned',
};

function normalizeWeight(raw: string): { grams: number; mixed: boolean; note: string } {
  const s = raw.trim();
  if (/^\d+(\.\d+)?g$/i.test(s)) {
    return { grams: parseFloat(s), mixed: false, note: '' };
  }
  if (/^\d+(\.\d+)?kg$/i.test(s)) {
    const val = parseFloat(s) * 1000;
    return { grams: val, mixed: true, note: 'kg → g（×1000）' };
  }
  if (/^\d+(\.\d+)?斤$/.test(s)) {
    const val = parseFloat(s) * 500;
    return { grams: val, mixed: true, note: '斤 → g（×500）' };
  }
  if (/^\d+(\.\d+)?$/.test(s)) {
    const val = parseFloat(s);
    return { grams: val, mixed: true, note: '无单位，默认按克处理' };
  }
  const numMatch = s.match(/(\d+(\.\d+)?)/);
  const fallback = numMatch ? parseFloat(numMatch[1]) : 0;
  return { grams: fallback, mixed: true, note: '格式异常，提取数字按克处理' };
}

function detectRemarkIssue(remark: string, hasFollowUp: boolean): boolean {
  const hasConclusion = /回访结论/.test(remark);
  const lostSignal = /没(人|接着|写).*(后续|查|跟进|录入)|请假.*没(人|接着)|忙.*没(写|跟)/.test(remark);
  return hasConclusion && (!hasFollowUp || lostSignal);
}

function processRecords(records: RawRecord[]): ProcessedRecord[] {
  return records.map((r) => {
    const w = normalizeWeight(r.rawWeight);
    return {
      ...r,
      normalizedWeightGrams: w.grams,
      weightUnitMixed: w.mixed,
      weightUnitNote: w.note,
      displayStatus: STATUS_MAP[r.status],
      remarkIssue: detectRemarkIssue(r.wechatRemark, r.hasFollowUp),
    };
  });
}

function applyFilters(records: ProcessedRecord[], f: FilterState): ProcessedRecord[] {
  return records.filter((r) => {
    if (f.statusFilter !== 'all' && r.status !== FILTER_TO_STATUS[f.statusFilter]) return false;
    if (f.dateFrom && r.scheduleDate < f.dateFrom) return false;
    if (f.dateTo && r.scheduleDate > f.dateTo) return false;
    if (f.ownerKeyword && !r.ownerName.toLowerCase().includes(f.ownerKeyword.toLowerCase()))
      return false;
    return true;
  }).sort((a, b) => a.scheduleDate.localeCompare(b.scheduleDate));
}

function buildSummary(result: ProcessedRecord[]) {
  const total = result.length;
  const confirmed = result.filter((r) => r.status === 'confirmed').length;
  const pending = result.filter((r) => r.status === 'pending');
  const returned = result.filter((r) => r.status === 'returned');
  const remarkIssue = result.filter((r) => r.remarkIssue);

  const missingList = pending.map((r) => ({
    name: r.ownerName,
    items: r.missingItems.split(',').map((x) => x.trim()).filter(Boolean),
  }));

  const returnedList = returned.map((r) => ({
    name: r.ownerName,
    reason: r.returnReason,
  }));

  const remarkIssueList = remarkIssue.map((r) => ({
    name: r.ownerName,
    remark: r.wechatRemark,
  }));

  return {
    totalText: `本月共对账 ${total} 条异宠温控排程记录`,
    doneText: `其中 ${confirmed} 条已确认处理完毕，${pending.length} 条缺材料待补，${returned.length} 条已退回`,
    missingList,
    returnedList,
    remarkIssueList,
  };
}

export const useReconciliationStore = create<ReconciliationStore>((set, get) => {
  const rawRecords = mockRecords;
  const processedRecords = processRecords(rawRecords);
  const filters: FilterState = {
    statusFilter: 'all',
    dateFrom: '',
    dateTo: '',
    ownerKeyword: '',
  };
  const derivedResult = applyFilters(processedRecords, filters);

  return {
    rawRecords,
    processedRecords,
    filters,
    derivedResult,
    stats: {
      total: derivedResult.length,
      confirmed: derivedResult.filter((r) => r.status === 'confirmed').length,
      pending: derivedResult.filter((r) => r.status === 'pending').length,
      returned: derivedResult.filter((r) => r.status === 'returned').length,
    },
    summary: buildSummary(derivedResult),
    setStatusFilter: (s) => {
      const next = { ...get().filters, statusFilter: s };
      const result = applyFilters(get().processedRecords, next);
      set({ filters: next, derivedResult: result, stats: makeStats(result), summary: buildSummary(result) });
    },
    setDateFrom: (d) => {
      const next = { ...get().filters, dateFrom: d };
      const result = applyFilters(get().processedRecords, next);
      set({ filters: next, derivedResult: result, stats: makeStats(result), summary: buildSummary(result) });
    },
    setDateTo: (d) => {
      const next = { ...get().filters, dateTo: d };
      const result = applyFilters(get().processedRecords, next);
      set({ filters: next, derivedResult: result, stats: makeStats(result), summary: buildSummary(result) });
    },
    setOwnerKeyword: (k) => {
      const next = { ...get().filters, ownerKeyword: k };
      const result = applyFilters(get().processedRecords, next);
      set({ filters: next, derivedResult: result, stats: makeStats(result), summary: buildSummary(result) });
    },
    resetFilters: () => {
      const next: FilterState = { statusFilter: 'all', dateFrom: '', dateTo: '', ownerKeyword: '' };
      const result = applyFilters(get().processedRecords, next);
      set({ filters: next, derivedResult: result, stats: makeStats(result), summary: buildSummary(result) });
    },
  };
});

function makeStats(result: ProcessedRecord[]) {
  return {
    total: result.length,
    confirmed: result.filter((r) => r.status === 'confirmed').length,
    pending: result.filter((r) => r.status === 'pending').length,
    returned: result.filter((r) => r.status === 'returned').length,
  };
}
