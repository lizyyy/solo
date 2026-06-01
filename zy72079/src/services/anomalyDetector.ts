import type { Anomaly, RawPipeData, EstimationRecord } from '../types';

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

  detectDuplicates(records: EstimationRecord[], currentRecord: EstimationRecord): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const duplicates = records.filter(r =>
      r.id !== currentRecord.id &&
      r.area === currentRecord.area &&
      r.calculationDate === currentRecord.calculationDate &&
      r.rawData.pipeDiameter === currentRecord.rawData.pipeDiameter
    );

    if (duplicates.length > 0) {
      anomalies.push({
        type: 'duplicate',
        field: 'record',
        description: `存在重复记录: 相同区域(${currentRecord.area})、日期(${currentRecord.calculationDate})和管径`,
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

  detectOutliers(data: RawPipeData): Anomaly[] {
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

    if (data.pipeDiameter !== undefined) {
      if (data.pipeDiameter < this.parameterRanges.pipeDiameter.min ||
          data.pipeDiameter > this.parameterRanges.pipeDiameter.max) {
        anomalies.push({
          type: 'outlier',
          field: 'pipeDiameter',
          description: `管径 ${data.pipeDiameter}m 超出正常范围 (${this.parameterRanges.pipeDiameter.min}-${this.parameterRanges.pipeDiameter.max}m)`,
          severity: 'medium'
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
