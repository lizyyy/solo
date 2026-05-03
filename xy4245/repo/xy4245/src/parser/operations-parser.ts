import { CriticalOperation } from '../types';

export class OperationsParser {
  parse(jsonString: string): CriticalOperation[] {
    let data: unknown;
    try {
      data = JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`无法解析操作清单 JSON: ${(error as Error).message}`);
    }

    return this.validateAndTransform(data);
  }

  private validateAndTransform(data: unknown): CriticalOperation[] {
    if (!Array.isArray(data)) {
      if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj.operations)) {
          return obj.operations.map((op, i) => this.parseOperation(op, i));
        }
        if ('id' in obj || 'description' in obj) {
          return [this.parseOperation(data, 0)];
        }
      }
      throw new Error('操作清单必须是数组或包含 operations 数组的对象');
    }

    return data.map((operation, index) => this.parseOperation(operation, index));
  }

  private parseOperation(data: unknown, index: number): CriticalOperation {
    if (typeof data !== 'object' || data === null) {
      throw new Error(`操作项 ${index} 必须是对象`);
    }

    const obj = data as Record<string, unknown>;

    const id = this.ensureString(
      obj.id, 
      `operations[${index}].id`, 
      `op-${String(index + 1).padStart(3, '0')}`
    );

    const description = this.ensureString(
      obj.description, 
      `operations[${index}].description`,
      `操作 ${index + 1}`
    );

    const selector = this.ensureString(
      obj.selector,
      `operations[${index}].selector`,
      ''
    );

    const operationType = this.parseOperationType(obj.operationType, index);
    const expectedFlow = this.parseExpectedFlow(obj.expectedFlow, index);
    const required = this.ensureBoolean(obj.required, `operations[${index}].required`, true);

    return {
      id,
      description,
      selector,
      operationType,
      expectedFlow,
      required
    };
  }

  private parseOperationType(type: unknown, index: number): CriticalOperation['operationType'] {
    if (type === undefined || type === null) {
      return 'click';
    }

    const typeString = String(type).toLowerCase();
    
    const validTypes: CriticalOperation['operationType'][] = [
      'click', 'input', 'select', 'modal', 'navigation'
    ];

    if (validTypes.includes(typeString as CriticalOperation['operationType'])) {
      return typeString as CriticalOperation['operationType'];
    }

    console.warn(`警告: operations[${index}].operationType "${typeString}" 不是有效值，使用默认值 "click"`);
    return 'click';
  }

  private parseExpectedFlow(flow: unknown, index: number): string[] {
    if (flow === undefined || flow === null) {
      return [];
    }

    if (Array.isArray(flow)) {
      return flow.map((item, i) => {
        if (typeof item === 'string') {
          return item;
        }
        console.warn(`警告: operations[${index}].expectedFlow[${i}] 不是字符串`);
        return String(item);
      });
    }

    if (typeof flow === 'string') {
      return [flow];
    }

    console.warn(`警告: operations[${index}].expectedFlow 格式不正确，应为字符串数组`);
    return [];
  }

  private ensureString(value: unknown, path: string, defaultValue: string): string {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    console.warn(`警告: ${path} 应为字符串，实际为 ${typeof value}，使用默认值`);
    return defaultValue;
  }

  private ensureBoolean(value: unknown, path: string, defaultValue: boolean): boolean {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') {
        return true;
      }
      if (lower === 'false' || lower === '0' || lower === 'no') {
        return false;
      }
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    console.warn(`警告: ${path} 应为布尔值，实际为 ${typeof value}，使用默认值`);
    return defaultValue;
  }

  validateOperations(operations: CriticalOperation[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const idMap = new Map<string, number>();

    operations.forEach((op, index) => {
      if (idMap.has(op.id)) {
        errors.push(`操作项 ${index} 和 ${idMap.get(op.id)} 具有相同的 ID: ${op.id}`);
      } else {
        idMap.set(op.id, index);
      }

      if (!op.selector && op.operationType !== 'navigation') {
        warnings.push(`操作项 "${op.description}" (${op.id}) 没有指定 selector`);
      }

      if (op.operationType === 'modal' && op.expectedFlow.length === 0) {
        warnings.push(`模态操作 "${op.description}" (${op.id}) 没有指定 expectedFlow，无法验证焦点陷阱`);
      }
    });

    const requiredCount = operations.filter(o => o.required).length;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: {
        total: operations.length,
        required: requiredCount,
        optional: operations.length - requiredCount,
        byType: this.countByType(operations)
      }
    };
  }

  private countByType(operations: CriticalOperation[]): Record<CriticalOperation['operationType'], number> {
    const counts: Record<CriticalOperation['operationType'], number> = {
      click: 0,
      input: 0,
      select: 0,
      modal: 0,
      navigation: 0
    };

    operations.forEach(op => {
      counts[op.operationType]++;
    });

    return counts;
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    total: number;
    required: number;
    optional: number;
    byType: Record<CriticalOperation['operationType'], number>;
  };
}
