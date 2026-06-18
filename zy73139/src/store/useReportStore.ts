import { create } from 'zustand';
import {
  reportData,
  delayedRecords,
  duplicateBottles,
  tempRemarks,
  getAnomalyDetail,
} from '@/data/mockData';
import type {
  WaterQualityReport,
  DelayedRecord,
  DuplicateBottle,
  TempRemark,
  AnomalyDetail,
} from '@/types';

interface ReportState {
  report: WaterQualityReport;
  delayedRecords: DelayedRecord[];
  duplicateBottles: DuplicateBottle[];
  tempRemarks: TempRemark[];
  getAnomalyDetail: (id: string) => AnomalyDetail | null;
}

export const useReportStore = create<ReportState>(() => ({
  report: reportData,
  delayedRecords,
  duplicateBottles,
  tempRemarks,
  getAnomalyDetail,
}));
