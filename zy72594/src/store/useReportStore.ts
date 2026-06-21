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
import { generateContentFingerprint, generateId } from '../utils/hash';

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
    const fingerprint = generateContentFingerprint(name, data);
    const existingBucket = get().buckets.find(b => b.hash === fingerprint);
    
    if (existingBucket) {
      const existingReport = get().reports.find(r => r.bucketId === existingBucket.id);
      return {
        success: false,
        message: `该实验桶已存在（${existingBucket.name}），导入时间：${existingBucket.importTime}，不会重复创建报告`,
        report: existingReport,
      };
    }

    const bucketId = `bucket-${generateId()}`;
    const reportId = `report-${generateId()}`;
    const now = new Date().toLocaleString('zh-CN', { hour12: false });
    const bucketSuffix = bucketId.slice(-6);
    const sampleCount = (data.sampleCount as number) || 'N';

    const conclusion = `基于 Wilson 置信区间（α=0.05），在 ${sampleCount} 样本量下点估计置信度约 92%；检测到样本存在跨天时间窗穿越，整体指标存在约 8% 虚高，需实验平台负责人复核时间戳口径后方可确认最终结论。`;

    const newBucket: ExperimentBucket = {
      id: bucketId,
      name,
      importTime: now,
      importUser,
      hash: fingerprint,
      data,
    };

    const newReport: ConfidenceReport = {
      id: reportId,
      bucketId,
      name: `${name}-置信度校准报告`,
      status: 'pending_review',
      createTime: now,
      updateTime: now,
      currentVersion: 'v1.0',
      hasTimeWindowIssue: true,
      workflowStep: 1,
      conclusion,
    };

    const negSample1Id = `neg-${generateId()}`;
    const negSample2Id = `neg-${generateId()}`;
    const negSample3Id = `neg-${generateId()}`;

    const newNegativeSamples: NegativeSample[] = [
      {
        id: negSample1Id,
        bucketId,
        content: `样本ID: AUTO-${bucketSuffix}-001，用户点击后3秒内退出，停留时长短于阈值`,
        remark: '初步判断为误点击，建议纳入负样本',
        createTime: now,
      },
      {
        id: negSample2Id,
        bucketId,
        content: `样本ID: AUTO-${bucketSuffix}-002，曝光100次点击0次，远低于同位置平均点击率`,
        remark: '物料质量存疑，建议运营侧确认',
        createTime: now,
      },
      {
        id: negSample3Id,
        bucketId,
        content: `样本ID: AUTO-${bucketSuffix}-003，数据采集跨23:00-01:00时间窗，跨天统计导致效果虚高`,
        remark: '时间窗穿越，待实验平台复核',
        createTime: now,
      },
    ];

    const newAnomalies: AnomalySample[] = [
      {
        id: `anom-${generateId()}`,
        reportId,
        sampleId: negSample1Id,
        reason: '用户点击后3秒内退出，停留时长短于阈值（5秒），判定为误点击或无效点击',
        missingMaterials: '需要补充用户画像数据，确认是否为爬虫或测试账号',
        nextOwner: '推荐策略老唐',
        nextAction: '确认该样本是否应纳入负样本训练集',
        status: 'in_progress',
        createTime: now,
      },
      {
        id: `anom-${generateId()}`,
        reportId,
        sampleId: negSample2Id,
        reason: '曝光100次无点击，远低于同位置平均点击率（3.5%），可能为物料质量问题或冷启动偏差',
        missingMaterials: '缺少物料详情页数据、用户兴趣标签',
        nextOwner: '推荐策略老唐',
        nextAction: '协调运营团队确认物料质量，检查推荐逻辑是否匹配用户兴趣',
        status: 'open',
        createTime: now,
      },
      {
        id: `anom-${generateId()}`,
        reportId,
        sampleId: negSample3Id,
        reason: '数据采集跨天（23:00-01:00），时间窗穿越导致统计口径不一致，效果指标虚高约8%',
        missingMaterials: '需要实验平台提供按小时粒度的原始日志，确认时间戳准确性',
        nextOwner: '实验平台负责人',
        nextAction: '复核时间窗配置，确认是否需要重新统计或修正口径',
        status: 'open',
        createTime: now,
      },
    ];

    const newParams: CalculationParam[] = [
      {
        id: `param-${generateId()}`,
        reportId,
        paramName: '置信区间计算方法',
        paramValue: 'Wilson Score Interval',
        version: 'v2.0',
        tradeOffReason: '相比正态近似法，在小样本下更准确；虽然计算稍复杂，但样本量>1000时性能可接受',
        createTime: now,
      },
      {
        id: `param-${generateId()}`,
        reportId,
        paramName: '显著性水平',
        paramValue: 'α = 0.05',
        version: 'v1.0',
        tradeOffReason: '行业标准配置，平衡第一类错误与第二类错误；若需更严格可调整为0.01',
        createTime: now,
      },
      {
        id: `param-${generateId()}`,
        reportId,
        paramName: '负样本权重',
        paramValue: '0.85',
        version: 'v1.2',
        tradeOffReason: '从0.7调整至0.85，因近期误点击样本增多；需持续监控模型AUC变化，若下降则回调',
        createTime: now,
      },
    ];

    const newVersionInit: ReportVersion = {
      id: `ver-${generateId()}`,
      reportId,
      version: 'v1.0',
      remarkBefore: '',
      remarkAfter: '初始导入，置信度初步估算',
      modifyUser: '系统',
      modifyTime: now,
      diff: '创建初始版本',
    };

    const newVersionConclusion: ReportVersion = {
      id: `ver-${generateId()}`,
      reportId,
      version: 'v1.0',
      remarkBefore: '',
      remarkAfter: conclusion,
      modifyUser: '系统',
      modifyTime: now,
      diff: '校准结论',
    };

    set(state => ({
      buckets: [...state.buckets, newBucket],
      negativeSamples: [...state.negativeSamples, ...newNegativeSamples],
      reports: [...state.reports, newReport],
      versions: [...state.versions, newVersionInit, newVersionConclusion],
      anomalies: [...state.anomalies, ...newAnomalies],
      params: [...state.params, ...newParams],
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

    let statusChangeDesc = '';
    if (oldRemark === newRemark) {
      statusChangeDesc = '备注未变更';
    } else if (hasTimeWindowIssue && report.status !== 'pending_review') {
      statusChangeDesc = '状态由「正常」变为「待复核」：备注中提及时间窗/跨天问题，需实验平台负责人复核';
    } else if (hasTimeWindowIssue && report.status === 'pending_review') {
      statusChangeDesc = '状态保持「待复核」：备注中仍提及时间窗/跨天问题';
    }

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
      versions: [...state.versions, newVersion, ...(statusChangeDesc ? [{
        id: `ver-status-${generateId()}`,
        reportId,
        version: newVersionStr,
        remarkBefore: '',
        remarkAfter: statusChangeDesc,
        modifyUser: '系统',
        modifyTime: now,
        diff: '状态变化说明',
      }] : [])],
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

    const statusDesc: ReportVersion = {
      id: `ver-status-${generateId()}`,
      reportId,
      version: newVersionStr,
      remarkBefore: '',
      remarkAfter: approved
        ? '状态由「待复核」变为「已复核」：实验平台负责人确认时间窗问题无误，报告可继续流转'
        : '状态保持「待复核」：实验平台负责人驳回，需重新统计后再提交',
      modifyUser: '系统',
      modifyTime: now,
      diff: '状态变化说明',
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
      versions: [...state.versions, newVersion, statusDesc],
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
