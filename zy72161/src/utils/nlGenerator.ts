import { ShelterPoint } from '../types';

const timePeriodLabels: Record<string, string> = {
  morning: '早高峰(6:00-10:00)',
  noon: '午间(10:00-14:00)',
  afternoon: '下午(14:00-18:00)',
  evening: '晚高峰(18:00-22:00)',
  night: '夜间(22:00-次日6:00)'
};

export function generateCapacityAnalysis(shelter: ShelterPoint): string {
  const { designCapacity, reportedCount, capacityByTime } = shelter;
  const overflowRatio = reportedCount / designCapacity;

  let mainAnalysis = '';
  if (overflowRatio <= 0.8) {
    mainAnalysis = `该避难场所设计容量${designCapacity}人，目前反馈累计${reportedCount}人，容量充足，无需分流。`;
  } else if (overflowRatio <= 1.0) {
    mainAnalysis = `该避难场所设计容量${designCapacity}人，目前反馈累计${reportedCount}人，已接近容量上限(${Math.round(overflowRatio * 100)}%)，建议密切关注。`;
  } else if (overflowRatio <= 1.5) {
    mainAnalysis = `该避难场所设计容量${designCapacity}人，目前反馈累计${reportedCount}人，已超出容量${Math.round((overflowRatio - 1) * 100)}%，建议启动分流预案。`;
  } else {
    mainAnalysis = `该避难场所设计容量${designCapacity}人，目前反馈累计${reportedCount}人，严重超出容量${Math.round((overflowRatio - 1) * 100)}%，需立即启动紧急疏散预案！`;
  }

  let periodAnalysis = '';
  const peakPeriods = Object.entries(capacityByTime)
    .filter(([, count]) => count > designCapacity * 0.9)
    .map(([period, count]) => ({
      period: timePeriodLabels[period] || period,
      count,
      ratio: Math.round((count / designCapacity) * 100)
    }));

  if (peakPeriods.length > 0) {
    periodAnalysis = ` 分时段来看，${peakPeriods.map(p => `${p.period}人数达${p.count}人（${p.ratio}%）`).join('，')}，为高峰期。`;
  }

  return mainAnalysis + periodAnalysis;
}

export function generateConflictSuggestion(
  conflictType: string,
  shelterName: string
): string {
  switch (conflictType) {
    case 'capacity':
      return `建议：1. 核实现场实际容量是否与官方数据${shelterName}一致；2. 如确实超限，启动分流预案至附近备用避难所。`;
    case 'coordinate':
      return `建议：1. 现场复核${shelterName}准确位置；2. 如官方坐标有误，更新GIS数据库；3. 居民反馈坐标留作参考。`;
    case 'time':
      return `建议：1. 调整不同时段疏散引导策略；2. 在高峰时段增加临时安置点；3. 优化人员分流路线。`;
    case 'mixed':
      return `建议：1. 优先核实现场容量和准确位置；2. 综合考虑时段分布制定分流方案；3. 多方数据比对后更新系统记录。`;
    default:
      return '建议：进一步核实数据来源和准确性后再做处理。';
  }
}

export function generateReportSummary(
  processed: number,
  pending: number,
  onsite: number,
  totalCapacity: number,
  totalReported: number
): string {
  const total = processed + pending + onsite;
  const rate = total > 0 ? Math.round((processed / total) * 100) : 0;
  const utilization = totalCapacity > 0 ? Math.round((totalReported / totalCapacity) * 100) : 0;

  return `本月共处理"应急避难场所容量"相关诉求${total}件，其中已处理${processed}件，待核实${pending}件，需现场复看${onsite}件，处理完成率${rate}%。涉及避难场所总设计容量${totalCapacity}人，累计反馈${totalReported}人，整体利用率${utilization}%。`;
}
