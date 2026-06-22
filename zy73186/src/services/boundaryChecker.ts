import type { BoundaryCondition, BoundaryCheckResult, ComputationStep, InputValue } from '../types';
import { convertUnit } from '../utils/unitConversion';

export const boundaryChecker = {
  parseBoundaryConditions(content: string, materialId?: string): BoundaryCondition[] {
    const conditions: BoundaryCondition[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const rangeMatch = line.match(
        /([a-zA-Z_][a-zA-Z0-9_\u2080-\u2089\u00B9\u00B2\u00B3\u2070\u2074-\u207F]*)\s*(?:[:：=]|∈)\s*\[?\s*([-+]?\d*\.?\d+)\s*[,，~]\s*([-+]?\d*\.?\d+)\s*\]?\s*(?:\(|（)?\s*([^)）]+)?/
      );

      if (rangeMatch) {
        const [, variable, lowerStr, upperStr, unitStr] = rangeMatch;
        const lowerBound = parseFloat(lowerStr);
        const upperBound = parseFloat(upperStr);
        const unit = unitStr?.trim() || '';

        if (!isNaN(lowerBound) && !isNaN(upperBound)) {
          conditions.push({
            variable,
            lowerBound,
            upperBound,
            unit,
            sourceMaterialId: materialId,
            sourceAnchor: line.substring(0, 50),
          });
        }
      }

      const limitMatch = line.match(
        /([a-zA-Z_][a-zA-Z0-9_\u2080-\u2089\u00B9\u00B2\u00B3\u2070\u2074-\u207F]*)\s*(?:≤|>=|<=|<|>)\s*([-+]?\d*\.?\d+)\s*(?:\(|（)?\s*([^)）]+)?/
      );

      if (limitMatch) {
        const [, variable, valueStr, unitStr] = limitMatch;
        const value = parseFloat(valueStr);
        const unit = unitStr?.trim() || '';
        const operator = line.match(/(≤|>=|<=|<|>)/)?.[0];

        if (!isNaN(value)) {
          if (operator === '≤' || operator === '<=' || operator === '<') {
            conditions.push({
              variable,
              lowerBound: -Infinity,
              upperBound: value,
              unit,
              sourceMaterialId: materialId,
              sourceAnchor: line.substring(0, 50),
            });
          } else {
            conditions.push({
              variable,
              lowerBound: value,
              upperBound: Infinity,
              unit,
              sourceMaterialId: materialId,
              sourceAnchor: line.substring(0, 50),
            });
          }
        }
      }
    }

    return conditions;
  },

  checkBoundary(
    variable: string,
    value: InputValue,
    condition: BoundaryCondition
  ): BoundaryCheckResult {
    let convertedValue = value.value;
    let convertedError = value.error || 0;
    let convertedLower = condition.lowerBound;
    let convertedUpper = condition.upperBound;

    if (value.unit && condition.unit && value.unit !== condition.unit) {
      const valueConversion = convertUnit(value.value, value.unit, condition.unit);
      if (valueConversion) {
        convertedValue = valueConversion.value;
        if (value.error) {
          const errorConversion = convertUnit(value.error, value.unit, condition.unit);
          convertedError = errorConversion?.value || value.error;
        }
      }
    }

    const valueWithErrorLower = convertedValue - convertedError;
    const valueWithErrorUpper = convertedValue + convertedError;

    let isWithinBounds = true;
    let violationType: BoundaryCheckResult['violationType'];
    let margin: number | undefined;

    if (valueWithErrorUpper > convertedUpper) {
      isWithinBounds = false;
      violationType = 'above_upper';
      margin = convertedUpper - valueWithErrorUpper;
    } else if (valueWithErrorLower < convertedLower) {
      isWithinBounds = false;
      violationType = 'below_lower';
      margin = valueWithErrorLower - convertedLower;
    } else {
      const lowerMargin = valueWithErrorLower - convertedLower;
      const upperMargin = convertedUpper - valueWithErrorUpper;
      margin = Math.min(lowerMargin, upperMargin);
    }

    const errorRange = convertedError * 2;
    const boundRange = convertedUpper - convertedLower;
    if (isFinite(boundRange) && errorRange > boundRange) {
      violationType = 'error_exceeds';
    }

    return {
      variable,
      value: convertedValue,
      error: convertedError,
      lowerBound: convertedLower,
      upperBound: convertedUpper,
      unit: condition.unit,
      isWithinBounds,
      violationType,
      margin,
      sourceMaterialId: condition.sourceMaterialId,
    };
  },

  checkAllBoundaries(
    steps: ComputationStep[],
    conditions: BoundaryCondition[]
  ): { checks: BoundaryCheckResult[]; passed: boolean } {
    const checks: BoundaryCheckResult[] = [];
    const finalStep = steps[steps.length - 1];

    for (const condition of conditions) {
      const inputValue = finalStep?.inputValues[condition.variable];
      if (inputValue) {
        const check = this.checkBoundary(condition.variable, inputValue, condition);
        checks.push(check);
      }
    }

    for (const step of steps) {
      for (const condition of conditions) {
        const inputValue = step.inputValues[condition.variable];
        if (inputValue && !checks.find((c) => c.variable === condition.variable)) {
          const check = this.checkBoundary(condition.variable, inputValue, condition);
          checks.push(check);
        }
      }
    }

    const passed = checks.length > 0 ? checks.every((c) => c.isWithinBounds) : true;

    return { checks, passed };
  },

  formatBoundaryCheck(check: BoundaryCheckResult): string {
    const boundsText =
      check.lowerBound === -Infinity
        ? `≤ ${check.upperBound}`
        : check.upperBound === Infinity
        ? `≥ ${check.lowerBound}`
        : `∈ [${check.lowerBound}, ${check.upperBound}]`;

    const valueText = `${check.value} ± ${check.error}`;
    const statusText = check.isWithinBounds ? '✓ 符合边界' : '✗ 超出边界';

    return `${check.variable}: ${valueText} ${check.unit} ${boundsText} ${check.unit} → ${statusText}`;
  },
};
