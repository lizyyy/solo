import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { OpenAPISpec, Schema, ErrorResponseInfo } from './types';

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
    throw new Error(`Unsupported file format: ${ext}`);
  }

  public getSpec(): OpenAPISpec {
    return this.spec;
  }

  private resolveRef(ref: string): Schema {
    if (!ref.startsWith('#/components/schemas/')) {
      throw new Error(`Unsupported ref format: ${ref}`);
    }
    const schemaName = ref.replace('#/components/schemas/', '');
    const schema = this.spec.components?.schemas?.[schemaName];
    if (!schema) {
      throw new Error(`Schema not found: ${schemaName}`);
    }
    return this.resolveSchema(schema);
  }

  private resolveSchema(schema: Schema): Schema {
    if (schema.$ref) {
      return this.resolveRef(schema.$ref);
    }
    if (schema.properties) {
      const resolvedProperties: Record<string, Schema> = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        resolvedProperties[key] = this.resolveSchema(value);
      }
      return { ...schema, properties: resolvedProperties };
    }
    return schema;
  }

  private extractSchemaFields(schema: Schema): string[] {
    const resolved = this.resolveSchema(schema);
    if (resolved.properties) {
      return Object.keys(resolved.properties);
    }
    return [];
  }

  private isErrorStatusCode(statusCode: string): boolean {
    const code = parseInt(statusCode, 10);
    return !isNaN(code) && code >= 400 && code < 600;
  }

  public extractErrorResponses(): ErrorResponseInfo[] {
    const errorResponses: ErrorResponseInfo[] = [];

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation?.responses) continue;

        for (const [statusCode, response] of Object.entries(operation.responses)) {
          if (!this.isErrorStatusCode(statusCode)) continue;
          
          if (!response.content) {
            errorResponses.push({
              path,
              method: method.toUpperCase(),
              statusCode,
              contentType: 'none',
              schemaFields: [],
              rawSchema: {},
              location: {
                path,
                method: method.toUpperCase(),
                statusCode,
              },
            });
            continue;
          }

          for (const [contentType, mediaType] of Object.entries(response.content)) {
            if (mediaType.schema) {
              const fields = this.extractSchemaFields(mediaType.schema);
              errorResponses.push({
                path,
                method: method.toUpperCase(),
                statusCode,
                contentType,
                schemaFields: fields,
                rawSchema: mediaType.schema,
                location: {
                  path,
                  method: method.toUpperCase(),
                  statusCode,
                },
              });
            } else {
              errorResponses.push({
                path,
                method: method.toUpperCase(),
                statusCode,
                contentType,
                schemaFields: [],
                rawSchema: {},
                location: {
                  path,
                  method: method.toUpperCase(),
                  statusCode,
                },
              });
            }
          }
        }
      }
    }

    return errorResponses;
  }

  public getTotalEndpoints(): number {
    let count = 0;
    for (const pathItem of Object.values(this.spec.paths)) {
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;
      for (const method of methods) {
        if (pathItem[method]) count++;
      }
    }
    return count;
  }
}
