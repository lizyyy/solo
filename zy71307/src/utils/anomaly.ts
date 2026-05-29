import type { DataPoint, AnomalyPoint, FittingParams } from '@/types';
import { generateId, mean, standardDeviation, zScore } from './math';
import { convertThrust } from './units';

export function detectRpmMissing(
  dataPoints: DataPoint[],
  params: FittingParams
): AnomalyPoint[] {
  const anomalies: AnomalyPoint[] = [];
  const sortedPoints = [...dataPoints].filter(d => !d.isExcluded).sort((a, b) => a.rpm - b.rpm);

  for (let i = 1; i < sortedPoints.length; i++) {
    const prev = sortedPoints[i - 1];
    const curr = sortedPoints[i];
    const expectedRpm = prev.rpm + params.rpmSamplingInterval;
    const actualRpm = curr.rpm;
    const deviation = actualRpm - expectedRpm;
    const threshold = params.rpmSamplingInterval * 1.5;

    if (Math.abs(deviation) > threshold) {
      anomalies.push({
        id: generateId(),
        dataPointId: curr.id,
        type: 'rpm_missing',
        severity: deviation > threshold * 3 ? 'critical' : deviation > threshold * 2 ? 'error' : 'warning',
        description: `转速采样间隔异常：期望 ${expectedRpm.toFixed(0)} RPM，实际 ${actualRpm.toFixed(0)} RPM`,
        calculationDetails: {
          expectedValue: expectedRpm,
          actualValue: actualRpm,
          threshold: threshold,
          deviation: deviation,
          formula: `偏差 = 实际转速 - (上一转速 + 采样间隔) = ${actualRpm} - (${prev.rpm} + ${params.rpmSamplingInterval})`,
        },
        isIncludedInReport: true,
      });
    }
  }

  return anomalies;
}

export function detectVoltageSag(
  dataPoints: DataPoint[],
  params: FittingParams
): AnomalyPoint[] {
  const anomalies: AnomalyPoint[] = [];
  const sortedPoints = [...dataPoints].filter(d => !d.isExcluded).sort((a, b) => a.timestamp - b.timestamp);

  if (sortedPoints.length < 3) return anomalies;

  const baselineVoltage = mean(sortedPoints.slice(0, Math.min(5, sortedPoints.length)).map(p => p.voltage));
  let sagStart = -1;
  let sagCount = 0;

  for (let i = 0; i < sortedPoints.length; i++) {
    const point = sortedPoints[i];
    const voltageDrop = ((baselineVoltage - point.voltage) / baselineVoltage) * 100;

    if (voltageDrop > params.voltageSagThreshold) {
      if (sagStart === -1) {
        sagStart = i;
      }
      sagCount++;

      if (sagCount >= 3) {
        const severity = voltageDrop > params.voltageSagThreshold * 3 ? 'critical' : voltageDrop > params.voltageSagThreshold * 2 ? 'error' : 'warning';

        anomalies.push({
          id: generateId(),
          dataPointId: point.id,
          type: 'voltage_sag',
          severity,
          description: `电压骤降：基准电压 ${baselineVoltage.toFixed(2)}V，当前 ${point.voltage.toFixed(2)}V，下降 ${voltageDrop.toFixed(2)}%`,
          calculationDetails: {
            expectedValue: baselineVoltage,
            actualValue: point.voltage,
            threshold: params.voltageSagThreshold,
            deviation: voltageDrop,
            formula: `下降率 = (基准电压 - 当前电压) / 基准电压 × 100% = (${baselineVoltage} - ${point.voltage}) / ${baselineVoltage} × 100%`,
          },
          isIncludedInReport: true,
        });
      }
    } else {
      sagStart = -1;
      sagCount = 0;
    }
  }

  return anomalies;
}

export function detectUnitError(
  dataPoints: DataPoint[],
  params: FittingParams
): AnomalyPoint[] {
  const anomalies: AnomalyPoint[] = [];
  const validPoints = dataPoints.filter(d => !d.isExcluded);

  if (validPoints.length < 5) return anomalies;

  const thrustValues = validPoints.map(d => convertThrust(d.thrust, d.thrustUnit, params.thrustUnit));
  const thrustMean = mean(thrustValues);
  const thrustStd = standardDeviation(thrustValues);

  validPoints.forEach((point) => {
    const convertedThrust = convertThrust(point.thrust, point.thrustUnit, params.thrustUnit);
    const z = zScore(convertedThrust, thrustValues);

    if (Math.abs(z) > params.outlierThreshold) {
      const severity = Math.abs(z) > params.outlierThreshold * 2 ? 'critical' : Math.abs(z) > params.outlierThreshold * 1.5 ? 'error' : 'warning';

      anomalies.push({
        id: generateId(),
        dataPointId: point.id,
        type: 'unit_error',
        severity,
        description: `推力值异常：Z-score = ${z.toFixed(2)}，可能存在单位错误。均值 ${thrustMean.toFixed(2)} ${params.thrustUnit}，当前值 ${convertedThrust.toFixed(2)} ${params.thrustUnit}`,
        calculationDetails: {
          expectedValue: thrustMean,
          actualValue: convertedThrust,
          threshold: params.outlierThreshold,
          deviation: z,
          formula: `Z-score = (x - μ) / σ = (${convertedThrust.toFixed(4)} - ${thrustMean.toFixed(4)}) / ${thrustStd.toFixed(4)}`,
        },
        isIncludedInReport: true,
      });
    }
  });

  return anomalies;
}

export function detectAllAnomalies(
  dataPoints: DataPoint[],
  params: FittingParams
): AnomalyPoint[] {
  const rpmMissing = detectRpmMissing(dataPoints, params);
  const voltageSag = detectVoltageSag(dataPoints, params);
  const unitError = detectUnitError(dataPoints, params);

  return [...rpmMissing, ...voltageSag, ...unitError];
}

export function getAnomalyTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    rpm_missing: '转速缺样',
    voltage_sag: '电压骤降',
    unit_error: '单位错误',
  };
  return labels[type] || type;
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    warning: '#f97316',
    error: '#eab308',
    critical: '#ef4444',
  };
  return colors[severity] || '#6b7280';
}
