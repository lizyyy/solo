import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  ParsedOpenAPI,
  ParsedPath,
  ParsedParameter,
  ParsedRequestBody,
  ParsedResponse,
  ParsedSchema,
  HttpMethod,
  Anomaly
} from './types';

export class OpenAPIParser {
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  parse(serviceName: string, filePath: string): { parsed: ParsedOpenAPI; anomalies: Anomaly[] } {
    const anomalies: Anomaly[] = [];
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.baseDir, filePath);

    if (!fs.existsSync(fullPath)) {
      anomalies.push({
        type: 'invalid_contract',
        serviceName,
        message: `OpenAPI 文件不存在: ${fullPath}`,
        source: fullPath
      });
      throw new Error(`OpenAPI 文件不存在: ${fullPath}`);
    }

    let rawSpec: any;
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      rawSpec = this.parseFile(content, fullPath);
    } catch (error: any) {
      anomalies.push({
        type: 'invalid_contract',
        serviceName,
        message: `OpenAPI 文件解析失败: ${error.message}`,
        source: fullPath
      });
      throw new Error(`OpenAPI 文件解析失败: ${error.message}`);
    }

    if (!rawSpec || !rawSpec.openapi) {
      anomalies.push({
        type: 'invalid_contract',
        serviceName,
        message: `无效的 OpenAPI 规范，缺少 openapi 字段`,
        source: fullPath
      });
      throw new Error('无效的 OpenAPI 规范');
    }

    const parsed = this.parseOpenAPI(serviceName, rawSpec, fullPath, anomalies);
    return { parsed, anomalies };
  }

  private parseOpenAPI(
    serviceName: string,
    spec: any,
    source: string,
    anomalies: Anomaly[]
  ): ParsedOpenAPI {
    const paths: ParsedPath[] = [];
    const schemas: Record<string, ParsedSchema> = {};

    if (spec.components && spec.components.schemas) {
      for (const [name, schema] of Object.entries(spec.components.schemas)) {
        schemas[name] = this.parseSchema(schema as any);
      }
    }

    if (spec.paths) {
      const httpMethods: HttpMethod[] = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

      for (const [pathName, pathItem] of Object.entries(spec.paths)) {
        if (!pathItem || typeof pathItem !== 'object') continue;

        for (const method of httpMethods) {
          const operation = (pathItem as any)[method];
          if (!operation || typeof operation !== 'object') continue;

          if (!operation.operationId) {
            anomalies.push({
              type: 'missing_operation_id',
              serviceName,
              path: pathName,
              method,
              message: `接口缺少 operationId: ${method.toUpperCase()} ${pathName}`,
              source
            });
          }

          const parameters: ParsedParameter[] = [];

          const globalParams = (pathItem as any).parameters;
          if (Array.isArray(globalParams)) {
            for (const param of globalParams) {
              parameters.push(this.parseParameter(param));
            }
          }

          if (Array.isArray(operation.parameters)) {
            for (const param of operation.parameters) {
              parameters.push(this.parseParameter(param));
            }
          }

          const requestBody = operation.requestBody
            ? this.parseRequestBody(operation.requestBody)
            : undefined;

          const responses: ParsedResponse[] = [];
          if (operation.responses) {
            for (const [statusCode, response] of Object.entries(operation.responses)) {
              responses.push({
                statusCode,
                description: (response as any).description,
                content: this.parseResponseContent((response as any).content)
              });
            }
          }

          paths.push({
            path: pathName,
            method,
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            parameters,
            requestBody,
            responses
          });
        }
      }
    }

    return {
      serviceName,
      version: spec.info?.version || 'unknown',
      paths,
      schemas
    };
  }

  private parseParameter(param: any): ParsedParameter {
    return {
      name: param.name,
      in: param.in,
      required: param.required || false,
      schema: param.schema ? this.parseSchema(param.schema) : undefined,
      description: param.description
    };
  }

  private parseRequestBody(body: any): ParsedRequestBody {
    return {
      required: body.required || false,
      content: this.parseResponseContent(body.content),
      description: body.description
    };
  }

  private parseResponseContent(content: any): Record<string, ParsedSchema> {
    const result: Record<string, ParsedSchema> = {};
    if (!content) return result;

    for (const [mimeType, schemaObj] of Object.entries(content)) {
      const schema = (schemaObj as any).schema;
      if (schema) {
        result[mimeType] = this.parseSchema(schema);
      }
    }
    return result;
  }

  private parseSchema(schema: any): ParsedSchema {
    if (!schema) return {};

    if (schema.$ref) {
      return { $ref: schema.$ref };
    }

    const result: ParsedSchema = {
      type: schema.type,
      nullable: schema.nullable,
      additionalProperties: schema.additionalProperties,
      description: schema.description
    };

    if (schema.properties) {
      result.properties = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        result.properties[key] = this.parseSchema(value);
      }
    }

    if (schema.required) {
      result.required = schema.required;
    }

    if (schema.items) {
      result.items = this.parseSchema(schema.items);
    }

    if (schema.enum) {
      result.enum = schema.enum.map((v: any) => String(v));
    }

    if (schema.allOf) {
      result.allOf = schema.allOf.map((s: any) => this.parseSchema(s));
    }

    if (schema.anyOf) {
      result.anyOf = schema.anyOf.map((s: any) => this.parseSchema(s));
    }

    if (schema.oneOf) {
      result.oneOf = schema.oneOf.map((s: any) => this.parseSchema(s));
    }

    return result;
  }

  private parseFile(content: string, filePath: string): any {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') {
      return JSON.parse(content);
    }
    return yaml.load(content);
  }

  resolveSchemaRef(parsed: ParsedOpenAPI, schema: ParsedSchema): ParsedSchema | null {
    if (!schema.$ref) {
      return schema;
    }

    const parts = schema.$ref.split('/');
    if (parts.length !== 4 || parts[1] !== 'components' || parts[2] !== 'schemas') {
      return null;
    }

    const schemaName = parts[3];
    const refSchema = parsed.schemas[schemaName];
    if (!refSchema) {
      return null;
    }

    if (refSchema.$ref) {
      return this.resolveSchemaRef(parsed, refSchema);
    }

    return refSchema;
  }

  flattenSchema(parsed: ParsedOpenAPI, schema: ParsedSchema): ParsedSchema {
    const resolved = this.resolveSchemaRef(parsed, schema);
    if (!resolved) return schema;

    const result: ParsedSchema = { ...resolved };

    if (resolved.allOf) {
      const combined: ParsedSchema = {};
      const allProperties: Record<string, ParsedSchema> = {};
      const allRequired: string[] = [];

      for (const sub of resolved.allOf) {
        const flattened = this.flattenSchema(parsed, sub);
        if (flattened.properties) {
          Object.assign(allProperties, flattened.properties);
        }
        if (flattened.required) {
          allRequired.push(...flattened.required);
        }
        Object.assign(combined, flattened);
      }

      if (Object.keys(allProperties).length > 0) {
        combined.properties = allProperties;
      }
      if (allRequired.length > 0) {
        combined.required = [...new Set(allRequired)];
      }

      delete combined.allOf;
      return combined;
    }

    if (result.properties) {
      const flattenedProps: Record<string, ParsedSchema> = {};
      for (const [key, prop] of Object.entries(result.properties)) {
        flattenedProps[key] = this.flattenSchema(parsed, prop);
      }
      result.properties = flattenedProps;
    }

    if (result.items) {
      result.items = this.flattenSchema(parsed, result.items);
    }

    return result;
  }

  getSchemaForPath(parsed: ParsedOpenAPI, path: string, method: HttpMethod): ParsedPath | undefined {
    return parsed.paths.find(p => p.path === path && p.method === method);
  }

  getSchemaByOperationId(parsed: ParsedOpenAPI, operationId: string): ParsedPath | undefined {
    return parsed.paths.find(p => p.operationId === operationId);
  }
}
