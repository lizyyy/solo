import type {
  Material,
  MaterialItem,
  MaterialSource,
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

const CANONICAL_UNIT: Record<string, string> = {
  ratio: '%',
  currency: '万元',
  time: '天',
  count: '次'
};

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
    material: Material,
    item: MaterialItem,
    config: CalculationConfig
  ): CalculationResult {
    const anomalies: AnomalyRecord[] = [];
    const traces: CalculationTrace[] = [];
    const materialId = material.id;

    const { canonicalName, isResolved } = this.aliasResolver.resolve(item.objectName);

    if (isResolved) {
      anomalies.push(this.createAnomaly(
        'alias',
        'info',
        `对象名称已标准化："${item.objectName}" → "${canonicalName}"`,
        { originalName: item.objectName, canonicalName }
      ));
    }

    const unitValidation = this.validateUnit(item.unit, canonicalName);
    if (!unitValidation.valid) {
      anomalies.push(this.createAnomaly(
        'unit',
        'error',
        unitValidation.message || `单位"${item.unit}"无法识别或与"${canonicalName}"不匹配`,
        { unit: item.unit, expectedUnits: unitValidation.expectedUnits || [] }
      ));
    }

    const { canonicalValue, canonicalUnit } = this.toCanonical(item.value, item.unit);

    if (unitValidation.valid && canonicalUnit !== item.unit) {
      traces.push({
        step: traces.length + 1,
        formula: `单位换算：${item.value}${item.unit} × 换算系数 = ${canonicalValue}${canonicalUnit}`,
        inputs: { value: item.value, factor: this.getUnitDefinition(item.unit)?.conversionFactor ?? 1 },
        result: canonicalValue,
        source: 'unit_conversion'
      });
    }

    const threshold = this.findThreshold(canonicalName);
    if (!threshold) {
      anomalies.push(this.createAnomaly(
        'threshold',
        'warning',
        `未找到"${canonicalName}"对应的阈值定义，边界无法判定，卡在阈值不清`,
        { objectName: canonicalName }
      ));
    }

    const formulaValidation = this.validateFormula(canonicalName);
    const canCalculate = unitValidation.valid && formulaValidation.valid;
    if (!formulaValidation.valid) {
      anomalies.push(this.createAnomaly(
        'formula',
        'error',
        formulaValidation.message || `无法计算"${canonicalName}"的概率值，卡在公式缺失`,
        { objectName: canonicalName, formula: formulaValidation.formula || '' }
      ));
    }

    let probability = 0;
    if (canCalculate) {
      const probabilityResult = this.calculateProbability(canonicalValue, canonicalName);
      probability = probabilityResult.value;
      traces.push({
        step: traces.length + 1,
        formula: probabilityResult.formula,
        inputs: probabilityResult.inputs,
        result: probabilityResult.value,
        source: 'probability_calculation'
      });
    }

    let extrapolation: ExtrapolationInfo | undefined;
    if (threshold && this.needsExtrapolation(canonicalValue, threshold)) {
      extrapolation = this.checkExtrapolation(canonicalValue, threshold, config);
      anomalies.push(this.createAnomaly(
        'extrapolation',
        'warning',
        `值${canonicalValue}${canonicalUnit}超出建模样本范围[${threshold.minValue}, ${threshold.maxValue}]${threshold.unit}，使用${extrapolation.method}外推`,
        {
          originalValue: canonicalValue,
          originalRange: [threshold.minValue, threshold.maxValue],
          extrapolatedValue: extrapolation.extrapolatedValue,
          direction: extrapolation.direction
        }
      ));
    }

    const boundUnit = threshold ? threshold.unit : canonicalUnit;
    let isWithinBounds = true;
    if (threshold) {
      isWithinBounds = canonicalValue >= threshold.minValue && canonicalValue <= threshold.maxValue;
      if (!isWithinBounds) {
        const direction = canonicalValue > threshold.maxValue ? '高于上限' : '低于下限';
        anomalies.push(this.createAnomaly(
          'threshold',
          'error',
          `"${canonicalName}"=${canonicalValue}${boundUnit} ${direction}，阈值范围[${threshold.minValue}, ${threshold.maxValue}]${boundUnit}（百分比语义比较）`,
          {
            value: canonicalValue,
            unit: boundUnit,
            threshold: { min: threshold.minValue, max: threshold.maxValue },
            direction
          }
        ));
      }
    } else if (!canCalculate) {
      isWithinBounds = false;
    }

    const status: ReviewStatus = !canCalculate
      ? 'error'
      : anomalies.some((a) => a.severity === 'error')
        ? 'error'
        : anomalies.some((a) => a.severity === 'warning')
          ? 'warning'
          : 'completed';

    const lowerBound = threshold ? threshold.minValue : 0;
    const upperBound = threshold ? threshold.maxValue : canonicalValue * 2 || 1;

    const source = material.materials[item.sourceIndex] || material.materials[0];
    const sourceContext = this.findSourceContext(source, item);

    const record: BoundaryRecord = {
      id: generateId(),
      materialId,
      objectName: item.objectName,
      canonicalName,
      inputValue: item.value,
      inputUnit: item.unit,
      calculatedValue: canonicalValue,
      calculatedUnit: canonicalUnit,
      probability,
      lowerBound,
      upperBound,
      boundUnit,
      isWithinBounds,
      status,
      caliberVersionId: this.caliber.id,
      anomalies: [],
      extrapolation,
      calculationTrace: traces,
      sourceIndex: item.sourceIndex,
      sourceName: source?.name || '未知来源',
      sourceType: source?.type || 'file',
      sourceContext,
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
    blockType: BlockType,
    severity: 'error' | 'warning' | 'info',
    message: string,
    details: Record<string, unknown>
  ): AnomalyRecord {
    return {
      id: generateId(),
      boundaryRecordId: '',
      blockType,
      severity,
      message,
      details,
      resolved: false,
      createdAt: new Date().toISOString()
    };
  }

  private getUnitDefinition(unit: string): UnitDefinition | undefined {
    return this.caliber.units.find((u) => u.symbol === unit || u.name === unit);
  }

  private toCanonical(value: number, unit: string): { canonicalValue: number; canonicalUnit: string; category: string } {
    const def = this.getUnitDefinition(unit);
    if (!def) {
      return { canonicalValue: value, canonicalUnit: unit, category: 'unknown' };
    }
    return {
      canonicalValue: value * def.conversionFactor,
      canonicalUnit: CANONICAL_UNIT[def.category] || unit,
      category: def.category
    };
  }

  private getCategory(canonicalName: string): string {
    if (canonicalName.includes('概率') || canonicalName.includes('率') || canonicalName.includes('损失率')) {
      return 'ratio';
    }
    if (canonicalName.includes('敞口') || canonicalName.includes('损失金额') || canonicalName.includes('金额') || canonicalName.includes('暴露')) {
      return 'currency';
    }
    if (canonicalName.includes('天数') || canonicalName.includes('期限') || canonicalName.includes('逾期')) {
      return 'time';
    }
    return 'unknown';
  }

  private getExpectedUnits(canonicalName: string): string[] {
    const category = this.getCategory(canonicalName);
    if (category === 'unknown') return [];
    return this.caliber.units
      .filter((u) => u.category === category)
      .map((u) => u.symbol);
  }

  private validateUnit(unit: string, canonicalName: string): {
    valid: boolean;
    message?: string;
    expectedUnits?: string[];
  } {
    const def = this.getUnitDefinition(unit);
    if (!def) {
      return {
        valid: false,
        message: `单位"${unit}"不在当前口径定义中，单位冲突，无法换算`,
        expectedUnits: this.getExpectedUnits(canonicalName)
      };
    }
    const expectedCategory = this.getCategory(canonicalName);
    if (expectedCategory !== 'unknown' && def.category !== expectedCategory) {
      return {
        valid: false,
        message: `单位类别不匹配：期望${expectedCategory}类单位，实际为${def.category}类，单位冲突`,
        expectedUnits: this.getExpectedUnits(canonicalName)
      };
    }
    return { valid: true };
  }

  private findThreshold(objectName: string): ThresholdDefinition | undefined {
    const name = objectName.toLowerCase();

    if (name.includes('违约概率') || name.includes('pd') || name.includes('不良概率') || name.includes('违约率') || name.includes('损失率') || name.includes('lgd')) {
      const t = this.caliber.thresholds.find((t) => t.name.includes('违约概率'));
      if (t) return t;
    }
    if (name.includes('损失') || name.includes('金额') || name.includes('敞口') || name.includes('ead') || name.includes('暴露')) {
      const t = this.caliber.thresholds.find((t) => t.name.includes('损失金额'));
      if (t) return t;
    }
    if (name.includes('逾期') || name.includes('天数')) {
      const t = this.caliber.thresholds.find((t) => t.name.includes('逾期天数'));
      if (t) return t;
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
        message: `未找到与"${objectName}"相关的计算公式，公式缺失，无法计算概率`
      };
    }

    return { valid: true, formula: formula.expression };
  }

  private calculateProbability(
    value: number,
    objectName: string
  ): { value: number; formula: string; inputs: Record<string, number> } {
    const threshold = this.findThreshold(objectName);
    const mean = threshold ? (threshold.minValue + threshold.maxValue) / 2 : value;
    const stdDev = threshold ? Math.max((threshold.maxValue - threshold.minValue) / 4, 0.0001) : Math.max(value * 0.1, 0.0001);

    const zScore = stdDev === 0 ? 0 : (value - mean) / stdDev;
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
    return value < threshold.minValue || value > threshold.maxValue * 1.5;
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

    const range = threshold.maxValue - threshold.minValue;
    const deviation = range === 0 ? 0 : Math.abs(value - (threshold.minValue + threshold.maxValue) / 2) / (range / 2);

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
    const base = direction === 'up' ? threshold.maxValue : threshold.minValue;
    const distance = base === 0
      ? Math.abs(value).toFixed(1)
      : (((value - base) / base) * 100).toFixed(1);

    return `当前值超出阈值范围约${distance}%，收尾建议：
1. 核查数据来源是否准确
2. 考虑增加样本量以降低不确定性
3. 设置审慎调整因子（建议系数：${direction === 'up' ? '1.2-1.5' : '0.7-0.9'}）
4. 人工复核并记录审批意见
5. 与业务部门沟通确认风险容忍度`;
  }

  private findSourceContext(source: MaterialSource | undefined, item: MaterialItem): string {
    if (!source) return '';
    const content = source.content || '';
    const lines = content.split('\n');
    const valueStr = String(item.value);
    const matched = lines.find((l) => l.includes(item.objectName) || (valueStr && l.includes(valueStr)));
    return (matched || lines[0] || content).slice(0, 200);
  }

  getBlockTypeDescription(type: BlockType): string {
    const descriptions: Record<BlockType, string> = {
      formula: '公式校验',
      unit: '单位校验',
      threshold: '阈值校验',
      extrapolation: '外推检测',
      alias: '别名解析',
      consistency: '材料一致性',
      caliber: '口径变更'
    };
    return descriptions[type];
  }
}
