import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { OpenAPISpec, Schema, PaginationConfig } from './types';

export class OpenAPIParser {
  private spec: OpenAPISpec;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.spec = this.loadSpec();
  }

  private loadSpec(): OpenAPISpec {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    const ext = path.extname(this.filePath).toLowerCase();
    
    if (ext === '.yaml' || ext === '.yml') {
      return yaml.load(content) as OpenAPISpec;
    } else if (ext === '.json') {
      return JSON.parse(content);
    }
    throw new Error(`Unsupported file format: ${ext}. Use .yaml, .yml, or .json`);
  }

  getSpec(): OpenAPISpec {
    return this.spec;
  }

  getFilePath(): string {
    return this.filePath;
  }

  resolveRef(ref: string): Schema | null {
    if (!ref.startsWith('#/')) {
      return null;
    }
    
    const parts = ref.replace('#/', '').split('/');
    let current: any = this.spec;
    
    for (const part of parts) {
      const decodedPart = decodeURIComponent(part);
      if (current && typeof current === 'object' && decodedPart in current) {
        current = current[decodedPart];
      } else {
        return null;
      }
    }
    
    return current as Schema;
  }

  resolveSchema(schema: Schema | undefined): Schema | null {
    if (!schema) return null;
    
    if (schema.$ref) {
      const resolved = this.resolveRef(schema.$ref);
      return resolved ? this.resolveSchema(resolved) : null;
    }
    
    return schema;
  }

  getResponseSchema(response: any): Schema | null {
    if (!response?.content) return null;
    
    const contentTypes = Object.keys(response.content);
    for (const contentType of contentTypes) {
      if (response.content[contentType]?.schema) {
        return this.resolveSchema(response.content[contentType].schema);
      }
    }
    
    return null;
  }

  extractResponseFields(schema: Schema | null): string[] {
    if (!schema?.properties) return [];
    return Object.keys(schema.properties);
  }

  extractNestedField(schema: Schema | null, fieldPath: string): string | null {
    if (!schema) return null;
    
    const parts = fieldPath.split('.');
    let current: Schema | null = schema;
    
    for (const part of parts) {
      if (!current?.properties || !current.properties[part]) {
        return null;
      }
      current = this.resolveSchema(current.properties[part]);
    }
    
    return fieldPath;
  }

  static getDefaultConfig(): PaginationConfig {
    return {
      expectedParams: {
        page: ['page', 'pageNum', 'page_number', 'current'],
        pageSize: ['pageSize', 'size', 'per_page', 'limit', 'count']
      },
      expectedResponseFields: {
        data: ['data', 'items', 'list', 'records', 'rows'],
        total: ['total', 'totalCount', 'total_count', 'totalElements'],
        page: ['page', 'pageNum', 'current', 'page_number'],
        pageSize: ['pageSize', 'size', 'per_page', 'limit'],
        totalPages: ['totalPages', 'pages', 'page_count', 'total_pages']
      },
      httpMethods: ['get']
    };
  }
}
