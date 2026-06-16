import type { Anomaly, RawPipeData, EstimationRecord } from '../types';
import { UnitConverter } from './unitConverter';

export class AnomalyDetector {
  private parameterRanges = {
    pipeLength: { min: 10, max: 10000 },
    pipeDiameter: { min: 0.1, max: 3 },
    rainfallIntensity: { min: 10, max: 200 },
    runoffCoefficient: { min: 0.1, max: 0.95 },
  };

  detectEmptyValues(data: RawPipeData): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const requiredFields: (keyof RawPipeData)[] = [
      'pipeLength',
      'pipeDiameter',
      'rainfallIntensity',
      'runoffCoefficient'
    ];

    requiredFields.forEach(field => {
      if (data[field] === undefined || data[field] === null) {
        anomalies.push({
          type: 'empty_value',
          field,
          description: `字段 ${field} 为空值`,
          severity: 'high'
        });
      }
    });

    return anomalies;
  }

  detectDuplicates(
    records: EstimationRecord[],
    currentRecord: EstimationRecord,
    normalizedValues?: {
      pipeDiameter?: number;
      rainfallIntensity?: number;
    }
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const currentPipeLength = currentRecord.rawData.pipeLength;
    const currentPipeDiameter = normalizedValues?.pipeDiameter ?? currentRecord.rawData.pipeDiameter;
    const currentRainfall = normalizedValues?.rainfallIntensity ?? currentRecord.rawData.rainfallIntensity;
    const currentDate = currentRecord.calculationDate;

    const duplicates = records.filter(r => {
      if (r.id === currentRecord.id) return false;
      if (r.calculationDate !== currentDate) return false;
      if (r.rawData.pipeLength !== currentPipeLength) return false;

      const rPipeDiameter = (r.rawData.pipeDiameter !== undefined && r.rawData.pipeDiameterUnit)
        ? UnitConverter.normalizeToStandard(r.rawData.pipeDiameter, r.rawData.pipeDiameterUnit).value
        : r.rawData.pipeDiameter;
      if (rPipeDiameter !== currentPipeDiameter) return false;

      const rRainfall = (r.rawData.rainfallIntensity !== undefined && r.rawData.rainfallUnit)
        ? UnitConverter.normalizeToStandard(r.rawData.rainfallIntensity, r.rawData.rainfallUnit).value
        : r.rawData.rainfallIntensity;
      if (rRainfall !== currentRainfall) return false;

      return true;
    });

    if (duplicates.length > 0) {
      const duplicateNos = duplicates.map(d => d.recordNo).join(', ');
      anomalies.push({
        type: 'duplicate',
        field: 'record',
        description: `存在重复记录: 管长(${currentPipeLength}m)、管径(${currentPipeDiameter}m)、降雨强度(${currentRainfall}mm/h)、日期(${currentDate})均相同。关联记录: ${duplicateNos}`,
        severity: 'medium'
      });
    }

    return anomalies;
  }

  detectUnitMismatch(data: RawPipeData): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const expectedUnits = {
      pipeDiameterUnit: ['m', 'mm', 'cm'],
      rainfallUnit: ['mm/h', 'mm/min', 'mm/24h']
    };

    if (data.pipeDiameterUnit && !expectedUnits.pipeDiameterUnit.includes(data.pipeDiameterUnit)) {
      anomalies.push({
        type: 'unit_mismatch',
        field: 'pipeDiameterUnit',
        description: `管径单位 ${data.pipeDiameterUnit} 不在预期范围内，预期单位: ${expectedUnits.pipeDiameterUnit.join(', ')}`,
        severity: 'high'
      });
    }

    if (data.rainfallUnit && !expectedUnits.rainfallUnit.includes(data.rainfallUnit)) {
      anomalies.push({
        type: 'unit_mismatch',
        field: 'rainfallUnit',
        description: `降雨强度单位 ${data.rainfallUnit} 不在预期范围内，预期单位: ${expectedUnits.rainfallUnit.join(', ')}`,
        severity: 'high'
      });
    }

    return anomalies;
  }

  detectOutliers(data: RawPipeData, normalizedValues?: {
    pipeDiameter?: number;
    rainfallIntensity?: number;
  }): Anomaly[] {
    const anomalies: Anomaly[] = [];

    if (data.pipeLength !== undefined) {
      if (data.pipeLength < this.parameterRanges.pipeLength.min ||
          data.pipeLength > this.parameterRanges.pipeLength.max) {
        anomalies.push({
          type: 'outlier',
          field: 'pipeLength',
          description: `管长 ${data.pipeLength}m 超出正常范围 (${this.parameterRanges.pipeLength.min}-${this.parameterRanges.pipeLength.max}m)`,
          severity: 'medium'
        });
      }
    }

    const pipeDiameterForCheck = normalizedValues?.pipeDiameter ?? data.pipeDiameter;
    if (pipeDiameterForCheck !== undefined) {
      if (pipeDiameterForCheck < this.parameterRanges.pipeDiameter.min ||
          pipeDiameterForCheck > this.parameterRanges.pipeDiameter.max) {
        anomalies.push({
          type: 'outlier',
          field: 'pipeDiameter',
          description: `管径 ${pipeDiameterForCheck.toFixed(2)}m 超出正常范围 (${this.parameterRanges.pipeDiameter.min}-${this.parameterRanges.pipeDiameter.max}m)`,
          severity: 'medium'
        });
      }
    }

    const rainfallForCheck = normalizedValues?.rainfallIntensity ?? data.rainfallIntensity;
    if (rainfallForCheck !== undefined) {
      if (rainfallForCheck < this.parameterRanges.rainfallIntensity.min ||
          rainfallForCheck > this.parameterRanges.rainfallIntensity.max) {
        anomalies.push({
          type: 'outlier',
          field: 'rainfallIntensity',
          description: `降雨强度 ${rainfallForCheck.toFixed(2)}mm/h 超出正常范围 (${this.parameterRanges.rainfallIntensity.min}-${this.parameterRanges.rainfallIntensity.max}mm/h)`,
          severity: 'high'
        });
      }
    }

    return anomalies;
  }

  detectBoundary(data: RawPipeData): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const boundaryThreshold = 0.9;

    if (data.runoffCoefficient !== undefined) {
      const range = this.parameterRanges.runoffCoefficient.max - this.parameterRanges.runoffCoefficient.min;
      const upperBoundary = this.parameterRanges.runoffCoefficient.max - range * (1 - boundaryThreshold);
      const lowerBoundary = this.parameterRanges.runoffCoefficient.min + range * (1 - boundaryThreshold);

      if (data.runoffCoefficient >= upperBoundary || data.runoffCoefficient <= lowerBoundary) {
        anomalies.push({
          type: 'boundary',
          field: 'runoffCoefficient',
          description: `径流系数 ${data.runoffCoefficient} 接近边界值，需要人工确认`,
          severity: 'low'
        });
      }
    }

    return anomalies;
  }

  detectAll(data: RawPipeData, allRecords: EstimationRecord[], currentRecord: EstimationRecord): Anomaly[] {
    return [
      ...this.detectEmptyValues(data),
      ...this.detectDuplicates(allRecords, currentRecord),
      ...this.detectUnitMismatch(data),
      ...this.detectOutliers(data),
      ...this.detectBoundary(data),
    ];
  }
}
