import {
  BatchStatus,
  InspectionType,
  TicketType,
  TemperatureUnit,
  WeightUnit,
  TemperatureCheckItem,
  WeightCheckItem,
  TicketItem,
  RejectionReason
} from './types';
import { Batch } from './models';
import { ValidationError } from './errors';

export interface TemperatureRule {
  min: number;
  max: number;
  unit: TemperatureUnit;
  materialCodes?: string[];
}

export interface WeightRule {
  maxDeviationPercent: number;
  minDeviationPercent?: number;
  materialCodes?: string[];
}

export interface TicketRule {
  requiredTypes: TicketType[];
  materialCodes?: string[];
}

export interface InspectionRules {
  temperature?: TemperatureRule;
  weight?: WeightRule;
  ticket?: TicketRule;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export class RuleEngine {
  private temperatureRules: Map<string, TemperatureRule> = new Map();
  private weightRules: Map<string, WeightRule> = new Map();
  private ticketRules: Map<string, TicketRule> = new Map();
  private defaultRules: InspectionRules = {
    temperature: { min: -18, max: 5, unit: TemperatureUnit.CELSIUS },
    weight: { maxDeviationPercent: 5 },
    ticket: { requiredTypes: [TicketType.QUALIFICATION_CERT, TicketType.DELIVER_NOTE] }
  };

  setTemperatureRule(materialCode: string, rule: TemperatureRule): void {
    this.temperatureRules.set(materialCode, rule);
  }

  setWeightRule(materialCode: string, rule: WeightRule): void {
    this.weightRules.set(materialCode, rule);
  }

  setTicketRule(materialCode: string, rule: TicketRule): void {
    this.ticketRules.set(materialCode, rule);
  }

  getTemperatureRule(materialCode: string): TemperatureRule {
    return this.temperatureRules.get(materialCode) || this.defaultRules.temperature!;
  }

  getWeightRule(materialCode: string): WeightRule {
    return this.weightRules.get(materialCode) || this.defaultRules.weight!;
  }

  getTicketRule(materialCode: string): TicketRule {
    return this.ticketRules.get(materialCode) || this.defaultRules.ticket!;
  }
}

export function validateTemperatureCheck(
  items: TemperatureCheckItem[],
  rule: TemperatureRule
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (!items || items.length === 0) {
    result.valid = false;
    result.errors.push(new ValidationError('温度检查项不能为空', 'items'));
    return result;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.location || item.location.trim() === '') {
      result.valid = false;
      result.errors.push(new ValidationError(`第 ${i + 1} 条测量位置不能为空`, `items[${i}].location`));
    }

    if (item.value === null || item.value === undefined) {
      result.valid = false;
      result.errors.push(new ValidationError(`第 ${i + 1} 条温度值不能为空`, `items[${i}].value`));
    } else {
      const normalizedValue = convertTemperature(item.value, item.unit, rule.unit);
      if (normalizedValue < rule.min || normalizedValue > rule.max) {
        result.valid = false;
        result.errors.push(new ValidationError(
          `第 ${i + 1} 条温度 ${item.value}°${item.unit} 超出允许范围 [${rule.min}°${rule.unit}, ${rule.max}°${rule.unit}]`,
          `items[${i}].value`,
          { location: item.location, actual: item.value, min: rule.min, max: rule.max }
        ));
      }
    }

    if (!item.measuredAt) {
      result.valid = false;
      result.errors.push(new ValidationError(`第 ${i + 1} 条测量时间不能为空`, `items[${i}].measuredAt`));
    }

    if (!item.operatorId || item.operatorId.trim() === '') {
      result.valid = false;
      result.errors.push(new ValidationError(`第 ${i + 1} 条操作员ID不能为空`, `items[${i}].operatorId`));
    }
  }

  return result;
}

export function validateWeightCheck(
  items: WeightCheckItem[],
  rule: WeightRule
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (!items || items.length === 0) {
    result.valid = false;
    result.errors.push(new ValidationError('重量检查项不能为空', 'items'));
    return result;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.expected === null || item.expected === undefined || item.expected <= 0) {
      result.valid = false;
      result.errors.push(new ValidationError(`第 ${i + 1} 条期望重量必须大于 0`, `items[${i}].expected`));
    }

    if (item.actual === null || item.actual === undefined || item.actual < 0) {
      result.valid = false;
      result.errors.push(new ValidationError(`第 ${i + 1} 条实际重量不能为负数`, `items[${i}].actual`));
    }

    if (item.expected > 0 && item.actual >= 0) {
      const deviationPercent = ((item.actual - item.expected) / item.expected) * 100;

      if (deviationPercent > rule.maxDeviationPercent) {
        result.valid = false;
        result.errors.push(new ValidationError(
          `第 ${i + 1} 条重量偏差 +${deviationPercent.toFixed(2)}% 超出最大允许偏差 +${rule.maxDeviationPercent}%`,
          `items[${i}].actual`,
          { expected: item.expected, actual: item.actual, deviationPercent }
        ));
      }

      if (rule.minDeviationPercent !== undefined && deviationPercent < rule.minDeviationPercent) {
        result.valid = false;
        result.errors.push(new ValidationError(
          `第 ${i + 1} 条重量偏差 ${deviationPercent.toFixed(2)}% 低于最小允许偏差 ${rule.minDeviationPercent}%`,
          `items[${i}].actual`,
          { expected: item.expected, actual: item.actual, deviationPercent }
        ));
      }
    }
  }

  return result;
}

export function validateTicketCheck(
  items: TicketItem[],
  rule: TicketRule
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (!items || items.length === 0) {
    result.valid = false;
    result.errors.push(new ValidationError('票证检查项不能为空', 'items'));
    return result;
  }

  const providedTypes = new Set<TicketType>();
  const validTypes = new Set<TicketType>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.type) {
      result.valid = false;
      result.errors.push(new ValidationError(`第 ${i + 1} 条票证类型不能为空`, `items[${i}].type`));
      continue;
    }

    if (item.provided) {
      providedTypes.add(item.type as TicketType);

      if (item.valid === false) {
        result.valid = false;
        result.errors.push(new ValidationError(
          `第 ${i + 1} 条票证 "${item.type}" 验证不通过`,
          `items[${i}].valid`,
          { type: item.type, ticketNumber: item.ticketNumber }
        ));
      } else if (item.valid === true) {
        validTypes.add(item.type as TicketType);
      }

      if (item.expiryDate && new Date() > item.expiryDate) {
        result.valid = false;
        result.errors.push(new ValidationError(
          `第 ${i + 1} 条票证 "${item.type}" 已过期`,
          `items[${i}].expiryDate`,
          { type: item.type, expiryDate: item.expiryDate }
        ));
      }
    }
  }

  for (const requiredType of rule.requiredTypes) {
    if (!providedTypes.has(requiredType)) {
      result.valid = false;
      result.errors.push(new ValidationError(
        `缺少必需的票证类型: "${requiredType}"`,
        'items',
        { requiredType, providedTypes: Array.from(providedTypes) }
      ));
    }
  }

  return result;
}

export function validateRejectionReasons(reasons: RejectionReason[]): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (!reasons || reasons.length === 0) {
    result.valid = false;
    result.errors.push(new ValidationError('拒收原因不能为空', 'reasons'));
    return result;
  }

  for (let i = 0; i < reasons.length; i++) {
    const reason = reasons[i];

    if (!reason.type) {
      result.valid = false;
      result.errors.push(new ValidationError(`第 ${i + 1} 条拒收原因类型不能为空`, `reasons[${i}].type`));
    }

    if (!reason.code || reason.code.trim() === '') {
      result.valid = false;
      result.errors.push(new ValidationError(`第 ${i + 1} 条拒收原因编码不能为空`, `reasons[${i}].code`));
    }

    if (!reason.description || reason.description.trim() === '') {
      result.valid = false;
      result.errors.push(new ValidationError(`第 ${i + 1} 条拒收原因描述不能为空`, `reasons[${i}].description`));
    }

    if (!reason.detail || reason.detail.trim() === '') {
      result.valid = false;
      result.errors.push(new ValidationError(`第 ${i + 1} 条拒收原因详情不能为空`, `reasons[${i}].detail`));
    }
  }

  return result;
}

export function calculateWeightDeviationPercent(expected: number, actual: number): number {
  if (expected <= 0) return 0;
  return ((actual - expected) / expected) * 100;
}

export function convertTemperature(
  value: number,
  from: TemperatureUnit,
  to: TemperatureUnit
): number {
  if (from === to) return value;

  if (from === TemperatureUnit.CELSIUS && to === TemperatureUnit.FAHRENHEIT) {
    return (value * 9 / 5) + 32;
  }

  if (from === TemperatureUnit.FAHRENHEIT && to === TemperatureUnit.CELSIUS) {
    return (value - 32) * 5 / 9;
  }

  return value;
}

export function canAcceptBatch(batch: Batch): boolean {
  return batch.status === BatchStatus.TICKET_CHECKED;
}

export function canRejectBatch(batch: Batch): boolean {
  return [
    BatchStatus.PENDING,
    BatchStatus.TEMPERATURE_CHECKED,
    BatchStatus.WEIGHT_CHECKED,
    BatchStatus.TICKET_CHECKED
  ].includes(batch.status);
}

export function canReplenishBatch(batch: Batch): boolean {
  return batch.status === BatchStatus.REJECTED;
}
