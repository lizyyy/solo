import { BaseGenerator } from './base';
import { listAllFields } from '../utils/helpers';

export class BoundaryGenerator extends BaseGenerator {
  private boundaries: Array<{ name: string; fn: (data: Record<string, unknown>, field: string, schema: Record<string, unknown>) => void }>;

  constructor(schema: Record<string, unknown>, seed: number) {
    super(schema, seed);
    this.boundaries = [
      { name: '空字符串', fn: this.setStringBoundary },
      { name: '最小数值', fn: this.setMinNumberBoundary },
      { name: '最大数值', fn: this.setMaxNumberBoundary },
      { name: '最小长度数组', fn: this.setMinArrayBoundary },
      { name: '最大长度数组', fn: this.setMaxArrayBoundary },
      { name: '最小长度字符串', fn: this.setMinStringBoundary },
      { name: '最大长度字符串', fn: this.setMaxStringBoundary }
    ];
  }

  generate(index: number, fieldPath?: string): { data: unknown; reason: string } {
    const data = this.generateValid() as Record<string, unknown>;
    const allFields = listAllFields(this.schema);
    
    if (allFields.length === 0) {
      return { data, reason: '无可用字段进行边界测试' };
    }

    const targetField = fieldPath || allFields[index % allFields.length];
    const boundaryIndex = Math.floor(index / allFields.length) % this.boundaries.length;
    const boundary = this.boundaries[boundaryIndex];

    try {
      boundary.fn.call(this, data, targetField, this.schema);
      return {
        data,
        reason: `${boundary.name} - 字段: ${targetField}`
      };
    } catch {
      return {
        data,
        reason: `边界应用失败，使用默认有效数据`
      };
    }
  }

  private setStringBoundary(data: Record<string, unknown>, field: string): void {
    this.setPropertyAtPath(data, field, '');
  }

  private setMinNumberBoundary(data: Record<string, unknown>, field: string, schema: Record<string, unknown>): void {
    const fieldSchema = this.getFieldSchema(schema, field);
    const min = fieldSchema?.minimum as number;
    if (typeof min === 'number') {
      this.setPropertyAtPath(data, field, min);
    } else {
      this.setPropertyAtPath(data, field, Number.MIN_SAFE_INTEGER);
    }
  }

  private setMaxNumberBoundary(data: Record<string, unknown>, field: string, schema: Record<string, unknown>): void {
    const fieldSchema = this.getFieldSchema(schema, field);
    const max = fieldSchema?.maximum as number;
    if (typeof max === 'number') {
      this.setPropertyAtPath(data, field, max);
    } else {
      this.setPropertyAtPath(data, field, Number.MAX_SAFE_INTEGER);
    }
  }

  private setMinArrayBoundary(data: Record<string, unknown>, field: string, schema: Record<string, unknown>): void {
    const fieldSchema = this.getFieldSchema(schema, field);
    const minItems = fieldSchema?.minItems as number;
    const currentValue = this.getPropertyAtPath(data, field);
    
    if (Array.isArray(currentValue?.value)) {
      const targetLength = typeof minItems === 'number' ? minItems : 0;
      const arr = currentValue.value as unknown[];
      while (arr.length > targetLength) {
        arr.pop();
      }
    }
  }

  private setMaxArrayBoundary(data: Record<string, unknown>, field: string, schema: Record<string, unknown>): void {
    const fieldSchema = this.getFieldSchema(schema, field);
    const maxItems = fieldSchema?.maxItems as number;
    const currentValue = this.getPropertyAtPath(data, field);
    
    if (Array.isArray(currentValue?.value) && typeof maxItems === 'number') {
      const arr = currentValue.value as unknown[];
      while (arr.length < maxItems) {
        arr.push(arr[0] ?? null);
      }
    }
  }

  private setMinStringBoundary(data: Record<string, unknown>, field: string, schema: Record<string, unknown>): void {
    const fieldSchema = this.getFieldSchema(schema, field);
    const minLength = fieldSchema?.minLength as number;
    const targetLength = typeof minLength === 'number' ? minLength : 0;
    this.setPropertyAtPath(data, field, 'a'.repeat(targetLength));
  }

  private setMaxStringBoundary(data: Record<string, unknown>, field: string, schema: Record<string, unknown>): void {
    const fieldSchema = this.getFieldSchema(schema, field);
    const maxLength = fieldSchema?.maxLength as number;
    const targetLength = typeof maxLength === 'number' ? maxLength : 100;
    this.setPropertyAtPath(data, field, 'a'.repeat(targetLength));
  }

  private getFieldSchema(schema: Record<string, unknown>, fieldPath: string): Record<string, unknown> | null {
    const parts = fieldPath.split('.').filter(Boolean);
    let current: Record<string, unknown> = schema;

    for (const part of parts) {
      if (current.properties && typeof current.properties === 'object') {
        const props = current.properties as Record<string, Record<string, unknown>>;
        if (props[part]) {
          current = props[part];
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    return current;
  }
}
