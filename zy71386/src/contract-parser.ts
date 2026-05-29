import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ApiContract, EndpointSchema, FieldSchema, FieldType } from './types';

export class ContractParser {
  private sourceName: string;
  private lineNumbers: Map<string, number> = new Map();

  constructor(sourceName: string) {
    this.sourceName = sourceName;
  }

  parseOpenAPI(filePath: string): ApiContract {
    const content = fs.readFileSync(filePath, 'utf-8');
    this.preprocessLineNumbers(content);
    
    let spec: any;
    try {
      spec = yaml.load(content);
    } catch {
      spec = JSON.parse(content);
    }

    const version = spec.info?.version || 'unknown';
    const endpoints: EndpointSchema[] = [];

    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) {
          endpoints.push(this.parseEndpoint(path, method.toUpperCase(), operation as any, spec));
        }
      }
    }

    return {
      version,
      source: 'openapi',
      sourceName: this.sourceName,
      endpoints,
      generatedAt: new Date().toISOString()
    };
  }

  parseFromMockResponse(responses: Array<{
    path: string;
    method: string;
    statusCode: number;
    body: unknown;
  }>, version: string = 'mock-1.0'): ApiContract {
    const endpointMap = new Map<string, EndpointSchema>();

    for (const resp of responses) {
      const key = `${resp.method}:${resp.path}`;
      let endpoint = endpointMap.get(key);
      
      if (!endpoint) {
        endpoint = {
          path: resp.path,
          method: resp.method.toUpperCase(),
          responses: {}
        };
        endpointMap.set(key, endpoint);
      }

      const schema = this.inferSchemaFromValue(resp.body);
      endpoint.responses[resp.statusCode.toString()] = schema;
    }

    return {
      version,
      source: 'mock',
      sourceName: this.sourceName,
      endpoints: Array.from(endpointMap.values()),
      generatedAt: new Date().toISOString()
    };
  }

  parseFromRealResponse(responses: Array<{
    path: string;
    method: string;
    statusCode: number;
    body: unknown;
  }>, version: string = 'real-1.0'): ApiContract {
    const contract = this.parseFromMockResponse(responses, version);
    contract.source = 'real';
    return contract;
  }

  private parseEndpoint(path: string, method: string, operation: any, spec: any): EndpointSchema {
    const endpoint: EndpointSchema = {
      path,
      method,
      summary: operation.summary,
      tags: operation.tags,
      responses: {},
      parameters: []
    };

    for (const param of operation.parameters || []) {
      endpoint.parameters?.push({
        name: param.name,
        in: param.in,
        type: this.mapOpenAPIType(param.schema?.type || param.type),
        required: param.required || false,
        enum: param.schema?.enum
      });
    }

    if (operation.requestBody) {
      const content = operation.requestBody.content?.['application/json'];
      if (content?.schema) {
        endpoint.requestBody = this.parseSchema(content.schema, spec);
      }
    }

    for (const [statusCode, response] of Object.entries(operation.responses || {})) {
      const content = (response as any).content?.['application/json'];
      if (content?.schema) {
        endpoint.responses[statusCode] = this.parseSchema(content.schema, spec);
      } else {
        endpoint.responses[statusCode] = {
          name: 'response',
          type: 'object',
          nullable: false,
          required: false
        };
      }
    }

    return endpoint;
  }

  private parseSchema(schema: any, spec: any, path: string = ''): FieldSchema {
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/', '').split('/');
      let resolved = spec;
      for (const part of refPath) {
        resolved = resolved?.[part];
      }
      if (resolved) {
        return this.parseSchema(resolved, spec, path);
      }
    }

    const fieldSchema: FieldSchema = {
      name: path.split('.').pop() || 'root',
      type: this.mapOpenAPIType(schema.type),
      nullable: schema.nullable || false,
      required: false,
      enum: schema.enum,
      description: schema.description
    };

    if (schema.type === 'array' && schema.items) {
      fieldSchema.items = this.parseSchema(schema.items, spec, `${path}[]`);
    }

    if (schema.type === 'object' && schema.properties) {
      fieldSchema.properties = {};
      const required = new Set(schema.required || []);
      
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const propPath = path ? `${path}.${propName}` : propName;
        const parsed = this.parseSchema(propSchema, spec, propPath);
        parsed.required = required.has(propName);
        fieldSchema.properties[propName] = parsed;
      }
    }

    return fieldSchema;
  }

  private inferSchemaFromValue(value: unknown, path: string = ''): FieldSchema {
    const name = path.split('.').pop() || 'root';
    
    if (value === null || value === undefined) {
      return {
        name,
        type: 'null',
        nullable: true,
        required: false
      };
    }

    if (Array.isArray(value)) {
      const items = value.length > 0 
        ? this.inferSchemaFromValue(value[0], `${path}[]`)
        : { name: 'item', type: 'null' as FieldType, nullable: true, required: false };
      
      return {
        name,
        type: 'array',
        nullable: false,
        required: true,
        items
      };
    }

    if (typeof value === 'object') {
      const properties: Record<string, FieldSchema> = {};
      
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        const propPath = path ? `${path}.${key}` : key;
        properties[key] = this.inferSchemaFromValue(val, propPath);
      }

      return {
        name,
        type: 'object',
        nullable: false,
        required: true,
        properties
      };
    }

    const type = typeof value as FieldType;
    return {
      name,
      type: type === 'number' ? (Number.isInteger(value) ? 'integer' : 'number') : type,
      nullable: false,
      required: true
    };
  }

  private mapOpenAPIType(openapiType: string): FieldType {
    const typeMap: Record<string, FieldType> = {
      'string': 'string',
      'number': 'number',
      'integer': 'integer',
      'boolean': 'boolean',
      'object': 'object',
      'array': 'array',
      'null': 'null'
    };
    return typeMap[openapiType] || 'string';
  }

  private preprocessLineNumbers(content: string): void {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^\s*["']?(\w+)["']?\s*:/);
      if (match) {
        this.lineNumbers.set(match[1], i + 1);
      }
    }
  }

  getLineNumber(key: string): number | undefined {
    return this.lineNumbers.get(key);
  }
}
