export type AnomalyType =
  | 'price_misalignment'
  | 'duplicate_cancellation'
  | 'time_grain_chaos'
  | 'null_value'
  | 'duplicate_entry'
  | 'boundary_extreme'
  | 'time_reversal'
  | 'missing_snapshot';

export type AnomalySeverity = 1 | 2 | 3 | 4 | 5;

export interface AnomalyDataPoint {
  timestamp?: number;
  price?: number;
  level?: number;
  value?: number;
  expected?: number;
  snapshotId?: string;
  levelId?: string;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  impact: string;
  recommendation: string;
  dataPoint: AnomalyDataPoint;
  detectedAt: number;
  snapshotIndex: number;
  timestamp: number;
  level?: number;
  side?: 'bid' | 'ask' | 'both';
  suggestions?: string[];
  rawData?: unknown;
}

export interface AnomalyDetectionConfig {
  priceMisalignmentThreshold: number;
  duplicateCancellationWindow: number;
  duplicateCancellationCount: number;
  timeGrainStdDevThreshold: number;
  missingSnapshotThreshold: number;
  outlierSigma: number;
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  stats: {
    total: number;
    byType: Record<AnomalyType, number>;
    bySeverity: Record<AnomalySeverity, number>;
  };
}

export const ANOMALY_TYPE_NAMES: Record<AnomalyType, string> = {
  price_misalignment: '档位错位',
  duplicate_cancellation: '撤单重复',
  time_grain_chaos: '时间粒度混乱',
  null_value: '空值数据',
  duplicate_entry: '重复项',
  boundary_extreme: '边界极值',
  time_reversal: '时间倒流',
  missing_snapshot: '数据缺失',
};

export const ANOMALY_TYPE_COLORS: Record<AnomalyType, string> = {
  price_misalignment: '#ff6b6b',
  duplicate_cancellation: '#ffa502',
  time_grain_chaos: '#ff4757',
  null_value: '#a55eea',
  duplicate_entry: '#ff7f50',
  boundary_extreme: '#ff3838',
  time_reversal: '#c0392b',
  missing_snapshot: '#e74c3c',
};

export const ANOMALY_DESCRIPTIONS: Record<AnomalyType, { pattern: string; impact: string; recommendation: string }> = {
  price_misalignment: {
    pattern: '相邻档位价差偏离理论值超过阈值，可能存在价格跳空或档位缺失',
    impact: '导致深度计算偏差，影响策略下单精度，可能产生滑点损失',
    recommendation: '检查数据源是否有档位遗漏，考虑对错位档位进行插值补全',
  },
  duplicate_cancellation: {
    pattern: '同一价格档位在短时间内频繁撤单后重挂，可能存在幌骗行为',
    impact: '制造虚假流动性假象，误导盘口深度判断，属于异常交易行为',
    recommendation: '标记该时段为高风险期，建议风控部门介入调查',
  },
  time_grain_chaos: {
    pattern: '快照时间间隔标准差过大，数据采集频率不稳定',
    impact: '破坏时间序列连续性，影响时序分析和回测结果的准确性',
    recommendation: '检查数据采集系统，考虑对时间序列进行重采样',
  },
  null_value: {
    pattern: '关键字段存在空值或NaN，数据完整性受损',
    impact: '可能导致计算错误或程序崩溃，影响分析结果可靠性',
    recommendation: '使用插值法填充或标记后跳过，检查数据采集逻辑',
  },
  duplicate_entry: {
    pattern: '存在完全相同的重复记录，数据去重不彻底',
    impact: '导致统计指标失真，成交量、挂单量等被重复计算',
    recommendation: '保留最新记录并删除重复项，检查数据入库逻辑',
  },
  boundary_extreme: {
    pattern: '数值超出3σ正态分布范围，属于极端异常值',
    impact: '可能扭曲统计分析结果，导致模型训练偏差',
    recommendation: '验证数据真实性，如为真实极值则保留并标记，否则修正',
  },
  time_reversal: {
    pattern: '时间戳不递增，出现时间倒流现象',
    impact: '破坏时间序列因果关系，导致回放和分析逻辑混乱',
    recommendation: '按时间戳重新排序，检查数据采集和传输时序',
  },
  missing_snapshot: {
    pattern: '快照间隔超过预期的3倍，存在数据丢失',
    impact: '导致盘口演化连续性中断，可能遗漏关键行情变化',
    recommendation: '检查数据采集系统稳定性，考虑插值补全缺失时段',
  },
};
