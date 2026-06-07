import { UnitConverter } from './unitConverter';
import { AnomalyDetector } from './anomalyDetector';
import type { EstimationRecord, RawPipeData, CalculationStep, Anomaly } from '../types';

export class PipeCapacityCalculator {
  private anomalyDetector: AnomalyDetector;

  constructor() {
    this.anomalyDetector = new AnomalyDetector();
  }

  calculateCapacity(data: RawPipeData): {
    result: number | null;
    steps: CalculationStep[];
    anomalies: Anomaly[];
    failureReason?: string;
  } {
    const steps: CalculationStep[] = [];
    let pipeDiameterNormalized = data.pipeDiameter;
    let rainfallNormalized = data.rainfallIntensity;

    if (data.pipeDiameter !== undefined && data.pipeDiameterUnit) {
      const normalized = UnitConverter.normalizeToStandard(data.pipeDiameter, data.pipeDiameterUnit);
      pipeDiameterNormalized = normalized.value;
      steps.push({
        stepId: 'step-1',
        description: '管径单位归一化',
        input: { value: data.pipeDiameter, unit: data.pipeDiameterUnit },
        output: { value: normalized.value, unit: normalized.unit },
        unitBefore: data.pipeDiameterUnit,
        unitAfter: normalized.unit,
        formula: `UnitConverter.convert(${data.pipeDiameter}, '${data.pipeDiameterUnit}', '${normalized.unit}')`
      });
    }

    if (data.rainfallIntensity !== undefined && data.rainfallUnit) {
      const normalized = UnitConverter.normalizeToStandard(data.rainfallIntensity, data.rainfallUnit);
      rainfallNormalized = normalized.value;
      steps.push({
        stepId: 'step-2',
        description: '降雨强度单位归一化',
        input: { value: data.rainfallIntensity, unit: data.rainfallUnit },
        output: { value: normalized.value, unit: normalized.unit },
        unitBefore: data.rainfallUnit,
        unitAfter: normalized.unit,
        formula: `UnitConverter.convert(${data.rainfallIntensity}, '${data.rainfallUnit}', '${normalized.unit}')`
      });
    }

    let anomalies = this.anomalyDetector.detectEmptyValues(data);

    const outlierAnomalies = this.anomalyDetector.detectOutliers(data, {
      pipeDiameter: pipeDiameterNormalized,
      rainfallIntensity: rainfallNormalized,
    });
    anomalies = [...anomalies, ...outlierAnomalies];
    
    const hasHighSeverityEmpty = anomalies.filter(a => a.severity === 'high' && a.type === 'empty_value');
    let failureReason: string | undefined;
    
    if (hasHighSeverityEmpty.length > 0) {
      failureReason = `关键字段缺失: ${hasHighSeverityEmpty.map(a => a.field).join(', ')}`;
    } else if (pipeDiameterNormalized === undefined ||
        data.pipeLength === undefined ||
        rainfallNormalized === undefined ||
        data.runoffCoefficient === undefined) {
      failureReason = '缺少必要的计算参数';
    }

    if (failureReason) {
      return {
        result: null,
        steps,
        anomalies,
        failureReason,
      };
    }

    const safePipeDiameter = pipeDiameterNormalized as number;
    const safeRainfall = rainfallNormalized as number;
    const safeRunoff = data.runoffCoefficient as number;

    const crossSectionalArea = Math.PI * Math.pow(safePipeDiameter / 2, 2);
    steps.push({
      stepId: 'step-3',
      description: '计算管道横截面积',
      input: { diameter: safePipeDiameter, unit: 'm' },
      output: { area: crossSectionalArea, unit: 'm²' },
      formula: `A = π * (d/2)² = π * (${safePipeDiameter}/2)²`
    });

    const flowVelocity = this.calculateFlowVelocity(crossSectionalArea, safeRainfall, safeRunoff);
    steps.push({
      stepId: 'step-4',
      description: '计算设计流量',
      input: {
        area: crossSectionalArea,
        rainfall: safeRainfall,
        coefficient: safeRunoff
      },
      output: { flow: flowVelocity, unit: 'm³/s' },
      formula: `Q = A * I * ψ = ${crossSectionalArea.toFixed(4)} * ${safeRainfall} * ${safeRunoff}`
    });

    const capacity = flowVelocity * 3600;
    steps.push({
      stepId: 'step-5',
      description: '计算小时容量',
      input: { flow: flowVelocity, unit: 'm³/s' },
      output: { capacity: capacity, unit: 'm³/h' },
      formula: `Capacity = Q * 3600 = ${flowVelocity.toFixed(4)} * 3600`
    });

    return {
      result: capacity,
      steps,
      anomalies,
    };
  }

  private calculateFlowVelocity(area: number, rainfall: number, coefficient: number): number {
    const rainfallMetersPerSecond = rainfall / 1000 / 3600;
    return area * rainfallMetersPerSecond * coefficient * 1000;
  }

  processRecord(record: EstimationRecord, allRecords: EstimationRecord[]): EstimationRecord {
    const { result, steps, anomalies, failureReason } = this.calculateCapacity(record.rawData);

    const allAnomalies = [
      ...anomalies,
      ...this.anomalyDetector.detectDuplicates(allRecords, record),
      ...this.anomalyDetector.detectUnitMismatch(record.rawData),
      ...this.anomalyDetector.detectBoundary(record.rawData),
    ];

    const hasBoundaryAnomaly = allAnomalies.some(a => a.type === 'boundary');
    const hasHighSeverity = allAnomalies.some(a => a.severity === 'high');

    let status: EstimationRecord['status'] = 'success';
    if (record.source === 'legacy') {
      status = 'legacy';
    } else if (failureReason) {
      status = 'error';
    } else if (hasBoundaryAnomaly || hasHighSeverity) {
      status = 'pending';
    }

    return {
      ...record,
      calculatedResult: result ? { capacity: result, unit: 'm³/h' } : undefined,
      calculationSteps: steps,
      anomalies: allAnomalies,
      status,
      failureReason,
    };
  }
}
