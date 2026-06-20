import type {
  MaterialItem,
  BoundaryRecord,
  AnomalyRecord,
  CaliberVersion,
  ThresholdDefinition,
  UnitDefinition,
  CalculationTrace,
  ExtrapolationInfo,
  BlockType,
  ReviewStatus
} from '../types';
import { AliasResolver } from './aliasResolver';
import { generateId } from '../data/mockData';

export interface CalculationConfig {
  confidenceLevel: number;
  sampleSize: number;
  useExtrapolation: boolean;
}

export interface CalculationResult {
  record: BoundaryRecord;
  anomalies: AnomalyRecord[];
  traces: CalculationTrace[];
}

export class BoundaryCalculationEngine {
  private caliber: CaliberVersion;
  private aliasResolver: AliasResolver;

  constructor(caliber: CaliberVersion, aliasResolver: AliasResolver) {
    this.caliber = caliber;
    this.aliasResolver = aliasResolver;
  }

  updateCaliber(caliber: CaliberVersion): void {
    this.caliber = caliber;
  }

  calculate(
    materialId: string,
    item: MaterialItem,
    config: CalculationConfig
  ): CalculationResult {
    const anomalies: AnomalyRecord[] = [];
    const traces: CalculationTrace[] = [];
    let step = 0;

    const { canonicalName, isResolved } = this.aliasResolver.resolve(item.objectName);

    if (isResolved) {
      anomalies.push(this.createAnomaly(
        '',
        'alias',
        'info',
        `对象名称已标准化："${item.objectName}" → "${canonicalName}"`,
        { originalName: item.objectName, canonicalName }
      ));
    }

    const unitValidation = this.validateUnit(item.unit, canonicalName);
    if (!unitValidation.valid) {
      anomalies.push(this.createAnomaly(
        '',
        'unit',
        'error',
        unitValidation.message || `单位"${item.unit}"无法识别或与"${canonicalName}"不匹配`,
        { unit: item.unit, expectedUnits: unitValidation.expectedUnits }
      ));
    } else if (unitValidation.needsConversion && unitValidation.conversionFactor) {
      traces.push({
        step: ++step,
        formula: `单位转换：${item.unit} → ${unitValidation.targetUnit}`,
        inputs: { value: item.value, factor: unitValidation.conversionFactor },
        result: item.value * unitValidation.conversionFactor,
        source: 'unit_conversion'
      });
    }

    const baseValue = unitValidation.valid 
      ? item.value * (unitValidation.conversionFactor ?? 1)
      : item.value;

    const threshold = this.findThreshold(canonicalName);
    if (!threshold) {
      anomalies.push(this.createAnomaly(
        '',
        'threshold',
        'warning',
        `未找到"${canonicalName}"对应的阈值定义，跳过边界校验`,
        { objectName: canonicalName }
      ));
    }

    const formulaValidation = this.validateFormula(canonicalName);
    if (!formulaValidation.valid) {
      anomalies.push(this.createAnomaly(
        '',
        'formula',
        'error',
        formulaValidation.message || `无法计算"${canonicalName}"的概率值`,
        { objectName: canonicalName, formula: formulaValidation.formula }
      ));
    }

    const probabilityResult = this.calculateProbability(baseValue, canonicalName, config);
    traces.push({
      step: ++step,
      formula: probabilityResult.formula,
      inputs: probabilityResult.inputs,
      result: probabilityResult.value,
      source: 'probability_calculation'
    });

    let extrapolation: ExtrapolationInfo | undefined;
    if (threshold && this.needsExtrapolation(baseValue, threshold)) {
      extrapolation = this.checkExtrapolation(baseValue, threshold, config);
      anomalies.push(this.createAnomaly(
        '',
        'extrapolation',
        'warning',
        `值${baseValue}${item.unit}超出建模样本范围，使用${extrapolation.method}外推`,
        {
          originalValue: baseValue,
          originalRange: threshold,
          extrapolatedValue: extrapolation.extrapolatedValue,
          direction: extrapolation.direction
        }
      ));
    }

    let isWithinBounds = true;
    if (threshold) {
      const normalizedValue = this.normalizeValue(baseValue, item.unit, threshold.unit);
      isWithinBounds = normalizedValue >= threshold.minValue && normalizedValue <= threshold.maxValue;

      if (!isWithinBounds) {
        const direction = normalizedValue > threshold.maxValue ? '高于上限' : '低于下限';
        anomalies.push(this.createAnomaly(
          '',
          'threshold',
          'error',
          `"${canonicalName}"=${normalizedValue}${threshold.unit} ${direction}，阈值范围[${threshold.minValue}, ${threshold.maxValue}]${threshold.unit}`,
          {
            value: normalizedValue,
            threshold: { min: threshold.minValue, max: threshold.maxValue },
            unit: threshold.unit,
            direction
          }
        ));
      }
    }

    const status: ReviewStatus = anomalies.some((a) => a.severity === 'error')
      ? 'error'
      : anomalies.some((a) => a.severity === 'warning')
        ? 'warning'
        : 'completed';

    const lowerBound = threshold ? threshold.minValue : 0;
    const upperBound = threshold ? threshold.maxValue : baseValue * 2;

    const record: BoundaryRecord = {
      id: generateId(),
      materialId,
      objectName: item.objectName,
      canonicalName,
      inputValue: item.value,
      inputUnit: item.unit,
      calculatedValue: baseValue,
      probability: probabilityResult.value,
      lowerBound,
      upperBound,
      isWithinBounds,
      status,
      caliberVersionId: this.caliber.id,
      anomalies: [],
      extrapolation,
      calculationTrace: traces,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    anomalies.forEach((a) => {
      a.boundaryRecordId = record.id;
    });
    record.anomalies = anomalies;

    return { record, anomalies, traces };
  }

  private createAnomaly(
    boundaryRecordId: string,
    blockType: BlockType,
    severity: 'error' | 'warning' | 'info',
    message: string,
    details: Record<string, unknown>
  ): AnomalyRecord {
    return {
      id: generateId(),
      boundaryRecordId,
      blockType,
      severity,
      message,
      details,
      resolved: false,
      createdAt: new Date().toISOString()
    };
  }

  private validateUnit(unit: string, objectName: string): {
    valid: boolean;
    needsConversion: boolean;
    conversionFactor?: number;
    targetUnit?: string;
    message?: string;
    expectedUnits?: string[];
  } {
    const probabilityUnits = ['%', '百分比', 'percent'];
    const currencyUnits = ['万元', '亿元', '元', '万', '亿'];
    const timeUnits = ['天', '日', '年', '月'];

    let expectedUnits: string[] = [];
    
    if (objectName.includes('概率') || objectName.includes('率') || objectName.includes('PD') || objectName.includes('LGD')) {
      expectedUnits = probabilityUnits;
    } else if (objectName.includes('敞口') || objectName.includes('损失') || objectName.includes('金额') || objectName.includes('EAD')) {
      expectedUnits = currencyUnits;
    } else if (objectName.includes('天数') || objectName.includes('期限') || objectName.includes('逾期')) {
      expectedUnits = timeUnits;
    }

    if (expectedUnits.length === 0) {
      return { valid: true, needsConversion: false };
    }

    const unitDef = this.caliber.units.find((u) => 
      u.symbol === unit || u.name === unit
    );

    if (!unitDef) {
      return {
        valid: false,
        needsConversion: false,
        message: `单位"${unit}"不在当前口径定义中`,
        expectedUnits
      };
    }

    const category = this.getUnitCategory(objectName);
    if (unitDef.category !== category && category !== 'unknown') {
      return {
        valid: false,
        needsConversion: false,
        message: `单位类别不匹配：期望${category}类单位，实际为${unitDef.category}类`,
        expectedUnits
      };
    }

    if (unit === '亿元' && category === 'currency') {
      return {
        valid: true,
        needsConversion: true,
        conversionFactor: 10000,
        targetUnit: '万元'
      };
    }

    return { valid: true, needsConversion: false };
  }

  private getUnitCategory(objectName: string): string {
    if (objectName.includes('概率') || objectName.includes('率') || objectName.includes('PD') || objectName.includes('LGD')) {
      return 'ratio';
    }
    if (objectName.includes('敞口') || objectName.includes('损失') || objectName.includes('金额') || objectName.includes('EAD')) {
      return 'currency';
    }
    if (objectName.includes('天数') || objectName.includes('期限') || objectName.includes('逾期')) {
      return 'time';
    }
    return 'unknown';
  }

  private findThreshold(objectName: string): ThresholdDefinition | undefined {
    const name = objectName.toLowerCase();
    
    if (name.includes('违约概率') || name.includes('pd') || name.includes('不良概率') || name.includes('违约率')) {
      return this.caliber.thresholds.find((t) => t.name.includes('违约概率'));
    }
    if (name.includes('损失') || name.includes('金额') || name.includes('敞口') || name.includes('ead')) {
      return this.caliber.thresholds.find((t) => t.name.includes('损失金额'));
    }
    if (name.includes('逾期') || name.includes('天数')) {
      return this.caliber.thresholds.find((t) => t.name.includes('逾期天数'));
    }
    
    return undefined;
  }

  private validateFormula(objectName: string): {
    valid: boolean;
    formula?: string;
    message?: string;
  } {
    const formula = this.caliber.formulas.find((f) => 
      f.name.includes('概率') || f.variables.some((v) => objectName.includes(v))
    );

    if (!formula) {
      return {
        valid: false,
        message: `未找到与"${objectName}"相关的计算公式`
      };
    }

    return { valid: true, formula: formula.expression };
  }

  private calculateProbability(
    value: number,
    objectName: string,
    _config: CalculationConfig
  ): { value: number; formula: string; inputs: Record<string, number> } {
    const threshold = this.findThreshold(objectName);
    const mean = threshold ? (threshold.minValue + threshold.maxValue) / 2 : value;
    const stdDev = threshold ? (threshold.maxValue - threshold.minValue) / 4 : value * 0.1;

    const zScore = (value - mean) / stdDev;
    const probability = this.normalCDF(zScore);

    const formula = this.caliber.formulas.find((f) => f.name.includes('概率'));

    return {
      value: Math.min(Math.max(probability, 0), 1),
      formula: formula?.expression || 'P = Φ((X - μ) / σ)',
      inputs: {
        X: value,
        μ: mean,
        σ: stdDev,
        Z: zScore
      }
    };
  }

  private normalCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  }

  private needsExtrapolation(value: number, threshold: ThresholdDefinition): boolean {
    return value < threshold.minValue * 0.1 || value > threshold.maxValue * 1.5;
  }

  private checkExtrapolation(
    value: number,
    threshold: ThresholdDefinition,
    config: CalculationConfig
  ): ExtrapolationInfo {
    const direction = value > threshold.maxValue ? 'up' : value < threshold.minValue ? 'down' : 'both';
    const extrapolatedValue = value > threshold.maxValue 
      ? threshold.maxValue * (1 + config.confidenceLevel / 100)
      : threshold.minValue * (1 - config.confidenceLevel / 200);

    const impactScope = this.getImpactScope(value, threshold);

    return {
      direction,
      originalRange: [threshold.minValue, threshold.maxValue],
      extrapolatedValue,
      impactScope,
      suggestion: this.getExtrapolationSuggestion(direction, value, threshold),
      method: '极端值理论(EVT)'
    };
  }

  private getImpactScope(value: number, threshold: ThresholdDefinition): string[] {
    const scope: string[] = ['概率模拟结果'];
    
    const deviation = Math.abs(value - (threshold.minValue + threshold.maxValue) / 2) 
      / ((threshold.maxValue - threshold.minValue) / 2);
    
    if (deviation > 1) {
      scope.push('风险加权资产计算');
      scope.push('资本充足率');
    }
    if (deviation > 2) {
      scope.push('监管报表');
      scope.push('内部评级体系');
    }
    
    return scope;
  }

  private getExtrapolationSuggestion(
    direction: string,
    value: number,
    threshold: ThresholdDefinition
  ): string {
    const distance = direction === 'up' 
      ? ((value - threshold.maxValue) / threshold.maxValue * 100).toFixed(1)
      : ((threshold.minValue - value) / threshold.minValue * 100).toFixed(1);

    return `当前值超出阈值范围约${distance}%，建议：
1. 核查数据来源是否准确
2. 考虑增加样本量以降低不确定性
3. 设置审慎调整因子（建议系数: ${direction === 'up' ? '1.2-1.5' : '0.7-0.9'}）
4. 人工复核并记录审批意见
5. 与业务部门沟通确认风险容忍度`;
  }

  private normalizeValue(value: number, inputUnit: string, thresholdUnit: string): number {
    if (inputUnit === thresholdUnit) return value;
    
    const unitDefs: UnitDefinition[] = this.caliber.units;
    const inputDef = unitDefs.find((u) => u.symbol === inputUnit || u.name === inputUnit);
    const thresholdDef = unitDefs.find((u) => u.symbol === thresholdUnit || u.name === thresholdUnit);

    if (inputDef && thresholdDef && inputDef.category === thresholdDef.category) {
      return value * inputDef.conversionFactor / thresholdDef.conversionFactor;
    }

    return value;
  }

  getBlockTypeDescription(type: BlockType): string {
    const descriptions: Record<BlockType, string> = {
      formula: '公式校验',
      unit: '单位校验',
      threshold: '阈值校验',
      extrapolation: '外推检测',
      alias: '别名解析'
    };
    return descriptions[type];
  }
}
