import type {
  ExperimentBucket,
  NegativeSample,
  ConfidenceReport,
  ReportVersion,
  AnomalySample,
  CalculationParam,
  VisualizationDataPoint,
} from '../types';

export const mockBuckets: ExperimentBucket[] = [
  {
    id: 'bucket-001',
    name: '推荐算法A/B测试-2024Q2-实验组A',
    importTime: '2024-06-01 10:30:00',
    importUser: '推荐策略老唐',
    hash: '648822ad',
    data: { algorithm: 'v2.1', sampleCount: 10000, clickRate: 0.125 },
  },
  {
    id: 'bucket-002',
    name: '冷启动策略验证-对照组B',
    importTime: '2024-06-03 14:20:00',
    importUser: '推荐策略老唐',
    hash: '2baca9ea',
    data: { algorithm: 'baseline', sampleCount: 8500, clickRate: 0.112 },
  },
];

export const mockNegativeSamples: NegativeSample[] = [
  {
    id: 'neg-001',
    bucketId: 'bucket-001',
    content: '样本ID: S20240601-0001，用户点击后3秒内退出，停留时长异常',
    remark: '初步判断为误点击，建议纳入负样本',
    createTime: '2024-06-01 11:00:00',
  },
  {
    id: 'neg-002',
    bucketId: 'bucket-001',
    content: '样本ID: S20240601-0002，曝光100次点击0次，异常低点击率',
    remark: '物料质量问题，需要运营配合确认',
    createTime: '2024-06-01 11:05:00',
  },
  {
    id: 'neg-003',
    bucketId: 'bucket-001',
    content: '样本ID: S20240601-0003，时间窗穿越：数据采集于23:00-01:00，跨天统计导致效果虚高',
    remark: '时间窗问题，标记待实验平台复核',
    createTime: '2024-06-01 11:10:00',
  },
];

export const mockReports: ConfidenceReport[] = [
  {
    id: 'report-001',
    bucketId: 'bucket-001',
    name: '推荐算法A/B测试-置信度校准报告',
    status: 'pending_review',
    createTime: '2024-06-01 10:35:00',
    updateTime: '2024-06-02 16:40:00',
    currentVersion: 'v1.2',
    hasTimeWindowIssue: true,
    workflowStep: 2,
    conclusion: '基于 Wilson 置信区间（α=0.05），在 10000 样本量下点估计置信度约 92%；因样本 S20240601-0003 存在跨天时间窗穿越，整体指标存在约 8% 虚高，需实验平台负责人复核时间戳口径后方可确认最终结论。',
  },
  {
    id: 'report-002',
    bucketId: 'bucket-002',
    name: '冷启动策略-置信度校准报告',
    status: 'normal',
    createTime: '2024-06-03 14:25:00',
    updateTime: '2024-06-04 09:15:00',
    currentVersion: 'v1.0',
    hasTimeWindowIssue: false,
    workflowStep: 3,
    conclusion: '基于 Wilson 置信区间（α=0.05），在 8500 样本量下点估计置信度约 95%，未检测到时间窗穿越或异常样本，结论可作为后续策略迭代依据。',
  },
];

export const mockVersions: ReportVersion[] = [
  {
    id: 'ver-001',
    reportId: 'report-001',
    version: 'v1.0',
    remarkBefore: '',
    remarkAfter: '初始导入，置信度初步估算为95%',
    modifyUser: '系统',
    modifyTime: '2024-06-01 10:35:00',
    diff: '创建初始版本',
  },
  {
    id: 'ver-002',
    reportId: 'report-001',
    version: 'v1.1',
    remarkBefore: '初始导入，置信度初步估算为95%',
    remarkAfter: '修正样本S20240601-0001标记，置信度调整为92%',
    modifyUser: '推荐策略老唐',
    modifyTime: '2024-06-01 15:20:00',
    diff: '调整负样本标记策略',
  },
  {
    id: 'ver-003',
    reportId: 'report-001',
    version: 'v1.2',
    remarkBefore: '修正样本S20240601-0001标记，置信度调整为92%',
    remarkAfter: '发现时间窗穿越问题，置信度待复核后确认，当前暂定88%',
    modifyUser: '推荐策略老唐',
    modifyTime: '2024-06-02 16:40:00',
    diff: '标记时间窗穿越问题，待实验平台复核',
  },
];

export const mockAnomalies: AnomalySample[] = [
  {
    id: 'anom-001',
    reportId: 'report-001',
    sampleId: 'neg-001',
    reason: '用户点击后3秒内退出，停留时长短于阈值（5秒），判定为误点击或无效点击',
    missingMaterials: '需要补充用户画像数据，确认是否为爬虫或测试账号',
    nextOwner: '推荐策略老唐',
    nextAction: '确认该样本是否应纳入负样本训练集',
    status: 'in_progress',
    createTime: '2024-06-01 11:00:00',
  },
  {
    id: 'anom-002',
    reportId: 'report-001',
    sampleId: 'neg-002',
    reason: '曝光100次无点击，远低于同位置平均点击率（3.5%），可能为物料质量问题或冷启动偏差',
    missingMaterials: '缺少物料详情页数据、用户兴趣标签',
    nextOwner: '推荐策略老唐',
    nextAction: '协调运营团队确认物料质量，检查推荐逻辑是否匹配用户兴趣',
    status: 'open',
    createTime: '2024-06-01 11:05:00',
  },
  {
    id: 'anom-003',
    reportId: 'report-001',
    sampleId: 'neg-003',
    reason: '数据采集跨天（23:00-01:00），时间窗穿越导致统计口径不一致，效果指标虚高约8%',
    missingMaterials: '需要实验平台提供按小时粒度的原始日志，确认时间戳准确性',
    nextOwner: '实验平台负责人',
    nextAction: '复核时间窗配置，确认是否需要重新统计或修正口径',
    status: 'open',
    createTime: '2024-06-01 11:10:00',
  },
];

export const mockParams: CalculationParam[] = [
  {
    id: 'param-001',
    reportId: 'report-001',
    paramName: '置信区间计算方法',
    paramValue: 'Wilson Score Interval',
    version: 'v2.0',
    tradeOffReason: '相比正态近似法，在小样本下更准确；虽然计算稍复杂，但样本量>1000时性能可接受',
    createTime: '2024-06-01 10:35:00',
  },
  {
    id: 'param-002',
    reportId: 'report-001',
    paramName: '显著性水平',
    paramValue: 'α = 0.05',
    version: 'v1.0',
    tradeOffReason: '行业标准配置，平衡第一类错误与第二类错误；若需更严格可调整为0.01',
    createTime: '2024-06-01 10:35:00',
  },
  {
    id: 'param-003',
    reportId: 'report-001',
    paramName: '负样本权重',
    paramValue: '0.85',
    version: 'v1.2',
    tradeOffReason: '从0.7调整至0.85，因近期误点击样本增多；需持续监控模型AUC变化，若下降则回调',
    createTime: '2024-06-02 16:40:00',
  },
];

export const mockVisualizationData: VisualizationDataPoint[] = [
  { id: 'dp-001', x: 0.1, y: 0.85, z: 0.3, confidence: 0.92, label: '点击-转化', sourceType: 'bucket', sourceId: 'bucket-001' },
  { id: 'dp-002', x: 0.25, y: 0.72, z: 0.5, confidence: 0.88, label: '曝光-点击', sourceType: 'bucket', sourceId: 'bucket-001' },
  { id: 'dp-003', x: 0.4, y: 0.95, z: 0.2, confidence: 0.96, label: '收藏-转化', sourceType: 'bucket', sourceId: 'bucket-001' },
  { id: 'dp-004', x: 0.55, y: 0.68, z: 0.7, confidence: 0.75, label: '停留时长-转化', sourceType: 'bucket', sourceId: 'bucket-001', hasTimeWindowIssue: true },
  { id: 'dp-005', x: 0.7, y: 0.82, z: 0.4, confidence: 0.90, label: '加购-转化', sourceType: 'bucket', sourceId: 'bucket-001' },
  { id: 'dp-006', x: 0.15, y: 0.3, z: 0.8, confidence: 0.45, label: '负样本1', sourceType: 'negative_sample', sourceId: 'neg-001' },
  { id: 'dp-007', x: 0.35, y: 0.25, z: 0.6, confidence: 0.38, label: '负样本2', sourceType: 'negative_sample', sourceId: 'neg-002' },
  { id: 'dp-008', x: 0.6, y: 0.15, z: 0.9, confidence: 0.32, label: '负样本3(时间窗)', sourceType: 'negative_sample', sourceId: 'neg-003', hasTimeWindowIssue: true },
];
