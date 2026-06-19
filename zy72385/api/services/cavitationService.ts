import { db, saveDb } from '../data/db.js';
import type { CavitationCalculation, MissingInterval, ReviewTask } from '../../shared/types.js';
import { recordChange } from './auditService.js';
import crypto from 'crypto';

export function detectMissingIntervals(
  sampleTimes: string[],
  expectedIntervalMinutes: number
): MissingInterval[] {
  const missing: MissingInterval[] = [];
  if (sampleTimes.length < 2) return missing;

  const times = sampleTimes.map((t) => new Date(t).getTime()).sort((a, b) => a - b);
  const expectedMs = expectedIntervalMinutes * 60 * 1000;
  const tolerance = expectedMs * 0.5;

  const toLocalISOString = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  for (let i = 0; i < times.length - 1; i++) {
    const diff = times[i + 1] - times[i];
    if (diff > expectedMs + tolerance) {
      const gapStart = times[i] + expectedMs;
      const gapEnd = times[i + 1] - expectedMs;
      let cursor = gapStart;
      while (cursor <= gapEnd) {
        missing.push({
          start: toLocalISOString(cursor),
          end: toLocalISOString(cursor + expectedMs),
          duration: expectedIntervalMinutes,
          source: 'screenshot',
        });
        cursor += expectedMs;
      }
    }
  }

  return missing;
}

export function calculateCavitationRisk(params: CavitationCalculation['parameters']): {
  riskLevel: CavitationCalculation['riskLevel'];
  riskScore: number;
  result: CavitationCalculation['result'];
} {
  const { pressure, flowRate, temperatures, sampleTimes, missingIntervals } = params;

  if (pressure.length === 0 || flowRate.length === 0) {
    return {
      riskLevel: 'low',
      riskScore: 0,
      result: {
        npshAvailable: 0,
        npshRequired: 0,
        cavitationProbability: 0,
        affectedAreas: [],
        recommendations: ['数据不足，无法计算'],
      },
    };
  }

  const avgPressure = pressure.reduce((a, b) => a + b, 0) / pressure.length;
  const avgFlow = flowRate.reduce((a, b) => a + b, 0) / flowRate.length;
  const avgTemp = temperatures.length > 0 ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length : 25;

  const vaporPressure = 0.00317 * Math.exp(0.059 * avgTemp);

  const npshAvailable = Math.max(0, (avgPressure - vaporPressure) * 10.2);
  const npshRequired = 0.0015 * avgFlow + 1.2;

  const margin = npshAvailable - npshRequired;

  let riskScore = 50;
  if (margin > 1.0) riskScore = 20;
  else if (margin > 0.5) riskScore = 40;
  else if (margin > 0) riskScore = 60;
  else if (margin > -0.5) riskScore = 75;
  else riskScore = 90;

  const missingPenalty = missingIntervals.length * 5;
  riskScore = Math.min(100, riskScore + missingPenalty);

  let riskLevel: CavitationCalculation['riskLevel'];
  if (riskScore < 30) riskLevel = 'low';
  else if (riskScore < 55) riskLevel = 'medium';
  else if (riskScore < 80) riskLevel = 'high';
  else riskLevel = 'critical';

  const cavitationProbability = Math.max(0, Math.min(1, 1 - margin / 2));

  const affectedAreas: string[] = [];
  if (riskScore >= 40) affectedAreas.push('叶轮入口');
  if (riskScore >= 60) affectedAreas.push('吸入室');
  if (riskScore >= 80) affectedAreas.push('前盖板', '后盖板');

  const recommendations: string[] = [];
  if (riskScore < 30) {
    recommendations.push('运行状态良好，继续按计划监测');
  } else if (riskScore < 55) {
    recommendations.push('建议检查入口过滤器是否堵塞');
    recommendations.push('考虑增加吸入压力');
    recommendations.push('下周进行复查检测');
  } else if (riskScore < 80) {
    recommendations.push('建议安排预防性维护');
    recommendations.push('检测入口压力管线是否有泄漏');
    recommendations.push('增加监测频率');
  } else {
    recommendations.push('立即停机检查');
    recommendations.push('检测入口压力管线');
    recommendations.push('安排维修人员现场勘查');
  }

  return {
    riskLevel,
    riskScore: Math.round(riskScore),
    result: {
      npshAvailable: Number(npshAvailable.toFixed(2)),
      npshRequired: Number(npshRequired.toFixed(2)),
      cavitationProbability: Number(cavitationProbability.toFixed(2)),
      affectedAreas,
      recommendations,
    },
  };
}

export async function createCalculation(
  data: Omit<CavitationCalculation, 'id' | 'createdAt' | 'updatedAt' | 'riskLevel' | 'riskScore' | 'result'>,
  createdBy: string
): Promise<CavitationCalculation> {
  await db.read();

  const missingIntervals = detectMissingIntervals(data.parameters.sampleTimes, 30);
  const paramsWithMissing = { ...data.parameters, missingIntervals };
  const riskResult = calculateCavitationRisk(paramsWithMissing);

  const calculation: CavitationCalculation = {
    id: `calc-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    riskLevel: riskResult.riskLevel,
    riskScore: riskResult.riskScore,
    result: riskResult.result,
    name: data.name,
    pumpId: data.pumpId,
    screenshotIds: data.screenshotIds,
    samplingIntervalIds: data.samplingIntervalIds,
    parameters: paramsWithMissing,
    status: data.status || 'draft',
    remark: data.remark || '',
    createdBy: data.createdBy || createdBy,
    updatedBy: data.updatedBy || createdBy,
  };

  db.data.calculations.unshift(calculation);

  data.screenshotIds.forEach((sid) => {
    const shot = db.data.screenshots.find((s) => s.id === sid);
    if (shot && !shot.calculationIds.includes(calculation.id)) {
      shot.calculationIds.push(calculation.id);
    }
  });

  data.samplingIntervalIds.forEach((sid) => {
    const interval = db.data.samplingIntervals.find((s) => s.id === sid);
    if (interval && !interval.calculationIds.includes(calculation.id)) {
      interval.calculationIds.push(calculation.id);
    }
  });

  if (missingIntervals.length > 0) {
    const gapDescriptions = missingIntervals.map((m) => {
      const startStr = new Date(m.start).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const endStr = new Date(m.end).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      return `${startStr}-${endStr}缺${m.duration}分钟`;
    });
    const reviewTask: ReviewTask = {
      id: `task-${crypto.randomUUID().slice(0, 8)}`,
      calculationId: calculation.id,
      type: 'missing_interval',
      description: `采样时间缺失：${gapDescriptions.join('、')}，请质检员复核`,
      status: 'pending',
      assignee: 'user-2',
      createdAt: new Date().toISOString(),
      missingInterval: missingIntervals[0],
    };
    db.data.reviewTasks.push(reviewTask);
    calculation.status = 'pending_review';
    calculation.reviewAssignee = 'user-2';
  }

  await saveDb();
  return calculation;
}

export async function updateCalculation(
  id: string,
  updates: Partial<CavitationCalculation>,
  updatedBy: string,
  changeReason: string
): Promise<CavitationCalculation | null> {
  await db.read();

  const calc = db.data.calculations.find((c) => c.id === id);
  if (!calc) return null;

  const oldValues: Record<string, any> = {};

  for (const key of Object.keys(updates)) {
    const k = key as keyof CavitationCalculation;
    if (k === 'parameters' || k === 'result') continue;
    if (updates[k] !== undefined) {
      oldValues[key] = calc[k];
      (calc as any)[k] = updates[k];
    }
  }

  if (updates.parameters) {
    oldValues.parameters = JSON.parse(JSON.stringify(calc.parameters));
    const missingIntervals = detectMissingIntervals(updates.parameters.sampleTimes || calc.parameters.sampleTimes, 30);
    calc.parameters = { ...updates.parameters, missingIntervals };
    
    const riskResult = calculateCavitationRisk(calc.parameters);
    oldValues.result = JSON.parse(JSON.stringify(calc.result));
    oldValues.riskLevel = calc.riskLevel;
    oldValues.riskScore = calc.riskScore;
    
    calc.riskLevel = riskResult.riskLevel;
    calc.riskScore = riskResult.riskScore;
    calc.result = riskResult.result;
  }

  calc.updatedAt = new Date().toISOString();
  calc.updatedBy = updatedBy;

  for (const [field, oldVal] of Object.entries(oldValues)) {
    await recordChange(
      'calculation',
      id,
      field,
      oldVal,
      (updates as any)[field] || (field === 'parameters' || field === 'result' ? (calc as any)[field] : (calc as any)[field]),
      changeReason,
      updatedBy,
      [id]
    );
  }

  await saveDb();
  return calc;
}

export async function getCalculationById(id: string) {
  await db.read();
  return db.data.calculations.find((c) => c.id === id);
}

export async function getAllCalculations() {
  await db.read();
  return [...db.data.calculations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function recalculateRisk(id: string) {
  await db.read();
  const calc = db.data.calculations.find((c) => c.id === id);
  if (!calc) return null;

  const riskResult = calculateCavitationRisk(calc.parameters);
  const oldRiskLevel = calc.riskLevel;
  const oldRiskScore = calc.riskScore;
  const oldResult = { ...calc.result };

  calc.riskLevel = riskResult.riskLevel;
  calc.riskScore = riskResult.riskScore;
  calc.result = riskResult.result;
  calc.updatedAt = new Date().toISOString();

  if (oldRiskLevel !== riskResult.riskLevel || oldRiskScore !== riskResult.riskScore) {
    await recordChange(
      'calculation',
      id,
      'riskLevel',
      oldRiskLevel,
      riskResult.riskLevel,
      '重新计算汽蚀风险',
      'system',
      [id]
    );
  }

  await saveDb();
  return calc;
}

export async function createSamplingInterval(
  data: Omit<import('../../shared/types.js').SamplingInterval, 'id' | 'createTime' | 'updateTime' | 'version' | 'calculationIds'>,
  creator: string
) {
  await db.read();

  const interval: import('../../shared/types.js').SamplingInterval = {
    id: `interval-${crypto.randomUUID().slice(0, 8)}`,
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
    version: 1,
    calculationIds: [],
    creator,
    ...data,
  };

  db.data.samplingIntervals.unshift(interval);
  await saveDb();
  return interval;
}

export async function getSamplingIntervals() {
  await db.read();
  return [...db.data.samplingIntervals].sort(
    (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
  );
}
