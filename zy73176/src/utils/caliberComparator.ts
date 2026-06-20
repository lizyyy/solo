import type { CaliberVersion, ThresholdDefinition, FormulaDefinition, UnitDefinition } from '../types';

export interface ChangeDetail {
  type: 'added' | 'removed' | 'modified';
  field: string;
  oldValue: string;
  newValue: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
}

export interface CaliberComparison {
  version1: string;
  version2: string;
  changes: ChangeDetail[];
  summary: {
    totalChanges: number;
    highImpact: number;
    mediumImpact: number;
    lowImpact: number;
    backwardCompatible: boolean;
  };
}

export class CaliberComparator {
  static compare(v1: CaliberVersion, v2: CaliberVersion): CaliberComparison {
    const changes: ChangeDetail[] = [];

    changes.push(...this.compareFormulas(v1.formulas, v2.formulas));
    changes.push(...this.compareUnits(v1.units, v2.units));
    changes.push(...this.compareThresholds(v1.thresholds, v2.thresholds));

    const highImpact = changes.filter((c) => c.impact === 'high').length;
    const mediumImpact = changes.filter((c) => c.impact === 'medium').length;
    const lowImpact = changes.filter((c) => c.impact === 'low').length;

    return {
      version1: v1.version,
      version2: v2.version,
      changes,
      summary: {
        totalChanges: changes.length,
        highImpact,
        mediumImpact,
        lowImpact,
        backwardCompatible: highImpact === 0
      }
    };
  }

  private static compareFormulas(f1: FormulaDefinition[], f2: FormulaDefinition[]): ChangeDetail[] {
    const changes: ChangeDetail[] = [];
    const f1Map = new Map(f1.map((f) => [f.name, f]));
    const f2Map = new Map(f2.map((f) => [f.name, f]));

    for (const [name, formula] of f1Map) {
      if (!f2Map.has(name)) {
        changes.push({
          type: 'removed',
          field: `formula.${name}`,
          oldValue: formula.expression,
          newValue: '(已删除)',
          impact: 'high',
          description: `公式"${name}"已被删除，可能影响依赖此公式的计算`
        });
      } else {
        const f2Formula = f2Map.get(name)!;
        if (formula.expression !== f2Formula.expression) {
          changes.push({
            type: 'modified',
            field: `formula.${name}.expression`,
            oldValue: formula.expression,
            newValue: f2Formula.expression,
            impact: 'high',
            description: `公式"${name}"的计算表达式已变更`
          });
        }
        if (JSON.stringify(formula.variables) !== JSON.stringify(f2Formula.variables)) {
          changes.push({
            type: 'modified',
            field: `formula.${name}.variables`,
            oldValue: formula.variables.join(', '),
            newValue: f2Formula.variables.join(', '),
            impact: 'medium',
            description: `公式"${name}"的变量列表已变更`
          });
        }
      }
    }

    for (const [name, formula] of f2Map) {
      if (!f1Map.has(name)) {
        changes.push({
          type: 'added',
          field: `formula.${name}`,
          oldValue: '(新增)',
          newValue: formula.expression,
          impact: 'medium',
          description: `新增公式"${name}"`
        });
      }
    }

    return changes;
  }

  private static compareUnits(u1: UnitDefinition[], u2: UnitDefinition[]): ChangeDetail[] {
    const changes: ChangeDetail[] = [];
    const u1Map = new Map(u1.map((u) => [u.symbol, u]));
    const u2Map = new Map(u2.map((u) => [u.symbol, u]));

    for (const [symbol, unit] of u1Map) {
      if (!u2Map.has(symbol)) {
        changes.push({
          type: 'removed',
          field: `unit.${symbol}`,
          oldValue: `${unit.name} (${unit.category})`,
          newValue: '(已删除)',
          impact: 'medium',
          description: `单位"${symbol}"已被删除`
        });
      } else {
        const u2Unit = u2Map.get(symbol)!;
        if (unit.conversionFactor !== u2Unit.conversionFactor) {
          changes.push({
            type: 'modified',
            field: `unit.${symbol}.conversionFactor`,
            oldValue: unit.conversionFactor.toString(),
            newValue: u2Unit.conversionFactor.toString(),
            impact: 'high',
            description: `单位"${symbol}"的换算系数已变更`
          });
        }
      }
    }

    for (const [symbol, unit] of u2Map) {
      if (!u1Map.has(symbol)) {
        changes.push({
          type: 'added',
          field: `unit.${symbol}`,
          oldValue: '(新增)',
          newValue: `${unit.name} (${unit.category})`,
          impact: 'low',
          description: `新增单位"${symbol}"`
        });
      }
    }

    return changes;
  }

  private static compareThresholds(t1: ThresholdDefinition[], t2: ThresholdDefinition[]): ChangeDetail[] {
    const changes: ChangeDetail[] = [];
    const t1Map = new Map(t1.map((t) => [t.name, t]));
    const t2Map = new Map(t2.map((t) => [t.name, t]));

    for (const [name, threshold] of t1Map) {
      if (!t2Map.has(name)) {
        changes.push({
          type: 'removed',
          field: `threshold.${name}`,
          oldValue: `[${threshold.minValue}, ${threshold.maxValue}] ${threshold.unit}`,
          newValue: '(已删除)',
          impact: 'high',
          description: `阈值"${name}"已被删除`
        });
      } else {
        const t2Threshold = t2Map.get(name)!;
        if (threshold.minValue !== t2Threshold.minValue || threshold.maxValue !== t2Threshold.maxValue) {
          const tightened = t2Threshold.minValue > threshold.minValue || t2Threshold.maxValue < threshold.maxValue;
          changes.push({
            type: 'modified',
            field: `threshold.${name}.range`,
            oldValue: `[${threshold.minValue}, ${threshold.maxValue}] ${threshold.unit}`,
            newValue: `[${t2Threshold.minValue}, ${t2Threshold.maxValue}] ${t2Threshold.unit}`,
            impact: tightened ? 'high' : 'medium',
            description: `阈值"${name}"的范围已${tightened ? '收紧' : '放宽'}`
          });
        }
      }
    }

    for (const [name, threshold] of t2Map) {
      if (!t1Map.has(name)) {
        changes.push({
          type: 'added',
          field: `threshold.${name}`,
          oldValue: '(新增)',
          newValue: `[${threshold.minValue}, ${threshold.maxValue}] ${threshold.unit}`,
          impact: 'high',
          description: `新增阈值"${name}"`
        });
      }
    }

    return changes;
  }

  static getChangeImpactBadge(impact: string): { label: string; class: string } {
    switch (impact) {
      case 'high':
        return { label: '高影响', class: 'bg-red-100 text-red-700 border-red-200' };
      case 'medium':
        return { label: '中影响', class: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
      case 'low':
        return { label: '低影响', class: 'bg-green-100 text-green-700 border-green-200' };
      default:
        return { label: '未知', class: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  }

  static generateChangeSummary(changes: ChangeDetail[]): string {
    const byType = changes.reduce((acc, change) => {
      acc[change.type] = (acc[change.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byImpact = changes.reduce((acc, change) => {
      acc[change.impact] = (acc[change.impact] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const parts: string[] = [];
    if (byType.added) parts.push(`新增${byType.added}项`);
    if (byType.removed) parts.push(`删除${byType.removed}项`);
    if (byType.modified) parts.push(`修改${byType.modified}项`);

    const impactParts: string[] = [];
    if (byImpact.high) impactParts.push(`高影响${byImpact.high}项`);
    if (byImpact.medium) impactParts.push(`中影响${byImpact.medium}项`);
    if (byImpact.low) impactParts.push(`低影响${byImpact.low}项`);

    return `${parts.join('，')}；${impactParts.join('，')}`;
  }
}
