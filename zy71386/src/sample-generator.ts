import { FieldSchema, FieldType, EndpointSchema, ApiContract } from './types';

export class SampleGenerator {
  private seed: number = 42;

  setSeed(seed: number): void {
    this.seed = seed;
  }

  private random(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  generateFromSchema(schema: FieldSchema): unknown {
    return this.generateValue(schema);
  }

  generateEndpointExamples(endpoint: EndpointSchema): {
    request?: unknown;
    responses: Record<string, unknown>;
  } {
    const result: { request?: unknown; responses: Record<string, unknown> } = {
      responses: {}
    };

    if (endpoint.requestBody) {
      result.request = this.generateValue(endpoint.requestBody);
    }

    for (const [statusCode, responseSchema] of Object.entries(endpoint.responses)) {
      result.responses[statusCode] = this.generateValue(responseSchema);
    }

    return result;
  }

  generateContractExamples(contract: ApiContract): Array<{
    path: string;
    method: string;
    examples: {
      request?: unknown;
      responses: Record<string, unknown>;
    };
  }> {
    return contract.endpoints.map(endpoint => ({
      path: endpoint.path,
      method: endpoint.method,
      examples: this.generateEndpointExamples(endpoint)
    }));
  }

  generateMockResponse(schema: FieldSchema, options?: {
    statusCode?: number;
    delayMs?: number;
    headers?: Record<string, string>;
  }): {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
    delayMs: number;
  } {
    return {
      statusCode: options?.statusCode || 200,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: this.generateValue(schema),
      delayMs: options?.delayMs || 0
    };
  }

  private generateValue(schema: FieldSchema): unknown {
    if (schema.enum && schema.enum.length > 0) {
      return schema.enum[Math.floor(this.random() * schema.enum.length)];
    }

    switch (schema.type) {
      case 'string':
        return this.generateString(schema);
      case 'number':
        return this.generateNumber(schema, false);
      case 'integer':
        return this.generateNumber(schema, true);
      case 'boolean':
        return this.random() > 0.5;
      case 'null':
        return null;
      case 'array':
        return this.generateArray(schema);
      case 'object':
        return this.generateObject(schema);
      default:
        return null;
    }
  }

  private generateString(schema: FieldSchema): string {
    const name = schema.name.toLowerCase();
    
    if (name.includes('id')) {
      return `id_${Math.floor(this.random() * 10000)}`;
    }
    if (name.includes('name') || name.includes('title')) {
      const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
      return names[Math.floor(this.random() * names.length)];
    }
    if (name.includes('email')) {
      return `user${Math.floor(this.random() * 100)}@example.com`;
    }
    if (name.includes('url') || name.includes('link')) {
      return `https://example.com/resource/${Math.floor(this.random() * 100)}`;
    }
    if (name.includes('date') || name.includes('time')) {
      return new Date(Date.now() - Math.floor(this.random() * 31536000000)).toISOString();
    }
    if (name.includes('status') || name.includes('state')) {
      const statuses = ['active', 'inactive', 'pending', 'completed', 'failed'];
      return statuses[Math.floor(this.random() * statuses.length)];
    }
    
    return `sample_${schema.name}_${Math.floor(this.random() * 100)}`;
  }

  private generateNumber(schema: FieldSchema, isInteger: boolean): number {
    const min = 0;
    const max = 1000;
    const value = min + this.random() * (max - min);
    return isInteger ? Math.floor(value) : Math.round(value * 100) / 100;
  }

  private generateArray(schema: FieldSchema): unknown[] {
    const length = Math.floor(this.random() * 5) + 1;
    const result: unknown[] = [];

    for (let i = 0; i < length; i++) {
      if (schema.items) {
        result.push(this.generateValue(schema.items));
      }
    }

    return result;
  }

  private generateObject(schema: FieldSchema): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (!schema.properties) {
      return result;
    }

    for (const [key, prop] of Object.entries(schema.properties)) {
      if (!prop.required && this.random() > 0.7) {
        continue;
      }
      
      if (prop.nullable && this.random() > 0.9) {
        result[key] = null;
        continue;
      }

      result[key] = this.generateValue(prop);
    }

    return result;
  }

  generateBadDataExamples(schema: FieldSchema): Array<{
    value: unknown;
    reason: string;
    type: 'type_mismatch' | 'missing_required' | 'invalid_enum' | 'null_for_nonnullable';
  }> {
    const examples: Array<{
      value: unknown;
      reason: string;
      type: any;
    }> = [];

    if (schema.type === 'object' && schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (prop.required) {
          const badObj = this.generateObject(schema);
          delete badObj[key];
          examples.push({
            value: badObj,
            reason: `缺少必填字段 '${key}'`,
            type: 'missing_required'
          });
        }

        if (!prop.nullable && prop.type !== 'null') {
          const badObj = this.generateObject(schema);
          badObj[key] = null;
          examples.push({
            value: badObj,
            reason: `字段 '${key}' 不允许为 null`,
            type: 'null_for_nonnullable'
          });
        }
      }
    }

    return examples;
  }
}
