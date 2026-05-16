import { BaseGenerator } from './base';
import { listAllFields, getFieldType } from '../utils/helpers';

export class InvalidGenerator extends BaseGenerator {
  private invalidators: Array<{ name: string; fn: (data: Record<string, unknown>, field: string, fieldType: string) => void }>;

  constructor(schema: Record<string, unknown>, seed: number) {
    super(schema, seed);
    this.invalidators = [
      { name: '类型错误: 用数值代替字符串', fn: this.invalidTypeNumberForString },
      { name: '类型错误: 用字符串代替数值', fn: this.invalidTypeStringForNumber },
      { name: '类型错误: 用null代替对象', fn: this.invalidTypeNullForObject },
      { name: '必填字段缺失', fn: this.removeRequiredField },
      { name: '字符串超出最大长度', fn: this.stringExceedsMaxLength },
      { name: '数值超出最大值', fn: this.numberExceedsMax },
      { name: '数值低于最小值', fn: this.numberBelowMin },
      { name: '枚举值不在允许列表', fn: this.invalidEnumValue }
    ];
  }

  generate(index: number, fieldPath?: string): { data: unknown; reason: string } {
    const data = this.generateValid() as Record<string, unknown>;
    const allFields = listAllFields(this.schema);

    if (allFields.length === 0) {
      this.makeGenericInvalid(data);
      return { data, reason: '通用非法样本: 修改整体结构' };
    }

    const targetField = fieldPath || allFields[index % allFields.length];
    const fieldType = getFieldType(this.schema, targetField);
    const invalidatorIndex = Math.floor(index / allFields.length) % this.invalidators.length;
    const invalidator = this.invalidators[invalidatorIndex];

    try {
      invalidator.fn.call(this, data, targetField, fieldType);
      return {
        data,
        reason: `${invalidator.name} - 字段: ${targetField}`
      };
    } catch {
      this.makeGenericInvalid(data);
      return {
        data,
        reason: `专用非法样本生成失败，使用通用非法样本`
      };
    }
  }

  private invalidTypeNumberForString(data: Record<string, unknown>, field: string, fieldType: string): void {
    if (fieldType === 'string') {
      this.setPropertyAtPath(data, field, 12345);
    }
  }

  private invalidTypeStringForNumber(data: Record<string, unknown>, field: string, fieldType: string): void {
    if (fieldType === 'integer' || fieldType === 'number') {
      this.setPropertyAtPath(data, field, 'not-a-number');
    }
  }

  private invalidTypeNullForObject(data: Record<string, unknown>, field: string, fieldType: string): void {
    if (fieldType === 'object') {
      this.setPropertyAtPath(data, field, null);
    }
  }

  private removeRequiredField(data: Record<string, unknown>, field: string): void {
    const parts = field.split('.').filter(Boolean);
    if (parts.length === 1) {
      delete data[parts[0]];
    } else {
      const parentPath = parts.slice(0, -1).join('.');
      const parent = this.getPropertyAtPath(data, parentPath);
      if (parent && typeof parent.value === 'object' && parent.value !== null) {
        delete (parent.value as Record<string, unknown>)[parts[parts.length - 1]];
      }
    }
  }

  private stringExceedsMaxLength(data: Record<string, unknown>, field: string, fieldType: string): void {
    if (fieldType === 'string') {
      this.setPropertyAtPath(data, field, 'a'.repeat(10000));
    }
  }

  private numberExceedsMax(data: Record<string, unknown>, field: string, fieldType: string): void {
    if (fieldType === 'integer' || fieldType === 'number') {
      this.setPropertyAtPath(data, field, Number.MAX_SAFE_INTEGER);
    }
  }

  private numberBelowMin(data: Record<string, unknown>, field: string, fieldType: string): void {
    if (fieldType === 'integer' || fieldType === 'number') {
      this.setPropertyAtPath(data, field, Number.MIN_SAFE_INTEGER);
    }
  }

  private invalidEnumValue(data: Record<string, unknown>, field: string): void {
    this.setPropertyAtPath(data, field, '__INVALID_ENUM_VALUE__');
  }

  private makeGenericInvalid(data: Record<string, unknown>): void {
    data.__INVALID_FIELD__ = Symbol('invalid');
  }
}
