import { SignalPoint, ConflictResult } from '../types';

const CAPACITY_THRESHOLD = 100;

export function checkCapacityConflict(point: SignalPoint): ConflictResult {
  if (point.capacity === undefined || point.designCapacity === undefined) {
    return {
      hasConflict: true,
      type: 'empty',
      humanReadable: '该点位缺少容量参数，请补充审批台账中的设计容量和实际预估数据',
      severity: 'error'
    };
  }

  const utilizationRate = (point.capacity / point.designCapacity) * 100;
  
  if (utilizationRate > CAPACITY_THRESHOLD) {
    const overRate = Math.round(utilizationRate - CAPACITY_THRESHOLD);
    return {
      hasConflict: true,
      type: 'capacity',
      humanReadable: `该点位高峰小时预计通过公交车 ${point.capacity} 辆，超出设计容量 ${overRate}%，建议协调相邻路口分流或优化信号配时`,
      severity: 'error'
    };
  }

  if (utilizationRate >= 95) {
    return {
      hasConflict: false,
      type: null,
      humanReadable: `容量利用率 ${Math.round(utilizationRate)}%，接近设计阈值，建议持续关注`,
      severity: 'warning'
    };
  }

  return {
    hasConflict: false,
    type: null,
    humanReadable: `容量利用率 ${Math.round(utilizationRate)}%，符合设计要求`,
    severity: 'warning'
  };
}

export function checkTimeSlotConflict(point: SignalPoint): ConflictResult {
  if (!point.timeSlot) {
    return {
      hasConflict: true,
      type: 'empty',
      humanReadable: '该点位缺少高峰时段配置，请补充信号配时方案',
      severity: 'error'
    };
  }

  const hasMorning = point.timeSlot.includes('7:') || point.timeSlot.includes('8:') || point.timeSlot.includes('9:');
  const hasEvening = point.timeSlot.includes('17:') || point.timeSlot.includes('18:') || point.timeSlot.includes('19:');

  if (!hasMorning || !hasEvening) {
    const missing = !hasMorning ? '早高峰' : '晚高峰';
    return {
      hasConflict: true,
      type: 'timeSlot',
      humanReadable: `该点位${missing}时段配置缺失，请确认是否符合当前公交运营实际需求`,
      severity: 'warning'
    };
  }

  return {
    hasConflict: false,
    type: null,
    humanReadable: '高峰时段配置完整',
    severity: 'warning'
  };
}

export function checkDuplicatePoints(points: SignalPoint[], point: SignalPoint): ConflictResult {
  const duplicates = points.filter(p => 
    p.id !== point.id && 
    p.name === point.name
  );

  if (duplicates.length > 0) {
    return {
      hasConflict: true,
      type: 'duplicate',
      humanReadable: `发现 ${duplicates.length} 个同名点位，请确认是否需要合并或区分标识`,
      severity: 'warning'
    };
  }

  return {
    hasConflict: false,
    type: null,
    humanReadable: '无重名点位',
    severity: 'warning'
  };
}

export function checkAllConflicts(point: SignalPoint, allPoints: SignalPoint[]): ConflictResult[] {
  const results: ConflictResult[] = [];
  
  results.push(checkCapacityConflict(point));
  results.push(checkTimeSlotConflict(point));
  results.push(checkDuplicatePoints(allPoints, point));
  
  return results;
}

export function getHumanReadableStatus(point: SignalPoint): string {
  const statusMap: Record<string, string> = {
    approved: '✓ 复核通过',
    pending: '⏳ 待确认',
    conflict: '⚠ 存在冲突',
    legacy: '📜 历史版本'
  };
  return statusMap[point.status] || point.status;
}

export function getSourceTypeLabel(sourceType: string): string {
  const map: Record<string, string> = {
    current: '当前方案',
    legacy: '旧口径导入',
    manual: '手工录入'
  };
  return map[sourceType] || sourceType;
}
