interface ExperimentBucket {
  id: string;
  name: string;
  importTime: string;
  importUser: string;
  hash: string;
  data: Record<string, unknown>;
}

interface NegativeSample {
  id: string;
  bucketId: string;
  content: string;
  remark: string;
  createTime: string;
}

type ReportStatus = 'normal' | 'pending_review' | 'reviewed';

interface ConfidenceReport {
  id: string;
  bucketId: string;
  name: string;
  status: ReportStatus;
  createTime: string;
  updateTime: string;
  currentVersion: string;
  hasTimeWindowIssue: boolean;
  workflowStep: number;
  conclusion: string;
}

interface ReportVersion {
  id: string;
  reportId: string;
  version: string;
  remarkBefore: string;
  remarkAfter: string;
  modifyUser: string;
  modifyTime: string;
  diff: string;
}

type AnomalyStatus = 'open' | 'in_progress' | 'resolved';

interface AnomalySample {
  id: string;
  reportId: string;
  sampleId: string;
  reason: string;
  missingMaterials: string;
  nextOwner: string;
  nextAction: string;
  status: AnomalyStatus;
  createTime: string;
}

interface CalculationParam {
  id: string;
  reportId: string;
  paramName: string;
  paramValue: string;
  version: string;
  tradeOffReason: string;
  createTime: string;
}

interface State {
  buckets: ExperimentBucket[];
  negativeSamples: NegativeSample[];
  reports: ConfidenceReport[];
  versions: ReportVersion[];
  anomalies: AnomalySample[];
  params: CalculationParam[];
}

function generateContentFingerprint(name: string, data: Record<string, unknown>): string {
  const stable: Record<string, unknown> = {};
  const transientKeys = new Set(['timestamp', 'importTime', 'createdAt', 'updatedAt']);
  for (const key of Object.keys(data).sort()) {
    if (!transientKeys.has(key)) {
      stable[key] = data[key];
    }
  }
  const raw = JSON.stringify({ name, ...stable });
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}


const initBuckets: ExperimentBucket[] = [
  {
    id: "bucket-001",
    name: "推荐算法A/B测试-2024Q2-实验组A",
    importTime: "2024-06-01 10:30:00",
    importUser: "推荐策略老唐",
    hash: "648822ad",
    data: { algorithm: "v2.1", sampleCount: 10000, clickRate: 0.125 },
  },
  {
    id: "bucket-002",
    name: "冷启动策略验证-对照组B",
    importTime: "2024-06-03 14:20:00",
    importUser: "推荐策略老唐",
    hash: "2baca9ea",
    data: { algorithm: "baseline", sampleCount: 8500, clickRate: 0.112 },
  },
];

const initNegativeSamples: NegativeSample[] = [
  {
    id: "neg-001",
    bucketId: "bucket-001",
    content: "样本ID: S20240601-0001，用户点击后3秒内退出，停留时长异常",
    remark: "初步判断为误点击，建议纳入负样本",
    createTime: "2024-06-01 11:00:00",
  },
  {
    id: "neg-002",
    bucketId: "bucket-001",
    content: "样本ID: S20240601-0002，曝光100次点击0次，异常低点击率",
    remark: "物料质量问题，需要运营配合确认",
    createTime: "2024-06-01 11:05:00",
  },
  {
    id: "neg-003",
    bucketId: "bucket-001",
    content: "样本ID: S20240601-0003，时间窗穿越：数据采集于23:00-01:00，跨天统计导致效果虚高",
    remark: "时间窗问题，标记待实验平台复核",
    createTime: "2024-06-01 11:10:00",
  },
];

const initReports: ConfidenceReport[] = [
  {
    id: "report-001",
    bucketId: "bucket-001",
    name: "推荐算法A/B测试-置信度校准报告",
    status: "pending_review",
    createTime: "2024-06-01 10:35:00",
    updateTime: "2024-06-02 16:40:00",
    currentVersion: "v1.2",
    hasTimeWindowIssue: true,
    workflowStep: 2,
    conclusion: "基于 Wilson 置信区间（α=0.05），在 10000 样本量下点估计置信度约 92%；因样本 S20240601-0003 存在跨天时间窗穿越，整体指标存在约 8% 虚高，需实验平台负责人复核时间戳口径后方可确认最终结论。",
  },
  {
    id: "report-002",
    bucketId: "bucket-002",
    name: "冷启动策略-置信度校准报告",
    status: "normal",
    createTime: "2024-06-03 14:25:00",
    updateTime: "2024-06-04 09:15:00",
    currentVersion: "v1.0",
    hasTimeWindowIssue: false,
    workflowStep: 3,
    conclusion: "基于 Wilson 置信区间（α=0.05），在 8500 样本量下点估计置信度约 95%，未检测到时间窗穿越或异常样本，结论可作为后续策略迭代依据。",
  },
];

const initVersions: ReportVersion[] = [
  {
    id: "ver-001",
    reportId: "report-001",
    version: "v1.0",
    remarkBefore: "",
    remarkAfter: "初始导入，置信度初步估算为95%",
    modifyUser: "系统",
    modifyTime: "2024-06-01 10:35:00",
    diff: "创建初始版本",
  },
  {
    id: "ver-002",
    reportId: "report-001",
    version: "v1.1",
    remarkBefore: "初始导入，置信度初步估算为95%",
    remarkAfter: "修正样本S20240601-0001标记，置信度调整为92%",
    modifyUser: "推荐策略老唐",
    modifyTime: "2024-06-01 15:20:00",
    diff: "调整负样本标记策略",
  },
  {
    id: "ver-003",
    reportId: "report-001",
    version: "v1.2",
    remarkBefore: "修正样本S20240601-0001标记，置信度调整为92%",
    remarkAfter: "发现时间窗穿越问题，置信度待复核后确认，当前暂定88%",
    modifyUser: "推荐策略老唐",
    modifyTime: "2024-06-02 16:40:00",
    diff: "标记时间窗穿越问题，待实验平台复核",
  },
];

const initAnomalies: AnomalySample[] = [
  {
    id: "anom-001",
    reportId: "report-001",
    sampleId: "neg-001",
    reason: "用户点击后3秒内退出，停留时长短于阈值（5秒），判定为误点击或无效点击",
    missingMaterials: "需要补充用户画像数据，确认是否为爬虫或测试账号",
    nextOwner: "推荐策略老唐",
    nextAction: "确认该样本是否应纳入负样本训练集",
    status: "in_progress",
    createTime: "2024-06-01 11:00:00",
  },
  {
    id: "anom-002",
    reportId: "report-001",
    sampleId: "neg-002",
    reason: "曝光100次无点击，远低于同位置平均点击率（3.5%），可能为物料质量问题或冷启动偏差",
    missingMaterials: "缺少物料详情页数据、用户兴趣标签",
    nextOwner: "推荐策略老唐",
    nextAction: "协调运营团队确认物料质量，检查推荐逻辑是否匹配用户兴趣",
    status: "open",
    createTime: "2024-06-01 11:05:00",
  },
  {
    id: "anom-003",
    reportId: "report-001",
    sampleId: "neg-003",
    reason: "数据采集跨天（23:00-01:00），时间窗穿越导致统计口径不一致，效果指标虚高约8%",
    missingMaterials: "需要实验平台提供按小时粒度的原始日志，确认时间戳准确性",
    nextOwner: "实验平台负责人",
    nextAction: "复核时间窗配置，确认是否需要重新统计或修正口径",
    status: "open",
    createTime: "2024-06-01 11:10:00",
  },
];

const initParams: CalculationParam[] = [
  {
    id: "param-001",
    reportId: "report-001",
    paramName: "置信区间计算方法",
    paramValue: "Wilson Score Interval",
    version: "v2.0",
    tradeOffReason: "相比正态近似法，在小样本下更准确；虽然计算稍复杂，但样本量>1000时性能可接受",
    createTime: "2024-06-01 10:35:00",
  },
  {
    id: "param-002",
    reportId: "report-001",
    paramName: "显著性水平",
    paramValue: "α = 0.05",
    version: "v1.0",
    tradeOffReason: "行业标准配置，平衡第一类错误与第二类错误；若需更严格可调整为0.01",
    createTime: "2024-06-01 10:35:00",
  },
  {
    id: "param-003",
    reportId: "report-001",
    paramName: "负样本权重",
    paramValue: "0.85",
    version: "v1.2",
    tradeOffReason: "从0.7调整至0.85，因近期误点击样本增多；需持续监控模型AUC变化，若下降则回调",
    createTime: "2024-06-02 16:40:00",
  },
];

function importBucket(
  state: State,
  name: string,
  data: Record<string, unknown>,
  importUser: string
): { state: State; success: boolean; message: string; report?: ConfidenceReport } {
  const fingerprint = generateContentFingerprint(name, data);
  const existingBucket = state.buckets.find(b => b.hash === fingerprint);

  if (existingBucket) {
    const existingReport = state.reports.find(r => r.bucketId === existingBucket.id);
    return {
      state,
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

  const newState: State = {
    buckets: [...state.buckets, newBucket],
    negativeSamples: [...state.negativeSamples, ...newNegativeSamples],
    reports: [...state.reports, newReport],
    versions: [...state.versions, newVersionInit, newVersionConclusion],
    anomalies: [...state.anomalies, ...newAnomalies],
    params: [...state.params, ...newParams],
  };

  return {
    state: newState,
    success: true,
    message: '导入成功，已创建置信度校准报告',
    report: newReport,
  };
}

function updateRemark(
  state: State,
  reportId: string,
  sampleId: string,
  newRemark: string,
  modifyUser: string
): State {
  const report = state.reports.find(r => r.id === reportId);
  if (!report) return state;

  const sample = state.negativeSamples.find(s => s.id === sampleId);
  if (!sample) return state;

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

  const extraVersions: ReportVersion[] = statusChangeDesc ? [{
    id: `ver-status-${generateId()}`,
    reportId,
    version: newVersionStr,
    remarkBefore: '',
    remarkAfter: statusChangeDesc,
    modifyUser: '系统',
    modifyTime: now,
    diff: '状态变化说明',
  }] : [];

  return {
    ...state,
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
    versions: [...state.versions, newVersion, ...extraVersions],
  };
}

function reviewTimeWindowIssue(
  state: State,
  reportId: string,
  approved: boolean
): State {
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  const report = state.reports.find(r => r.id === reportId);
  if (!report) return state;

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

  return {
    ...state,
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
  };
}

async function main() {
  const sep = '='.repeat(60);

  console.log(sep);
  console.log('步骤0：初始化');
  console.log(sep);

  let state: State = {
    buckets: [...initBuckets],
    negativeSamples: [...initNegativeSamples],
    reports: [...initReports],
    versions: [...initVersions],
    anomalies: [...initAnomalies],
    params: [...initParams],
  };

  const initialReportCount = state.reports.length;
  const initialNegSampleCount = state.negativeSamples.length;
  const initialAnomalyCount = state.anomalies.length;

  console.log(`初始报告数量: ${initialReportCount}`);
  console.log(`初始负样本数量: ${initialNegSampleCount}`);
  console.log(`初始异常样本数量: ${initialAnomalyCount}`);
  console.log();

  console.log(sep);
  console.log('步骤1：导入新的线上实验桶');
  console.log(sep);

  const importName = '全链路验证-实验桶A';
  const importData = { algorithm: 'v3.0', sampleCount: 12000, clickRate: 0.135 };

  const result1 = importBucket(state, importName, importData, '推荐策略老唐');
  state = result1.state;

  console.log(`导入结果: success=${result1.success}, message=\"${result1.message}\"`);
  console.log(`当前报告数量: ${state.reports.length}`);

  const newReport = result1.report!;
  console.log(`新报告 id: ${newReport.id}`);
  console.log(`新报告 status: ${newReport.status}`);
  console.log(`新报告 hasTimeWindowIssue: ${newReport.hasTimeWindowIssue}`);
  console.log(`新报告 workflowStep: ${newReport.workflowStep}`);
  console.log(`新报告 conclusion: ${newReport.conclusion}`);

  const newNegSamples = state.negativeSamples.filter(s => s.bucketId === newReport.bucketId);
  console.log(`新报告对应的负样本数量: ${newNegSamples.length}`);
  for (const ns of newNegSamples) {
    console.log(`  - id=${ns.id}, content=\"${ns.content}\", remark=\"${ns.remark}\"`);
  }

  const newAnomalies = state.anomalies.filter(a => a.reportId === newReport.id);
  console.log(`新报告对应的异常样本数量: ${newAnomalies.length}`);
  for (const anom of newAnomalies) {
    console.log(`  - id=${anom.id}, reason=\"${anom.reason}\", nextOwner=\"${anom.nextOwner}\", status=\"${anom.status}\"`);
  }

  const newParams = state.params.filter(p => p.reportId === newReport.id);
  console.log(`新报告对应的计算参数数量: ${newParams.length}`);

  const newVersions = state.versions.filter(v => v.reportId === newReport.id);
  console.log(`新报告对应的版本记录数量: ${newVersions.length}`);
  for (const ver of newVersions) {
    console.log(`  - version=${ver.version}, diff=\"${ver.diff}\", remarkAfter=\"${ver.remarkAfter}\"`);
  }
  console.log();


  console.log(sep);
  console.log('步骤2：重复导入同一批线上实验桶');
  console.log(sep);

  const result2 = importBucket(state, importName, importData, '推荐策略老唐');
  state = result2.state;

  console.log(`导入结果: success=${result2.success}, message="${result2.message}"`);
  console.log(`当前报告数量: ${state.reports.length}`);

  const reportCountAfterDup = state.reports.length;
  const dupCheck = reportCountAfterDup === initialReportCount + 1;
  console.log(`核对：报告数量不应增加 → ${dupCheck ? 'PASS' : 'FAIL'}`);
  console.log();

  console.log(sep);
  console.log('步骤3：推荐策略老唐补看负样本列表，修改一条备注');
  console.log(sep);

  const reportNegSamples = state.negativeSamples.filter(s => s.bucketId === newReport.bucketId);
  const thirdNegSample = reportNegSamples[2];

  console.log(`第3条负样本 id: ${thirdNegSample.id}, 当前remark: "${thirdNegSample.remark}"`);

  const newRemark = '时间窗穿越确认，已标记待实验平台负责人复核';
  state = updateRemark(state, newReport.id, thirdNegSample.id, newRemark, '推荐策略老唐');

  const updatedSample = state.negativeSamples.find(s => s.id === thirdNegSample.id)!;
  console.log(`修改后该负样本的 remark: "${updatedSample.remark}"`);

  const updatedReport = state.reports.find(r => r.id === newReport.id)!;
  console.log(`新报告的 status 变化: ${newReport.status} → ${updatedReport.status}`);

  const versionsAfterUpdate = state.versions.filter(v => v.reportId === newReport.id && v.version !== 'v1.0');
  console.log('新增的版本记录:');
  for (const ver of versionsAfterUpdate) {
    console.log(`  - remarkBefore="${ver.remarkBefore}", remarkAfter="${ver.remarkAfter}", diff="${ver.diff}"`);
  }
  console.log();

  console.log(sep);
  console.log('步骤4：打开异常样本页，查看异常样本');
  console.log(sep);

  const allAnomalies = state.anomalies.filter(a => a.reportId === newReport.id);
  for (const anom of allAnomalies) {
    console.log(`  - reason="${anom.reason}"`);
    console.log(`    missingMaterials="${anom.missingMaterials}"`);
    console.log(`    nextOwner="${anom.nextOwner}", nextAction="${anom.nextAction}", status="${anom.status}"`);
  }

  const thirdAnomaly = allAnomalies[2];
  const thirdAnomalyCheck = thirdAnomaly.nextOwner.includes('实验平台负责人');
  console.log(`核对第3条异常样本：nextOwner 包含"实验平台负责人" → ${thirdAnomalyCheck ? 'PASS' : 'FAIL'}`);
  console.log();

  console.log(sep);
  console.log('步骤5：实验平台负责人复核');
  console.log(sep);

  state = reviewTimeWindowIssue(state, newReport.id, true);

  const reviewedReport = state.reports.find(r => r.id === newReport.id)!;
  console.log(`新报告 status: ${reviewedReport.status}`);
  console.log(`新报告 hasTimeWindowIssue: ${reviewedReport.hasTimeWindowIssue}`);
  console.log(`新报告 currentVersion: ${reviewedReport.currentVersion}`);

  const latestVersions = state.versions.filter(
    v => v.reportId === newReport.id && v.version === reviewedReport.currentVersion
  );
  console.log('新增的版本记录:');
  for (const ver of latestVersions) {
    console.log(`  - version=${ver.version}, remarkAfter="${ver.remarkAfter}", diff="${ver.diff}", modifyUser="${ver.modifyUser}"`);
  }
  console.log();

  console.log(sep);
  console.log('步骤6：最终核对');
  console.log(sep);

  const fails: string[] = [];

  const check1 = state.reports.length === initialReportCount + 1;
  console.log(`核对：报告总数 = 初始数 + 1 (${initialReportCount} + 1 = ${initialReportCount + 1}, 实际=${state.reports.length}) → ${check1 ? 'PASS' : 'FAIL'}`);
  if (!check1) fails.push('报告总数 = 初始数 + 1');

  const finalReport = state.reports.find(r => r.id === newReport.id)!;
  const finalNegSamples = state.negativeSamples.filter(s => s.bucketId === finalReport.bucketId);
  const check2 = finalNegSamples.length > 0;
  console.log(`核对：新报告有负样本记录 (${finalNegSamples.length}条) → ${check2 ? 'PASS' : 'FAIL'}`);
  if (!check2) fails.push('新报告有负样本记录');

  const finalAnomalies = state.anomalies.filter(a => a.reportId === finalReport.id);
  const check3 = finalAnomalies.length > 0 && finalAnomalies.some(a => a.nextOwner === '实验平台负责人');
  console.log(`核对：新报告有异常样本记录，且包含 nextOwner="实验平台负责人" (${finalAnomalies.length}条) → ${check3 ? 'PASS' : 'FAIL'}`);
  if (!check3) fails.push('新报告有异常样本记录且包含 nextOwner=实验平台负责人');

  const finalVersions = state.versions.filter(v => v.reportId === finalReport.id);
  const check4 = finalVersions.length > 1;
  console.log(`核对：新报告有版本历史 > 1 条 (${finalVersions.length}条) → ${check4 ? 'PASS' : 'FAIL'}`);
  if (!check4) fails.push('新报告有版本历史 > 1 条');

  const check5 = !!finalReport.conclusion && finalReport.conclusion.length > 0;
  console.log(`核对：新报告有 conclusion 且不为空 ("${finalReport.conclusion}") → ${check5 ? 'PASS' : 'FAIL'}`);
  if (!check5) fails.push('新报告有 conclusion 且不为空');

  const finalParams = state.params.filter(p => p.reportId === finalReport.id);
  const check6 = finalParams.length > 0;
  console.log(`核对：新报告有计算参数且不为空 (${finalParams.length}条) → ${check6 ? 'PASS' : 'FAIL'}`);
  if (!check6) fails.push('新报告有计算参数且不为空');

  const check7 = dupCheck;
  console.log(`核对：重复导入没有增加报告数量 → ${check7 ? 'PASS' : 'FAIL'}`);
  if (!check7) fails.push('重复导入没有增加报告数量');

  console.log();
  if (fails.length === 0) {
    console.log('ALL CHECKS PASSED');
  } else {
    console.log('FAIL 项:');
    for (const f of fails) {
      console.log(`  - ${f}`);
    }
  }
}

main().catch(err => { console.error('脚本执行出错:', err); process.exit(1); });
