import { OutdoorStall, ConflictResult } from '@/types';
import { getTimeOverlapMinutes } from '@/utils/timeUtils';

const MAX_ALLOWED_AREA_RATIO = 1.1;
const MAX_WARNING_AREA_RATIO = 1.2;
const EDGE_CONFLICT_MINUTES = 30;

export function checkCapacityConflict(stall: OutdoorStall): ConflictResult {
  const ratio = stall.area / stall.maxArea;
  
  if (ratio > MAX_WARNING_AREA_RATIO) {
    const overPercent = Math.round((ratio - 1) * 100);
    return {
      hasConflict: true,
      type: 'capacity',
      severity: 'high',
      description: `外摆面积${stall.area}㎡，已超过允许上限${stall.maxArea}㎡的${overPercent}%，超出较多，建议缩减外摆范围或重新测量实际占地面积。`,
      suggestion: '建议缩减外摆范围或重新测量实际占地面积。',
    };
  }
  
  if (ratio > MAX_ALLOWED_AREA_RATIO) {
    const overPercent = Math.round((ratio - 1) * 100);
    return {
      hasConflict: true,
      type: 'capacity',
      severity: 'medium',
      description: `外摆面积${stall.area}㎡，比${stall.maxArea}㎡的上限超出${overPercent}%，在10%-20%区间，属轻微超出，需确认场地实际条件。`,
      suggestion: '需人工复核场地实际条件后决定是否通过。',
    };
  }
  
  return {
    hasConflict: false,
    type: 'capacity',
    severity: 'low',
    description: `外摆面积${stall.area}㎡，在${stall.maxArea}㎡允许范围内。`,
    suggestion: '面积合规，可正常审批。',
  };
}

export function checkTimeConflict(stall: OutdoorStall, allStalls: OutdoorStall[]): ConflictResult {
  const conflicts: { name: string; overlap: number }[] = [];
  
  for (const other of allStalls) {
    if (other.id === stall.id) continue;
    
    const distance = getDistance(stall.lat, stall.lng, other.lat, other.lng);
    
    if (distance < 0.05) {
      const overlap = getTimeOverlapMinutes(stall.timePeriod, other.timePeriod);
      if (overlap > 0) {
        conflicts.push({ name: other.name, overlap });
      }
    }
  }
  
  if (conflicts.length === 0) {
    return {
      hasConflict: false,
      type: 'time',
      severity: 'low',
      description: `经营时间段${stall.timePeriod}，未发现与周边点位时间段冲突。`,
      suggestion: '时间段合规，可正常审批。',
    };
  }
  
  const totalOverlap = Math.max(...conflicts.map(c => c.overlap));
  const conflictNames = conflicts.map(c => c.name).join('、');
  
  if (totalOverlap < EDGE_CONFLICT_MINUTES) {
    return {
      hasConflict: true,
      type: 'time',
      severity: 'medium',
      description: `与${conflictNames}存在${totalOverlap}分钟时间段边缘重叠，属于相邻点位，建议人工确认实际客流情况后决定。`,
      suggestion: '时间段边缘冲突，建议人工确认实际客流情况后决定。',
    };
  }
  
  return {
    hasConflict: true,
    type: 'time',
    severity: 'high',
    description: `与${conflictNames}存在${totalOverlap}分钟时间段冲突，会造成客流拥堵和消防通道占用风险。`,
    suggestion: '建议调整经营时间段或缩减外摆范围。',
  };
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function runFullCheck(stall: OutdoorStall, allStalls: OutdoorStall[]): ConflictResult[] {
  return [
    checkCapacityConflict(stall),
    checkTimeConflict(stall, allStalls),
  ];
}
