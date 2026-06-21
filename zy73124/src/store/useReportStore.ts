import { create } from 'zustand';
import type {
  SeaReport,
  SampleBottle,
  ChangeLog,
  AbnormalRecord,
  ReportFilters,
} from '@/types';
import { storage, generateId } from '@/utils/storage';
import { mockReports, mockBottles, mockChangeLogs, mockAbnormals } from '@/data/mockData';
import { detectAllAbnormals } from '@/utils/abnormalDetector';

interface ReportState {
  reports: SeaReport[];
  bottles: SampleBottle[];
  changeLogs: ChangeLog[];
  abnormals: AbnormalRecord[];
  filters: ReportFilters;

  initData: () => void;
  setFilters: (filters: Partial<ReportFilters>) => void;
  resetFilters: () => void;

  getReportById: (id: string) => SeaReport | undefined;
  getBottlesByReportId: (reportId: string) => SampleBottle[];
  getChangeLogsByReportId: (reportId: string) => ChangeLog[];
  getAbnormalsByReportId: (reportId: string) => AbnormalRecord[];
  getAbnormalCountByReportId: (reportId: string) => number;

  addSampleBottles: (
    reportId: string,
    newBottles: Omit<SampleBottle, 'id' | 'reportId' | 'recordedAt'>[],
    reason: string,
    remark: string,
    operator: string
  ) => void;

  updateReport: (
    reportId: string,
    updates: Partial<SeaReport>,
    reason: string,
    remark: string,
    operator: string
  ) => void;

  resolveAbnormal: (abnormalId: string) => void;

  getFilteredReports: () => SeaReport[];
}

const defaultFilters: ReportFilters = {
  keyword: '',
  seaArea: '',
  status: '',
  dateRange: null,
  abnormalType: '',
  onlyAbnormal: false,
};

const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  bottles: [],
  changeLogs: [],
  abnormals: [],
  filters: defaultFilters,

  initData: () => {
    const storedReports = storage.getReports<SeaReport[]>([]);
    const storedBottles = storage.getBottles<SampleBottle[]>([]);
    const storedLogs = storage.getChangeLogs<ChangeLog[]>([]);
    const storedAbnormals = storage.getAbnormals<AbnormalRecord[]>([]);

    if (storedReports.length === 0) {
      set({
        reports: mockReports,
        bottles: mockBottles,
        changeLogs: mockChangeLogs,
        abnormals: mockAbnormals,
      });
      storage.setReports(mockReports);
      storage.setBottles(mockBottles);
      storage.setChangeLogs(mockChangeLogs);
      storage.setAbnormals(mockAbnormals);
    } else {
      set({
        reports: storedReports,
        bottles: storedBottles,
        changeLogs: storedLogs,
        abnormals: storedAbnormals,
      });
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  resetFilters: () => {
    set({ filters: defaultFilters });
  },

  getReportById: (id) => {
    return get().reports.find((r) => r.id === id);
  },

  getBottlesByReportId: (reportId) => {
    return get()
      .bottles.filter((b) => b.reportId === reportId)
      .sort((a, b) => {
        if (a.batchNo !== b.batchNo) return a.batchNo.localeCompare(b.batchNo);
        return a.sequence - b.sequence;
      });
  },

  getChangeLogsByReportId: (reportId) => {
    return get()
      .changeLogs.filter((l) => l.reportId === reportId)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  },

  getAbnormalsByReportId: (reportId) => {
    return get().abnormals.filter((a) => a.reportId === reportId);
  },

  getAbnormalCountByReportId: (reportId) => {
    return get().abnormals.filter((a) => a.reportId === reportId && a.status !== 'resolved').length;
  },

  addSampleBottles: (reportId, newBottles, reason, remark, operator) => {
    const state = get();
    const report = state.reports.find((r) => r.id === reportId);
    if (!report) return;

    const now = new Date().toISOString();
    const bottlesToAdd: SampleBottle[] = newBottles.map((b, idx) => ({
      ...b,
      id: generateId(),
      reportId,
      recordedAt: now,
      sequence: idx + 1,
    }));

    const oldBottleCount = report.bottleCount;
    const newBottleCount = oldBottleCount + bottlesToAdd.length;

    const updatedBottles = [...state.bottles, ...bottlesToAdd];

    const newStatus: SeaReport['status'] = 'partial';

    const updatedReports = state.reports.map((r) =>
      r.id === reportId
        ? { ...r, bottleCount: newBottleCount, status: newStatus, updatedAt: now }
        : r
    );

    const changeLog: ChangeLog = {
      id: generateId(),
      reportId,
      changeType: 'batch_add',
      fieldName: '采样瓶',
      oldValue: `${oldBottleCount}瓶`,
      newValue: `${newBottleCount}瓶（新增${bottlesToAdd.length}瓶）`,
      reason,
      remark,
      changedAt: now,
      operator,
    };

    const updatedChangeLogs = [...state.changeLogs, changeLog];

    const updatedReport = updatedReports.find((r) => r.id === reportId)!;
    const reportBottles = updatedBottles.filter((b) => b.reportId === reportId);
    const reportChangeLogs = updatedChangeLogs.filter((l) => l.reportId === reportId);
    const newAbnormals = detectAllAbnormals(updatedReport, reportBottles, reportChangeLogs);

    const existingAbnormals = state.abnormals.filter(
      (a) => a.reportId !== reportId || a.status === 'resolved'
    );
    const updatedAbnormals = [...existingAbnormals, ...newAbnormals];

    const hasUnresolvedAbnormal = updatedAbnormals.some(
      (a) => a.reportId === reportId && a.status !== 'resolved'
    );
    if (hasUnresolvedAbnormal) {
      const finalReports = updatedReports.map((r) =>
        r.id === reportId ? { ...r, status: 'abnormal' as const } : r
      );
      set({
        reports: finalReports,
        bottles: updatedBottles,
        changeLogs: updatedChangeLogs,
        abnormals: updatedAbnormals,
      });
      storage.setReports(finalReports);
    } else {
      set({
        reports: updatedReports,
        bottles: updatedBottles,
        changeLogs: updatedChangeLogs,
        abnormals: updatedAbnormals,
      });
      storage.setReports(updatedReports);
    }

    storage.setBottles(updatedBottles);
    storage.setChangeLogs(updatedChangeLogs);
    storage.setAbnormals(updatedAbnormals);
  },

  updateReport: (reportId, updates, reason, remark, operator) => {
    const state = get();
    const report = state.reports.find((r) => r.id === reportId);
    if (!report) return;

    const now = new Date().toISOString();
    const changeLogs: ChangeLog[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      const oldValue = String(report[key as keyof SeaReport] ?? '');
      const newValue = String(value ?? '');
      if (oldValue !== newValue) {
        changeLogs.push({
          id: generateId(),
          reportId,
          changeType: 'update',
          fieldName: key,
          oldValue,
          newValue,
          reason,
          remark,
          changedAt: now,
          operator,
        });
      }
    });

    const updatedReport = { ...report, ...updates, updatedAt: now };
    const updatedReports = state.reports.map((r) =>
      r.id === reportId ? updatedReport : r
    );
    const updatedChangeLogs = [...state.changeLogs, ...changeLogs];

    const reportBottles = state.bottles.filter((b) => b.reportId === reportId);
    const reportChangeLogs = updatedChangeLogs.filter((l) => l.reportId === reportId);
    const newAbnormals = detectAllAbnormals(updatedReport, reportBottles, reportChangeLogs);
    const existingAbnormals = state.abnormals.filter(
      (a) => a.reportId !== reportId || a.status === 'resolved'
    );
    const updatedAbnormals = [...existingAbnormals, ...newAbnormals];

    const hasUnresolvedAbnormal = updatedAbnormals.some(
      (a) => a.reportId === reportId && a.status !== 'resolved'
    );
    if (hasUnresolvedAbnormal && updatedReport.status !== 'abnormal') {
      const finalReports = updatedReports.map((r) =>
        r.id === reportId ? { ...r, status: 'abnormal' as const } : r
      );
      set({
        reports: finalReports,
        changeLogs: updatedChangeLogs,
        abnormals: updatedAbnormals,
      });
      storage.setReports(finalReports);
    } else {
      set({
        reports: updatedReports,
        changeLogs: updatedChangeLogs,
        abnormals: updatedAbnormals,
      });
      storage.setReports(updatedReports);
    }

    storage.setChangeLogs(updatedChangeLogs);
    storage.setAbnormals(updatedAbnormals);
  },

  resolveAbnormal: (abnormalId) => {
    const state = get();
    const updatedAbnormals = state.abnormals.map((a) =>
      a.id === abnormalId ? { ...a, status: 'resolved' as const } : a
    );

    const abnormal = state.abnormals.find((a) => a.id === abnormalId);
    if (abnormal) {
      const hasUnresolved = updatedAbnormals.some(
        (a) => a.reportId === abnormal.reportId && a.status !== 'resolved'
      );
      if (!hasUnresolved) {
        const updatedReports = state.reports.map((r) =>
          r.id === abnormal.reportId && r.status === 'abnormal'
            ? { ...r, status: 'partial' as const }
            : r
        );
        set({ reports: updatedReports, abnormals: updatedAbnormals });
        storage.setReports(updatedReports);
      } else {
        set({ abnormals: updatedAbnormals });
      }
    } else {
      set({ abnormals: updatedAbnormals });
    }

    storage.setAbnormals(updatedAbnormals);
  },

  getFilteredReports: () => {
    const { reports, filters, abnormals } = get();
    const { keyword, seaArea, status, dateRange, onlyAbnormal } = filters;

    return reports.filter((report) => {
      if (keyword && !report.reportNo.toLowerCase().includes(keyword.toLowerCase())) {
        return false;
      }

      if (seaArea && report.seaArea !== seaArea) {
        return false;
      }

      if (status && report.status !== status) {
        return false;
      }

      if (dateRange && dateRange[0] && dateRange[1]) {
        const reportDate = new Date(report.samplingTime).getTime();
        const startDate = new Date(dateRange[0]).getTime();
        const endDate = new Date(dateRange[1]).getTime() + 24 * 60 * 60 * 1000 - 1;
        if (reportDate < startDate || reportDate > endDate) {
          return false;
        }
      }

      if (onlyAbnormal) {
        const hasAbnormal = abnormals.some(
          (a) => a.reportId === report.id && a.status !== 'resolved'
        );
        if (!hasAbnormal) return false;
      }

      return true;
    });
  },
}));

export default useReportStore;
