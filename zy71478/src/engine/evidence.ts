import { 
  SoundVelocityInput, 
  Anomaly, 
  CalculationResult, 
  EvidenceItem, 
  EvidenceChain,
  AuditLogEntry,
  EvidenceSource,
  EvidenceType,
} from '../types';
import { PHYSICAL_CONSTANTS, EVIDENCE_SOURCE_LABELS } from '../constants/physics';
import { generateId } from '../utils/crypto';
import { formatVelocity, formatTemperature, formatDistance, formatTime, formatPercent } from '../utils/format';

interface EvidenceContext {
  sequence: number;
  timestamp: number;
}

function createEvidence(
  type: EvidenceType,
  source: EvidenceSource,
  title: string,
  content: string,
  ctx: EvidenceContext,
  value?: number,
  unit?: string,
  anomalyId?: string,
  supports?: string[],
  contradicts?: string[]
): EvidenceItem {
  return {
    id: generateId(),
    type,
    title,
    content,
    value,
    unit,
    timestamp: ctx.timestamp,
    sequence: ctx.sequence++,
    source,
    anomalyId,
    supports,
    contradicts,
  };
}

function createAuditLog(
  action: string,
  details: Record<string, unknown>,
  ctx: EvidenceContext
): AuditLogEntry {
  return {
    id: generateId(),
    action,
    timestamp: ctx.timestamp,
    details,
    sequence: ctx.sequence++,
  };
}

function buildTemperatureEvidence(
  input: SoundVelocityInput,
  result: CalculationResult,
  ctx: EvidenceContext
): { evidence: EvidenceItem[]; auditLog: AuditLogEntry[] } {
  const evidence: EvidenceItem[] = [];
  const auditLog: AuditLogEntry[] = [];
  const effectiveTemp = input.temperature ?? PHYSICAL_CONSTANTS.DEFAULT_TEMPERATURE;

  auditLog.push(createAuditLog('温度法计算开始', { 
    input_temperature: input.temperature,
    effective_temperature: effectiveTemp,
  }, ctx));

  const tempConclusion = input.temperature === null
    ? `温度缺失，使用标准温度${PHYSICAL_CONSTANTS.DEFAULT_TEMPERATURE}℃计算，理论声速为${formatVelocity(result.theoreticalValue)}`
    : `基于温度${formatTemperature(input.temperature)}，理论声速计算为${formatVelocity(result.theoreticalValue)}`;

  evidence.push(createEvidence(
    'temperature_conclusion',
    'temperature',
    '温度法结论',
    tempConclusion,
    ctx,
    result.theoreticalValue,
    'm/s'
  ));

  auditLog.push(createAuditLog('温度法计算完成', { 
    theoretical_value: result.theoreticalValue,
    formula: 'v = 331.45 × √(1 + T/273.15)',
  }, ctx));

  return { evidence, auditLog };
}

function buildDistanceEvidence(
  input: SoundVelocityInput,
  result: CalculationResult,
  ctx: EvidenceContext
): { evidence: EvidenceItem[]; auditLog: AuditLogEntry[] } {
  const evidence: EvidenceItem[] = [];
  const auditLog: AuditLogEntry[] = [];

  if (input.distance === null || input.timeDiff === null) {
    auditLog.push(createAuditLog('测距法计算跳过', { 
      reason: 'distance or timeDiff is null',
      distance: input.distance,
      timeDiff: input.timeDiff,
    }, ctx));
    return { evidence, auditLog };
  }

  auditLog.push(createAuditLog('测距法计算开始', { 
    distance: input.distance,
    time_diff: input.timeDiff,
    time_unit: input.timeUnit,
  }, ctx));

  evidence.push(createEvidence(
    'distance_conclusion',
    'distance',
    '测距法结论',
    `基于测距${formatDistance(input.distance)}和时间差${formatTime(input.timeDiff, input.timeUnit)}，测量声速为${formatVelocity(result.measuredValue)}`,
    ctx,
    result.measuredValue,
    'm/s'
  ));

  auditLog.push(createAuditLog('测距法计算完成', { 
    measured_value: result.measuredValue,
    formula: 'v = distance / time',
  }, ctx));

  return { evidence, auditLog };
}

function buildTimeDiffEvidence(
  input: SoundVelocityInput,
  result: CalculationResult,
  ctx: EvidenceContext
): { evidence: EvidenceItem[]; auditLog: AuditLogEntry[] } {
  const evidence: EvidenceItem[] = [];
  const auditLog: AuditLogEntry[] = [];

  if (input.distance === null || input.timeDiff === null) {
    return { evidence, auditLog };
  }

  const expectedTime = input.distance / result.theoreticalValue;
  const actualTime = input.timeUnit === 'ms' ? input.timeDiff / 1000 : input.timeDiff;
  const timeDiffDeviation = ((actualTime - expectedTime) / expectedTime) * 100;

  auditLog.push(createAuditLog('时间差证据分析', { 
    expected_time: expectedTime,
    actual_time: actualTime,
    time_deviation_percent: timeDiffDeviation,
  }, ctx));

  evidence.push(createEvidence(
    'time_diff_evidence',
    'time',
    '时间差补充证据',
    `理论传播时间应为${formatTime(expectedTime, 's')}，实际测量为${formatTime(actualTime, 's')}，时间偏差${formatPercent(timeDiffDeviation)}`,
    ctx,
    timeDiffDeviation,
    '%'
  ));

  return { evidence, auditLog };
}

function buildCalibrationEvidence(
  input: SoundVelocityInput,
  result: CalculationResult,
  ctx: EvidenceContext
): { evidence: EvidenceItem[]; auditLog: AuditLogEntry[] } {
  const evidence: EvidenceItem[] = [];
  const auditLog: AuditLogEntry[] = [];

  if (Number.isNaN(result.measuredValue)) {
    return { evidence, auditLog };
  }

  const effectiveDeviation = input.deviceDeviation ?? PHYSICAL_CONSTANTS.DEFAULT_DEVICE_DEVIATION;

  auditLog.push(createAuditLog('设备校准开始', { 
    measured_value: result.measuredValue,
    device_deviation: input.deviceDeviation,
    effective_deviation: effectiveDeviation,
  }, ctx));

  const calibConclusion = input.deviceDeviation === null
    ? `设备偏差未提供，使用默认值±${PHYSICAL_CONSTANTS.DEFAULT_DEVICE_DEVIATION}m/s，校准后声速为${formatVelocity(result.calibratedValue)}`
    : `应用设备偏差${effectiveDeviation}m/s，校准后声速为${formatVelocity(result.calibratedValue)}`;

  evidence.push(createEvidence(
    'calibration_detail',
    'device',
    '设备校准明细',
    calibConclusion,
    ctx,
    result.calibratedValue,
    'm/s'
  ));

  auditLog.push(createAuditLog('设备校准完成', { 
    calibrated_value: result.calibratedValue,
    formula: 'v_calibrated = v_measured + deviation',
  }, ctx));

  return { evidence, auditLog };
}

function buildAnomalyEvidence(
  anomalies: Anomaly[],
  ctx: EvidenceContext
): { evidence: EvidenceItem[]; auditLog: AuditLogEntry[] } {
  const evidence: EvidenceItem[] = [];
  const auditLog: AuditLogEntry[] = [];

  for (const anomaly of anomalies) {
    auditLog.push(createAuditLog('异常检测', { 
      anomaly_type: anomaly.type,
      severity: anomaly.severity,
      field: anomaly.field,
      value: anomaly.value,
    }, ctx));

    evidence.push(createEvidence(
      'anomaly',
      'system',
      `[${anomaly.severity === 'error' ? '错误' : anomaly.severity === 'warning' ? '警告' : '提示'}] ${anomaly.type}`,
      anomaly.explanation,
      ctx,
      undefined,
      undefined,
      anomaly.id
    ));
  }

  return { evidence, auditLog };
}

function determineCorroborationLevel(
  evidence: EvidenceItem[]
): 'full' | 'partial' | 'none' {
  const conclusions = evidence
    .filter(e => ['temperature_conclusion', 'distance_conclusion', 'calibration_detail'].includes(e.type))
    .map(e => e.content);

  if (conclusions.length === 0) return 'none';

  const uniqueConclusions = [...new Set(conclusions.map(c => {
    if (c.includes('温度缺失') || c.includes('设备偏差未提供')) return 'warning';
    return c.match(/(\d+\.\d+) m\/s/)?.[1] || c;
  }))];

  if (uniqueConclusions.length === 1) return 'full';
  if (uniqueConclusions.length < conclusions.length) return 'partial';
  return 'none';
}

function getOverallConclusion(
  result: CalculationResult,
  corroborationLevel: 'full' | 'partial' | 'none'
): string {
  if (result.conclusion === 'consistent') {
    return `实验结果一致，声速校准值为${formatVelocity(result.calibratedValue)}，与理论值偏差${formatPercent(result.deviationPercent)}，在允许范围内。`;
  }
  if (result.conclusion === 'warning') {
    return `实验存在异常参数，请检查补充数据后重新计算。当前估算值为${formatVelocity(result.calibratedValue)}。`;
  }
  return `温度法与测距法结论不一致，偏差${formatPercent(result.deviationPercent)}，已补充时间差证据，请人工复核。`;
}

function calculateConfidence(
  anomalies: Anomaly[],
  corroborationLevel: 'full' | 'partial' | 'none'
): number {
  let confidence = 100;

  for (const anomaly of anomalies) {
    if (anomaly.severity === 'error') confidence -= 30;
    else if (anomaly.severity === 'warning') confidence -= 10;
  }

  if (corroborationLevel === 'partial') confidence -= 15;
  if (corroborationLevel === 'none') confidence -= 30;

  return Math.max(0, Math.min(100, confidence));
}

function findContradictions(evidence: EvidenceItem[]): string[] {
  const contradictions: string[] = [];
  const tempEvidence = evidence.find(e => e.type === 'temperature_conclusion');
  const distEvidence = evidence.find(e => e.type === 'distance_conclusion');

  if (tempEvidence && distEvidence && tempEvidence.value && distEvidence.value) {
    const deviation = Math.abs(tempEvidence.value - distEvidence.value) / tempEvidence.value * 100;
    if (deviation > PHYSICAL_CONSTANTS.CONSISTENCY_THRESHOLD) {
      contradictions.push(
        `温度法(${formatVelocity(tempEvidence.value)})与测距法(${formatVelocity(distEvidence.value)})偏差${formatPercent(deviation)}，超过${PHYSICAL_CONSTANTS.CONSISTENCY_THRESHOLD}%阈值`
      );
    }
  }

  return contradictions;
}

export function buildEvidenceChain(
  input: SoundVelocityInput,
  anomalies: Anomaly[],
  result: CalculationResult
): { evidenceChain: EvidenceChain; auditLog: AuditLogEntry[] } {
  const ctx: EvidenceContext = {
    sequence: 1,
    timestamp: Date.now(),
  };

  const allEvidence: EvidenceItem[] = [];
  const allAuditLog: AuditLogEntry[] = [];

  allAuditLog.push(createAuditLog('证据链构建开始', {
    input_hash: result.inputHash,
    algorithm_version: result.algorithmVersion,
  }, ctx));

  const anomalyResult = buildAnomalyEvidence(anomalies, ctx);
  allEvidence.push(...anomalyResult.evidence);
  allAuditLog.push(...anomalyResult.auditLog);

  const tempResult = buildTemperatureEvidence(input, result, ctx);
  allEvidence.push(...tempResult.evidence);
  allAuditLog.push(...tempResult.auditLog);

  const distResult = buildDistanceEvidence(input, result, ctx);
  allEvidence.push(...distResult.evidence);
  allAuditLog.push(...distResult.auditLog);

  if (result.conclusion === 'inconsistent') {
    const timeResult = buildTimeDiffEvidence(input, result, ctx);
    allEvidence.push(...timeResult.evidence);
    allAuditLog.push(...timeResult.auditLog);
  }

  const calibResult = buildCalibrationEvidence(input, result, ctx);
  allEvidence.push(...calibResult.evidence);
  allAuditLog.push(...calibResult.auditLog);

  const sortedEvidence = allEvidence.sort((a, b) => a.sequence - b.sequence);

  const corroborationLevel = determineCorroborationLevel(sortedEvidence);
  const contradictions = findContradictions(sortedEvidence);
  const confidence = calculateConfidence(anomalies, corroborationLevel);

  allAuditLog.push(createAuditLog('证据链构建完成', {
    evidence_count: sortedEvidence.length,
    corroboration_level: corroborationLevel,
    confidence,
    contradictions_count: contradictions.length,
  }, ctx));

  const evidenceChain: EvidenceChain = {
    items: sortedEvidence,
    orderedBy: 'sequence',
    overallConclusion: getOverallConclusion(result, corroborationLevel),
    confidence,
    corroborationLevel,
    contradictions,
  };

  return { evidenceChain, auditLog: allAuditLog };
}

export function sortEvidence(
  items: EvidenceItem[],
  orderBy: 'timestamp' | 'sequence' | 'type'
): EvidenceItem[] {
  const sorted = [...items];
  switch (orderBy) {
    case 'timestamp':
      return sorted.sort((a, b) => a.timestamp - b.timestamp);
    case 'type':
      return sorted.sort((a, b) => a.type.localeCompare(b.type));
    case 'sequence':
    default:
      return sorted.sort((a, b) => a.sequence - b.sequence);
  }
}

export function getCorroborationText(level: 'full' | 'partial' | 'none'): string {
  const texts = {
    full: '多源证据完全印证',
    partial: '部分证据互相印证',
    none: '证据之间无印证关系',
  };
  return texts[level];
}

export function getSourceText(source: EvidenceSource): string {
  return EVIDENCE_SOURCE_LABELS[source] || source;
}
