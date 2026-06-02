import { 
  Anomaly, 
  AnomalyType, 
  AnomalySeverity,
  GISPoint,
  ResidentFeedback,
  InspectionRecord,
  MergedRecord,
  MatchResult
} from '@/types';
import { generateId, stringSimilarity } from './matching';

const CAPACITY_THRESHOLD = 1000;

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  recordId: string;
}

export function detectEmptyValues(
  merged: MergedRecord,
  gis?: GISPoint,
  feedback?: ResidentFeedback,
  inspection?: InspectionRecord
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const emptyFields: string[] = [];

  if (gis) {
    if (!gis.lamp_id) emptyFields.push('GIS点位-路灯编号');
    if (!gis.address) emptyFields.push('GIS点位-地址');
    if (!gis.power_rating && gis.power_rating !== 0) emptyFields.push('GIS点位-额定功率');
  }

  if (feedback) {
    if (!feedback.lamp_id) emptyFields.push('居民反馈-路灯编号');
    if (!feedback.description) emptyFields.push('居民反馈-问题描述');
  }

  if (inspection) {
    if (!inspection.lamp_id) emptyFields.push('巡检记录-路灯编号');
  }

  if (emptyFields.length > 0) {
    anomalies.push({
      id: generateId(),
      merged_record_id: merged.id,
      type: 'empty_value',
      severity: emptyFields.length > 2 ? 'high' : 'medium',
      description: `缺失字段: ${emptyFields.join(', ')}`,
      human_readable: `以下信息不完整，缺少${emptyFields.length}个关键字段：${emptyFields.join('、')}。请补充完整后再复核。`,
      detected_at: new Date()
    });
  }

  return anomalies;
}

export function detectCapacityOverload(
  merged: MergedRecord,
  gis?: GISPoint
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  if (gis && gis.power_rating > CAPACITY_THRESHOLD) {
    anomalies.push({
      id: generateId(),
      merged_record_id: merged.id,
      type: 'capacity_overload',
      severity: 'high',
      description: `功率 ${gis.power_rating}W 超过阈值 ${CAPACITY_THRESHOLD}W`,
      human_readable: `该灯具额定功率为${gis.power_rating}瓦，已超出正常范围（建议${CAPACITY_THRESHOLD}瓦），可能存在容量超载风险。请现场检查是否设备规格异常。`,
      detected_at: new Date()
    });
  }

  return anomalies;
}

export function detectTimeConflict(
  merged: MergedRecord,
  gis?: GISPoint
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  if (gis && gis.operating_hours) {
    const hours = gis.operating_hours;
    const timePattern = /(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/;
    const match = hours.match(timePattern);
    if (match) {
      const startTime = match[1];
      const startHour = parseInt(startTime.split(':')[0]);
      if (startHour >= 6 && startHour < 18) {
        anomalies.push({
          id: generateId(),
          merged_record_id: merged.id,
          type: 'time_conflict',
          severity: 'medium',
          description: `运行时间段 ${hours} 包含白天时段`,
          human_readable: `灯具运行时间设置为${hours}，包含白天时段（6:00-18:00），可能存在不必要的能耗。建议核实时间段异常。`,
          detected_at: new Date()
        });
      }
    }
  }

  return anomalies;
}

export function detectDataMismatch(
  merged: MergedRecord,
  gis?: GISPoint,
  feedback?: ResidentFeedback,
  inspection?: InspectionRecord
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const mismatches: string[] = [];

  if (gis && feedback) {
    const addrSim = stringSimilarity(gis.address, feedback.address);
    if (addrSim < 0.5) {
      mismatches.push('GIS地址与反馈地址差异较大');
    }
    if (gis.lamp_id && feedback.lamp_id && gis.lamp_id !== feedback.lamp_id) {
      mismatches.push('路灯编号不一致');
    }
  }

  if (gis && inspection) {
    const addrSim = stringSimilarity(gis.address, inspection.address);
    if (addrSim < 0.5) {
      mismatches.push('GIS地址与巡检地址差异较大');
    }
  }

  if (mismatches.length > 0) {
    anomalies.push({
      id: generateId(),
      merged_record_id: merged.id,
      type: 'data_mismatch',
      severity: 'medium',
      description: `数据不一致: ${mismatches.join(', ')}`,
      human_readable: `多源数据存在${mismatches.length}处不一致：${mismatches.join('；')}。需要人工确认是否为同一灯具。`,
      detected_at: new Date()
    });
  }

  return anomalies;
}

export function detectAllAnomalies(
  merged: MergedRecord,
  gis?: GISPoint,
  feedback?: ResidentFeedback,
  inspection?: InspectionRecord
): Anomaly[] {
  return [
    ...detectEmptyValues(merged, gis, feedback, inspection),
    ...detectCapacityOverload(merged, gis),
    ...detectTimeConflict(merged, gis),
    ...detectDataMismatch(merged, gis, feedback, inspection)
  ];
}

export function getAnomalyTypeLabel(type: AnomalyType): string {
  const labels: Record<AnomalyType, string> = {
    empty_value: '数据缺失',
    duplicate: '重复记录',
    capacity_overload: '容量超限',
    time_conflict: '时间段异常',
    data_mismatch: '数据不一致',
    boundary_case: '边界情况'
  };
  return labels[type];
}

export function getSeverityLabel(severity: AnomalySeverity): string {
  const labels: Record<AnomalySeverity, string> = {
    low: '轻微',
    medium: '中等',
    high: '严重'
  };
  return labels[severity];
}

export function getSeverityColor(severity: AnomalySeverity): string {
  const colors: Record<AnomalySeverity, string> = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800'
  };
  return colors[severity];
}
