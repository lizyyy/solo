import { create } from 'zustand';
import type {
  ExperimentBucket,
  NegativeSample,
  ConfidenceReport,
  ReportVersion,
  AnomalySample,
  CalculationParam,
} from '../types';
import {
  mockBuckets,
  mockNegativeSamples,
  mockReports,
  mockVersions,
  mockAnomalies,
  mockParams,
} from '../utils/mockData';
import { generateHash, generateId } from '../utils/hash';

interface ReportState {
  buckets: ExperimentBucket[];
  negativeSamples: NegativeSample[];
  reports: ConfidenceReport[];
  versions: ReportVersion[];
  anomalies: AnomalySample[];
  params: CalculationParam[];
  selectedReportId: string | null;
  
  importBucket: (name: string, data: Record<string, unknown>, importUser: string) => { success: boolean; message: string; report?: ConfidenceReport };
  updateRemark: (reportId: string, sampleId: string, newRemark: string, modifyUser: string) => void;
  advanceWorkflow: (reportId: string) => void;
  reviewTimeWindowIssue: (reportId: string, approved: boolean) => void;
  selectReport: (reportId: string | null) => void;
  getReportById: (reportId: string) => ConfidenceReport | undefined;
  getVersionsByReportId: (reportId: string) => ReportVersion[];
  getAnomaliesByReportId: (reportId: string) => AnomalySample[];
  getParamsByReportId: (reportId: string) => CalculationParam[];
  getNegativeSamplesByBucketId: (bucketId: string) => NegativeSample[];
  getBucketById: (bucketId: string) => ExperimentBucket | undefined;
}

export const useReportStore = create<ReportState>((set, get) => ({
  buckets: mockBuckets,
  negativeSamples: mockNegativeSamples,
  reports: mockReports,
  versions: mockVersions,
  anomalies: mockAnomalies,
  params: mockParams,
  selectedReportId: null,

  importBucket: (name, data, importUser) => {
    const hash = generateHash(data);
    const existingBucket = get().buckets.find(b => b.hash === hash);
    
    if (existingBucket) {
      const existingReport = get().reports.find(r => r.bucketId === existingBucket.id);
      return {
        success: false,
        message: `该实验桶已存在（${existingBucket.name}），导入时间：${existingBucket.importTime}`,
        report: existingReport,
      };
    }

    const bucketId = `bucket-${generateId()}`;
    const reportId = `report-${generateId()}`;
    const now = new Date().toLocaleString('zh-CN', { hour12: false });

    const newBucket: ExperimentBucket = {
      id: bucketId,
      name,
      importTime: now,
      importUser,
      hash,
      data,
    };

    const newReport: ConfidenceReport = {
      id: reportId,
      bucketId,
      name: `${name}-置信度校准报告`,
      status: 'normal',
      createTime: now,
      updateTime: now,
      currentVersion: 'v1.0',
      hasTimeWindowIssue: false,
      workflowStep: 1,
    };

    const newVersion: ReportVersion = {
      id: `ver-${generateId()}`,
      reportId,
      version: 'v1.0',
      remarkBefore: '',
      remarkAfter: '初始导入，置信度初步估算',
      modifyUser: '系统',
      modifyTime: now,
      diff: '创建初始版本',
    };

    set(state => ({
      buckets: [...state.buckets, newBucket],
      reports: [...state.reports, newReport],
      versions: [...state.versions, newVersion],
    }));

    return {
      success: true,
      message: '导入成功，已创建置信度校准报告',
      report: newReport,
    };
  },

  updateRemark: (reportId, sampleId, newRemark, modifyUser) => {
    const report = get().reports.find(r => r.id === reportId);
    if (!report) return;

    const sample = get().negativeSamples.find(s => s.id === sampleId);
    if (!sample) return;

    const oldRemark = sample.remark;
    const versionNum = parseInt(report.currentVersion.replace('v', '').split('.')[1]) + 1;
    const newVersionStr = `v1.${versionNum}`;
    const now = new Date().toLocaleString('zh-CN', { hour12: false });

    const newVersion: ReportVersion = {
      id: `ver-${generateId()}`,
      reportId,
      version: newVersionStr,
      remarkBefore: oldRemark,
      remarkAfter: newRemark,
      modifyUser,
      modifyTime: now,
      diff: `修改样本 ${sampleId} 备注`,
    };

    const hasTimeWindowIssue = newRemark.includes('时间窗') || newRemark.includes('跨天');

    set(state => ({
      negativeSamples: state.negativeSamples.map(s =>
        s.id === sampleId ? { ...s, remark: newRemark } : s
      ),
      reports: state.reports.map(r =>
        r.id === reportId
          ? {
              ...r,
              currentVersion: newVersionStr,
              updateTime: now,
              hasTimeWindowIssue: hasTimeWindowIssue || r.hasTimeWindowIssue,
              status: hasTimeWindowIssue ? 'pending_review' : r.status,
              workflowStep: Math.max(r.workflowStep, 2),
            }
          : r
      ),
      versions: [...state.versions, newVersion],
    }));
  },

  advanceWorkflow: (reportId) => {
    set(state => ({
      reports: state.reports.map(r =>
        r.id === reportId
          ? { ...r, workflowStep: Math.min(r.workflowStep + 1, 3), updateTime: new Date().toLocaleString('zh-CN', { hour12: false }) }
          : r
      ),
    }));
  },

  reviewTimeWindowIssue: (reportId, approved) => {
    const now = new Date().toLocaleString('zh-CN', { hour12: false });
    const report = get().reports.find(r => r.id === reportId);
    if (!report) return;

    const versionNum = parseInt(report.currentVersion.replace('v', '').split('.')[1]) + 1;
    const newVersionStr = `v1.${versionNum}`;

    const newVersion: ReportVersion = {
      id: `ver-${generateId()}`,
      reportId,
      version: newVersionStr,
      remarkBefore: '',
      remarkAfter: approved ? '时间窗问题已复核，确认无误' : '时间窗问题已驳回，需重新统计',
      modifyUser: '实验平台负责人',
      modifyTime: now,
      diff: approved ? '复核通过' : '复核驳回',
    };

    set(state => ({
      reports: state.reports.map(r =>
        r.id === reportId
          ? {
              ...r,
              status: approved ? 'reviewed' : 'pending_review',
              hasTimeWindowIssue: !approved,
              currentVersion: newVersionStr,
              updateTime: now,
            }
          : r
      ),
      versions: [...state.versions, newVersion],
    }));
  },

  selectReport: (reportId) => set({ selectedReportId: reportId }),

  getReportById: (reportId) => get().reports.find(r => r.id === reportId),
  getVersionsByReportId: (reportId) => get().versions.filter(v => v.reportId === reportId).sort((a, b) => a.modifyTime.localeCompare(b.modifyTime)),
  getAnomaliesByReportId: (reportId) => get().anomalies.filter(a => a.reportId === reportId),
  getParamsByReportId: (reportId) => get().params.filter(p => p.reportId === reportId),
  getNegativeSamplesByBucketId: (bucketId) => get().negativeSamples.filter(s => s.bucketId === bucketId),
  getBucketById: (bucketId) => get().buckets.find(b => b.id === bucketId),
}));
