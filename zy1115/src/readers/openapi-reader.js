const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const _ = require('lodash');
const { ValidationError, FileError } = require('../utils/errors');

class OpenAPIReader {
  constructor() {
    this.supportedVersions = ['3.0', '3.1'];
  }

  async read(filePath) {
    try {
      const absolutePath = path.resolve(filePath);
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      
      let openapiDoc;
      if (absolutePath.endsWith('.yaml') || absolutePath.endsWith('.yml')) {
        openapiDoc = yaml.load(fileContent);
      } else {
        openapiDoc = JSON.parse(fileContent);
      }

      this.validateOpenAPISpec(openapiDoc, absolutePath);

      return this.parseEndpoints(openapiDoc, absolutePath);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ValidationError(`OpenAPI 文件格式错误: ${filePath}`, {
          originalError: error.message,
          filePath
        });
      }
      if (error.code === 'ENOENT') {
        throw new FileError(`OpenAPI 文件不存在: ${filePath}`, { filePath });
      }
      if (error instanceof ValidationError || error instanceof FileError) {
        throw error;
      }
      throw new Error(`读取 OpenAPI 文件时出错: ${error.message}`);
    }
  }

  validateOpenAPISpec(doc, filePath) {
    if (!doc.openapi) {
      throw new ValidationError('不是有效的 OpenAPI 文档，缺少 openapi 版本字段', { filePath });
    }

    const version = doc.openapi;
    const isSupported = this.supportedVersions.some(v => version.startsWith(v));
    if (!isSupported) {
      throw new ValidationError(`不支持的 OpenAPI 版本: ${version}，支持的版本: ${this.supportedVersions.join(', ')}`, {
        filePath,
        version
      });
    }

    if (!doc.paths || typeof doc.paths !== 'object') {
      throw new ValidationError('OpenAPI 文档缺少 paths 字段', { filePath });
    }
  }

  parseEndpoints(openapiDoc, filePath) {
    const endpoints = [];
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

    for (const [path, pathItem] of Object.entries(openapiDoc.paths || {})) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const method of httpMethods) {
        const operation = pathItem[method];
        if (!operation || typeof operation !== 'object') continue;

        const endpoint = {
          method: method.toUpperCase(),
          path,
          operationId: operation.operationId,
          summary: operation.summary,
          description: operation.description,
          requestSchema: this.parseRequestSchema(operation, openapiDoc),
          responseSchemas: this.parseResponseSchemas(operation, openapiDoc),
          parameters: this.parseParameters(operation, openapiDoc),
          source: {
            type: 'openapi',
            filePath,
            path: path,
            method: method.toUpperCase()
          }
        };

        endpoints.push(endpoint);
      }
    }

    return {
      type: 'openapi',
      version: openapiDoc.openapi,
      info: openapiDoc.info,
      endpoints,
      components: openapiDoc.components,
      sourceFile: filePath
    };
  }

  parseRequestSchema(operation, openapiDoc) {
    if (operation.requestBody) {
      const requestBody = operation.requestBody;
      const resolvedBody = this.resolveReference(requestBody, openapiDoc);
      
      if (resolvedBody.content) {
        const jsonContent = resolvedBody.content['application/json'];
        if (jsonContent && jsonContent.schema) {
          return this.normalizeSchema(
            this.resolveReference(jsonContent.schema, openapiDoc),
            openapiDoc
          );
        }
      }
    }
    return null;
  }

  parseResponseSchemas(operation, openapiDoc) {
    const responses = {};
    
    if (!operation.responses) return responses;

    for (const [statusCode, response] of Object.entries(operation.responses)) {
      const resolvedResponse = this.resolveReference(response, openapiDoc);
      
      if (resolvedResponse.content) {
        const jsonContent = resolvedResponse.content['application/json'];
        if (jsonContent && jsonContent.schema) {
          responses[statusCode] = this.normalizeSchema(
            this.resolveReference(jsonContent.schema, openapiDoc),
            openapiDoc
          );
        }
      }
    }

    return responses;
  }

  parseParameters(operation, openapiDoc) {
    const parameters = [];
    
    if (!operation.parameters) return parameters;

    for (const param of operation.parameters) {
      const resolvedParam = this.resolveReference(param, openapiDoc);
      parameters.push({
        name: resolvedParam.name,
        in: resolvedParam.in,
        required: resolvedParam.required || false,
        schema: resolvedParam.schema ? this.normalizeSchema(
          this.resolveReference(resolvedParam.schema, openapiDoc),
          openapiDoc
        ) : null,
        description: resolvedParam.description
      });
    }

    return parameters;
  }

  resolveReference(obj, openapiDoc) {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (obj.$ref) {
      const refPath = obj.$ref;
      if (refPath.startsWith('#/')) {
        const parts = refPath.slice(2).split('/');
        let current = openapiDoc;
        for (const part of parts) {
          const decodedPart = decodeURIComponent(part.replace(/~1/g, '/').replace(/~0/g, '~'));
          current = current?.[decodedPart];
          if (current === undefined) {
            return obj;
          }
        }
        return this.resolveReference(current, openapiDoc);
      }
    }
    return obj;
  }

  normalizeSchema(schema, openapiDoc) {
    if (!schema) return null;
    
    const resolved = this.resolveReference(schema, openapiDoc);
    
    if (resolved.type === 'array' && resolved.items) {
      return {
        type: 'array',
        items: this.normalizeSchema(resolved.items, openapiDoc),
        nullable: resolved.nullable || false
      };
    }

    if (resolved.type === 'object' || resolved.properties) {
      const properties = {};
      const required = new Set(resolved.required || []);

      if (resolved.properties) {
        for (const [propName, propSchema] of Object.entries(resolved.properties)) {
          const normalizedProp = this.normalizeSchema(
            this.resolveReference(propSchema, openapiDoc),
            openapiDoc
          );
          if (normalizedProp) {
            properties[propName] = {
              ...normalizedProp,
              required: required.has(propName),
              nullable: normalizedProp.nullable || resolved.nullable || false
            };
          }
        }
      }

      return {
        type: 'object',
        properties,
        required: Array.from(required),
        nullable: resolved.nullable || false,
        additionalProperties: resolved.additionalProperties
      };
    }

    if (resolved.enum) {
      return {
        type: resolved.type || 'string',
        enum: resolved.enum,
        nullable: resolved.nullable || false
      };
    }

    return {
      type: resolved.type || 'string',
      format: resolved.format,
      nullable: resolved.nullable || false,
      minimum: resolved.minimum,
      maximum: resolved.maximum,
      minLength: resolved.minLength,
      maxLength: resolved.maxLength,
      pattern: resolved.pattern
    };
  }
}

module.exports = OpenAPIReader;
