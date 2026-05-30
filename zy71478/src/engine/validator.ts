import { SoundVelocityInput, Anomaly, AnomalyType, CalculationResult } from '../types';
import { PHYSICAL_CONSTANTS, ANOMALY_METADATA } from '../constants/physics';
import { generateId } from '../utils/crypto';
import { convertTimeToSeconds } from '../utils/format';

interface ValidationContext {
  sequence: number;
  detectedAt: number;
}

function createAnomaly(
  type: AnomalyType,
  ctx: ValidationContext,
  field?: string,
  value?: number | string
): Anomaly {
  const metadata = ANOMALY_METADATA[type];
  return {
    id: generateId(),
    type,
    severity: metadata.severity,
    explanation: metadata.explanation,
    impact: metadata.impact,
    suggestion: metadata.suggestion,
    detectedAt: ctx.detectedAt,
    sequence: ctx.sequence++,
    field,
    value,
  };
}

export function validateTemperature(
  input: SoundVelocityInput,
  ctx: ValidationContext
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const { MIN_REASONABLE_TEMP, MAX_REASONABLE_TEMP } = PHYSICAL_CONSTANTS;

  if (input.temperature === null) {
    anomalies.push(createAnomaly(AnomalyType.TEMPERATURE_MISSING, ctx, 'temperature'));
  } else if (input.temperature < MIN_REASONABLE_TEMP || input.temperature > MAX_REASONABLE_TEMP) {
    anomalies.push(createAnomaly(
      AnomalyType.VALUE_OUT_OF_RANGE,
      ctx,
      'temperature',
      input.temperature
    ));
  }

  return anomalies;
}

export function validateDistance(
  input: SoundVelocityInput,
  ctx: ValidationContext
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const { MIN_REASONABLE_DISTANCE, MAX_REASONABLE_DISTANCE } = PHYSICAL_CONSTANTS;

  if (input.distance === null) {
    anomalies.push(createAnomaly(AnomalyType.DISTANCE_MISSING, ctx, 'distance'));
  } else if (input.distance < MIN_REASONABLE_DISTANCE || input.distance > MAX_REASONABLE_DISTANCE) {
    anomalies.push(createAnomaly(
      AnomalyType.VALUE_OUT_OF_RANGE,
      ctx,
      'distance',
      input.distance
    ));
  }

  return anomalies;
}

export function validateTimeDiff(
  input: SoundVelocityInput,
  ctx: ValidationContext
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const { MIN_REASONABLE_TIME_DIFF, MAX_REASONABLE_TIME_DIFF } = PHYSICAL_CONSTANTS;

  if (input.timeDiff === null) {
    anomalies.push(createAnomaly(AnomalyType.TIME_DIFF_MISSING, ctx, 'timeDiff'));
    return anomalies;
  }

  const timeInSeconds = convertTimeToSeconds(input.timeDiff, input.timeUnit);
  if (timeInSeconds < MIN_REASONABLE_TIME_DIFF || timeInSeconds > MAX_REASONABLE_TIME_DIFF) {
    anomalies.push(createAnomaly(
      AnomalyType.VALUE_OUT_OF_RANGE,
      ctx,
      'timeDiff',
      `${input.timeDiff} ${input.timeUnit}`
    ));
  }

  return anomalies;
}

export function validateTimeUnit(
  input: SoundVelocityInput,
  ctx: ValidationContext
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (input.distance !== null && input.timeDiff !== null) {
    const timeInSeconds = convertTimeToSeconds(input.timeDiff, input.timeUnit);
    const velocity = input.distance / timeInSeconds;
    const { MIN_REASONABLE_VELOCITY, MAX_REASONABLE_VELOCITY } = PHYSICAL_CONSTANTS;

    if (velocity < MIN_REASONABLE_VELOCITY || velocity > MAX_REASONABLE_VELOCITY) {
      if (input.timeUnit === 'ms') {
        const velocityInSeconds = input.distance / (input.timeDiff / 1000);
        if (velocityInSeconds >= MIN_REASONABLE_VELOCITY && velocityInSeconds <= MAX_REASONABLE_VELOCITY) {
          anomalies.push(createAnomaly(
            AnomalyType.TIME_UNIT_ERROR,
            ctx,
            'timeUnit',
            input.timeUnit
          ));
        }
      } else {
        const velocityInMs = input.distance / (input.timeDiff * 1000);
        if (velocityInMs >= MIN_REASONABLE_VELOCITY && velocityInMs <= MAX_REASONABLE_VELOCITY) {
          anomalies.push(createAnomaly(
            AnomalyType.TIME_UNIT_ERROR,
            ctx,
            'timeUnit',
            input.timeUnit
          ));
        }
      }
    }
  }

  return anomalies;
}

export function validateDeviceDeviation(
  input: SoundVelocityInput,
  ctx: ValidationContext
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (input.deviceDeviation === null) {
    anomalies.push(createAnomaly(AnomalyType.DEVICE_DEVIATION_MISSING, ctx, 'deviceDeviation'));
  }

  return anomalies;
}

export function validateConclusionConsistency(
  result: CalculationResult,
  ctx: ValidationContext
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (result.conclusion === 'inconsistent') {
    anomalies.push(createAnomaly(
      AnomalyType.CONCLUSION_INCONSISTENT,
      ctx,
      'conclusion',
      `${result.deviationPercent.toFixed(2)}%`
    ));
  }

  return anomalies;
}

export function validateInput(input: SoundVelocityInput): Anomaly[] {
  const ctx: ValidationContext = {
    sequence: 1,
    detectedAt: Date.now(),
  };

  const anomalies: Anomaly[] = [];

  anomalies.push(...validateTemperature(input, ctx));
  anomalies.push(...validateDistance(input, ctx));
  anomalies.push(...validateTimeDiff(input, ctx));
  anomalies.push(...validateTimeUnit(input, ctx));
  anomalies.push(...validateDeviceDeviation(input, ctx));

  return anomalies.sort((a, b) => a.sequence - b.sequence);
}

export function validateResult(
  input: SoundVelocityInput,
  result: CalculationResult
): Anomaly[] {
  const anomalies = validateInput(input);

  const ctx: ValidationContext = {
    sequence: anomalies.length + 1,
    detectedAt: Date.now(),
  };

  anomalies.push(...validateConclusionConsistency(result, ctx));

  return anomalies.sort((a, b) => a.sequence - b.sequence);
}

export function getAnomalyTypeLabel(type: AnomalyType): string {
  const labels: Record<AnomalyType, string> = {
    [AnomalyType.TEMPERATURE_MISSING]: '温度缺失',
    [AnomalyType.TIME_UNIT_ERROR]: '时间单位错误',
    [AnomalyType.DEVICE_DEVIATION_MISSING]: '设备偏差未标',
    [AnomalyType.VALUE_OUT_OF_RANGE]: '数值超出范围',
    [AnomalyType.CONCLUSION_INCONSISTENT]: '结论不一致',
    [AnomalyType.DISTANCE_MISSING]: '测距缺失',
    [AnomalyType.TIME_DIFF_MISSING]: '时间差缺失',
  };
  return labels[type];
}

export function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    info: '提示',
    warning: '警告',
    error: '错误',
  };
  return labels[severity] || severity;
}

export function hasErrorAnomalies(anomalies: Anomaly[]): boolean {
  return anomalies.some(a => a.severity === 'error');
}

export function hasWarningAnomalies(anomalies: Anomaly[]): boolean {
  return anomalies.some(a => a.severity === 'warning');
}
