import { create } from 'zustand';
import type {
  TeamRecord,
  ConditionLog,
  ThresholdTable,
  ScheduleRecord,
  InspectionReport,
  TraceLink,
  ScheduleWarning,
  DataSources,
} from '@/types';
import {
  mockTeamRecords,
  mockConditionLogs,
  mockThresholds,
  mockSchedules,
  mockReports,
  materialBatchInfo,
} from '@/data/mockData';
import { runSchedulingAlgorithm, buildTraceLinks, generateInspectionReport } from '@/utils/scheduling';

interface ScheduleState {
  teamRecords: TeamRecord[];
  conditionLogs: ConditionLog[];
  thresholds: ThresholdTable[];
  schedules: ScheduleRecord[];
  reports: InspectionReport[];
  selectedScheduleId: string | null;
  isScheduling: boolean;
  schedulingProgress: number;

  getTeamRecordsByBatch: (batchId: string) => TeamRecord[];
  getConditionLogsByTeamRecord: (teamRecordId: string) => ConditionLog[];
  getThresholdsByMaterialType: (materialType: string) => ThresholdTable[];
  getScheduleById: (id: string) => ScheduleRecord | undefined;
  getReportByScheduleId: (scheduleId: string) => InspectionReport | undefined;
  getMaterialBatchInfo: (batchId: string) => { name: string; type: string } | undefined;

  runScheduling: (materialBatchId: string) => Promise<ScheduleRecord>;
  selectSchedule: (id: string | null) => void;
  exportReport: (scheduleId: string) => InspectionReport;
  setSchedulingProgress: (progress: number) => void;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  teamRecords: mockTeamRecords,
  conditionLogs: mockConditionLogs,
  thresholds: mockThresholds,
  schedules: mockSchedules,
  reports: mockReports,
  selectedScheduleId: null,
  isScheduling: false,
  schedulingProgress: 0,

  getTeamRecordsByBatch: (batchId) => {
    return get().teamRecords.filter((tr) => tr.materialBatchId === batchId);
  },

  getConditionLogsByTeamRecord: (teamRecordId) => {
    return get().conditionLogs.filter((cl) => cl.teamRecordId === teamRecordId);
  },

  getThresholdsByMaterialType: (materialType) => {
    return get().thresholds.filter((th) => th.materialType === materialType);
  },

  getScheduleById: (id) => {
    return get().schedules.find((s) => s.id === id);
  },

  getReportByScheduleId: (scheduleId) => {
    return get().reports.find((r) => r.scheduleId === scheduleId);
  },

  getMaterialBatchInfo: (batchId) => {
    return materialBatchInfo[batchId];
  },

  runScheduling: async (materialBatchId) => {
    set({ isScheduling: true, schedulingProgress: 0 });

    await new Promise((resolve) => setTimeout(resolve, 300));
    set({ schedulingProgress: 20 });

    const state = get();
    const materialInfo = state.getMaterialBatchInfo(materialBatchId);
    const materialType = materialInfo?.type || '未知材料';

    const dataSources: DataSources = {
      teamRecords: state.getTeamRecordsByBatch(materialBatchId),
      conditionLogs: [],
      thresholds: state.getThresholdsByMaterialType(materialType),
    };

    dataSources.teamRecords.forEach((tr) => {
      dataSources.conditionLogs.push(...state.getConditionLogsByTeamRecord(tr.id));
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
    set({ schedulingProgress: 40 });

    const existingSchedule = state.schedules.find(
      (s) => s.materialBatchId === materialBatchId && s.status !== 'failed'
    );

    await new Promise((resolve) => setTimeout(resolve, 300));
    set({ schedulingProgress: 60 });

    const scheduleResult = runSchedulingAlgorithm(
      materialBatchId,
      materialType,
      dataSources,
      existingSchedule
    );

    await new Promise((resolve) => setTimeout(resolve, 300));
    set({ schedulingProgress: 80 });

    const traceLinks = buildTraceLinks(scheduleResult, dataSources);
    scheduleResult.traceLinks = traceLinks;

    const newSchedules = existingSchedule
      ? state.schedules.map((s) => (s.id === existingSchedule.id ? scheduleResult : s))
      : [...state.schedules, scheduleResult];

    await new Promise((resolve) => setTimeout(resolve, 200));
    set({ schedulingProgress: 100 });

    set({
      schedules: newSchedules,
      isScheduling: false,
      selectedScheduleId: scheduleResult.id,
    });

    try {
      const saved = localStorage.getItem('wind-tunnel-schedules');
      const savedSchedules = saved ? JSON.parse(saved) : [];
      const updatedSaved = existingSchedule
        ? savedSchedules.map((s: ScheduleRecord) =>
            s.id === existingSchedule.id ? scheduleResult : s
          )
        : [...savedSchedules, scheduleResult];
      localStorage.setItem('wind-tunnel-schedules', JSON.stringify(updatedSaved));
    } catch (e) {
      console.warn('Failed to persist schedule to localStorage:', e);
    }

    return scheduleResult;
  },

  selectSchedule: (id) => {
    set({ selectedScheduleId: id });
  },

  exportReport: (scheduleId) => {
    const state = get();
    const schedule = state.getScheduleById(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const existingReport = state.getReportByScheduleId(scheduleId);
    if (existingReport) {
      return existingReport;
    }

    const report = generateInspectionReport(schedule);
    set((state) => ({
      reports: [...state.reports, report],
    }));

    return report;
  },

  setSchedulingProgress: (progress) => {
    set({ schedulingProgress: progress });
  },
}));
