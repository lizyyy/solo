import { BrakeHeatLoadRecord, TemperatureCalibrationRecord } from '../types';

export interface CalculationParams {
  brakingForce: number;
  brakingSpeed: number;
  brakingDuration: number;
  ambientTemp: number;
  frictionCoeff: number;
  heatDissipationCoeff: number;
  contactArea: number;
  temperatureOffset?: number;
}

export function calculateHeatLoad(params: CalculationParams): number {
  const {
    brakingForce,
    brakingSpeed,
    brakingDuration,
    frictionCoeff,
    heatDissipationCoeff,
    contactArea
  } = params;

  const work = brakingForce * 1000 * brakingSpeed * brakingDuration;
  const heatGenerated = work * frictionCoeff;
  const effectiveHeat = heatGenerated * heatDissipationCoeff;
  const heatLoad = effectiveHeat / contactArea / 1000;

  return Math.round(heatLoad * 10) / 10;
}

export function applyTemperatureCorrection(
  heatLoad: number,
  ambientTemp: number,
  calibrationOffset: number
): number {
  const tempFactor = 1 + (calibrationOffset / 100);
  return Math.round(heatLoad * tempFactor * 10) / 10;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'normal': '正常记录',
    'manual_modified_no_reason': '人工改系数未说明',
    'recalibrated': '校准补录重算',
    'pending_review': '待复核'
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'normal': '#52c41a',
    'manual_modified_no_reason': '#faad14',
    'recalibrated': '#1890ff',
    'pending_review': '#ff4d4f'
  };
  return colors[status] || '#8c8c8c';
}

export function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    'initial_import': '首次导入',
    'manual_correction': '人工修正',
    'recalculation': '重跑计算'
  };
  return labels[source] || source;
}

export function getCoefficientLabel(name: string): string {
  const labels: Record<string, string> = {
    'frictionCoeff': '摩擦系数',
    'heatDissipationCoeff': '散热系数',
    'contactArea': '接触面积',
    'brakingForce': '制动力'
  };
  return labels[name] || name;
}

export function recalculateWithCalibration(
  record: BrakeHeatLoadRecord,
  calibration: TemperatureCalibrationRecord
): { heatLoad: number; logs: string[] } {
  const logs: string[] = [];
  const now = new Date().toLocaleString('zh-CN');

  logs.push(`${now} 应用温度校准记录 ${calibration.id}`);
  
  if (calibration.isOldStandard) {
    logs.push(`${now} 注意：该校准为旧口径数据（${calibration.remarks}）`);
  }

  const rawHeatLoad = calculateHeatLoad({
    brakingForce: record.brakingForce,
    brakingSpeed: record.brakingSpeed,
    brakingDuration: record.brakingDuration,
    ambientTemp: record.ambientTemp,
    frictionCoeff: record.frictionCoeff,
    heatDissipationCoeff: record.heatDissipationCoeff,
    contactArea: record.contactArea
  });

  logs.push(`${now} 原始热负荷计算：${rawHeatLoad} kJ/m²`);

  const correctedHeatLoad = applyTemperatureCorrection(
    rawHeatLoad,
    record.ambientTemp,
    calibration.correctionOffset
  );

  logs.push(`${now} 温度校准补偿 ${calibration.correctionOffset > 0 ? '+' : ''}${calibration.correctionOffset}℃`);
  logs.push(`${now} 校准后热负荷：${correctedHeatLoad} kJ/m²`);

  return { heatLoad: correctedHeatLoad, logs };
}
