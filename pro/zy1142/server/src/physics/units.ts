import { unitConversions, defaultUnits } from './constants';
import { PhysicsParameter, ValidationError, ValidationResult } from '../../../shared/types';

export function convertToSI(value: number, unit: string, category: string): number {
  if (!unitConversions[category]) {
    return value;
  }
  const factor = unitConversions[category][unit];
  if (factor === undefined) {
    return value;
  }
  return value * factor;
}

export function convertFromSI(value: number, unit: string, category: string): number {
  if (!unitConversions[category]) {
    return value;
  }
  const factor = unitConversions[category][unit];
  if (factor === undefined) {
    return value;
  }
  return value / factor;
}

export function getParamValue(params: PhysicsParameter[], name: string): number {
  const param = params.find(p => p.name === name);
  if (!param) {
    throw new Error(`参数 ${name} 未找到`);
  }
  const defaultUnit = defaultUnits[name];
  if (defaultUnit && defaultUnit.category) {
    return convertToSI(param.value, param.unit, defaultUnit.category);
  }
  return param.value;
}

export function normalizeParameters(
  params: PhysicsParameter[],
  validParams: { name: string; min?: number; max?: number; positive?: boolean; required?: boolean }[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const normalizedParams: PhysicsParameter[] = [];

  for (const validParam of validParams) {
    const param = params.find(p => p.name === validParam.name);
    
    if (!param) {
      if (validParam.required !== false) {
        errors.push({
          field: validParam.name,
          message: `参数 ${validParam.name} 缺失`,
          rule: 'required',
        });
      }
      continue;
    }

    if (param.value === undefined || param.value === null) {
      errors.push({
        field: param.name,
        message: `参数 ${param.label} 的值不能为空`,
        value: param.value,
        rule: 'required',
      });
      continue;
    }

    if (isNaN(param.value)) {
      errors.push({
        field: param.name,
        message: `参数 ${param.label} 的值必须是有效的数字`,
        value: param.value,
        rule: 'valid_number',
      });
      continue;
    }

    if (validParam.positive !== false && param.value <= 0) {
      errors.push({
        field: param.name,
        message: `参数 ${param.label} 的值必须大于 0`,
        value: param.value,
        rule: 'positive',
      });
      continue;
    }

    if (validParam.min !== undefined && param.value < validParam.min) {
      errors.push({
        field: param.name,
        message: `参数 ${param.label} 的值不能小于 ${validParam.min}`,
        value: param.value,
        rule: 'min',
      });
      continue;
    }

    if (validParam.max !== undefined && param.value > validParam.max) {
      errors.push({
        field: param.name,
        message: `参数 ${param.label} 的值不能大于 ${validParam.max}`,
        value: param.value,
        rule: 'max',
      });
      continue;
    }

    if (param.unit === undefined || param.unit === null || param.unit === '') {
      const defaultUnit = defaultUnits[param.name];
      if (defaultUnit && defaultUnit.unit) {
        normalizedParams.push({
          ...param,
          unit: defaultUnit.unit,
        });
      } else {
        errors.push({
          field: param.name,
          message: `参数 ${param.label} 缺少单位`,
          value: param.value,
          rule: 'unit_required',
        });
        continue;
      }
    } else {
      normalizedParams.push(param);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedParams: errors.length === 0 ? normalizedParams : undefined,
  };
}

export function formatValue(value: number, significantFigures: number = 3): string {
  if (Math.abs(value) < 0.0001 || Math.abs(value) > 1000000) {
    return value.toExponential(significantFigures - 1);
  }
  return value.toPrecision(significantFigures);
}
