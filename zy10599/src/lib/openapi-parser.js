import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { get, has } from 'lodash-es';

export class OpenAPIParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.spec = null;
  }

  async parse() {
    const content = await fs.readFile(this.filePath, 'utf-8');
    const ext = path.extname(this.filePath).toLowerCase();
    
    if (ext === '.yaml' || ext === '.yml') {
      this.spec = yaml.load(content);
    } else if (ext === '.json') {
      this.spec = JSON.parse(content);
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    return this.spec;
  }

  getEndpoints() {
    if (!this.spec) {
      throw new Error('Spec not parsed. Call parse() first.');
    }

    const endpoints = [];
    
    for (const [path, methods] of Object.entries(this.spec.paths || {})) {
      for (const [method, operation] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            responses: this.extractResponses(operation),
            requestBody: this.extractRequestBody(operation)
          });
        }
      }
    }

    return endpoints;
  }

  extractResponses(operation) {
    const responses = {};
    
    for (const [statusCode, response] of Object.entries(operation.responses || {})) {
      const content = response.content?.['application/json']?.schema;
      if (content) {
        responses[statusCode] = {
          description: response.description,
          schema: this.resolveSchema(content)
        };
      }
    }

    return responses;
  }

  extractRequestBody(operation) {
    const content = operation.requestBody?.content?.['application/json']?.schema;
    if (content) {
      return {
        description: operation.requestBody.description,
        schema: this.resolveSchema(content),
        required: operation.requestBody.required || false
      };
    }
    return null;
  }

  resolveSchema(schema) {
    if (!schema) return null;

    if (schema.$ref) {
      return this.resolveRef(schema.$ref);
    }

    const resolved = { ...schema };

    if (schema.type === 'object' && schema.properties) {
      resolved.properties = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        resolved.properties[key] = this.resolveSchema(prop);
      }
    }

    if (schema.type === 'array' && schema.items) {
      resolved.items = this.resolveSchema(schema.items);
    }

    if (schema.allOf) {
      const allOfSchemas = schema.allOf.map(s => this.resolveSchema(s));
      resolved.properties = Object.assign({}, ...allOfSchemas.map(s => s.properties || {}));
      resolved.required = [
        ...new Set(allOfSchemas.flatMap(s => s.required || []))
      ];
    }

    return resolved;
  }

  resolveRef(ref) {
    if (!ref.startsWith('#/')) {
      return { $ref: ref, unresolved: true };
    }

    const parts = ref.replace('#/', '').split('/');
    let current = this.spec;

    for (const part of parts) {
      const decodedPart = decodeURIComponent(part);
      if (current && typeof current === 'object' && decodedPart in current) {
        current = current[decodedPart];
      } else {
        return { $ref: ref, unresolved: true };
      }
    }

    return this.resolveSchema(current);
  }

  getSchemaForEndpoint(method, path, statusCode = '200') {
    const endpoints = this.getEndpoints();
    const endpoint = endpoints.find(
      e => e.method === method.toUpperCase() && e.path === path
    );

    if (!endpoint) {
      return null;
    }

    return endpoint.responses[statusCode]?.schema || null;
  }

  flattenSchema(schema, prefix = '') {
    const fields = {};

    if (!schema) return fields;

    if (schema.type === 'array' && schema.items) {
      fields[`${prefix}[]`] = {
        type: schema.items.type,
        required: false,
        description: 'Array item type',
        isArrayItem: true
      };
      if (schema.items.type === 'object' && schema.items.properties) {
        Object.assign(fields, this.flattenSchema(schema.items, `${prefix}[]`));
      }
      return fields;
    }

    if (schema.type === 'object' && schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        const isRequired = (schema.required || []).includes(key);
        
        fields[fullPath] = {
          type: prop.type,
          required: isRequired,
          description: prop.description,
          format: prop.format,
          enum: prop.enum
        };

        if (prop.type === 'object' && prop.properties) {
          Object.assign(fields, this.flattenSchema(prop, fullPath));
        }

        if (prop.type === 'array' && prop.items) {
          fields[`${fullPath}[]`] = {
            type: prop.items.type,
            required: false,
            description: `Array item type for ${fullPath}`,
            isArrayItem: true
          };
          if (prop.items.type === 'object' && prop.items.properties) {
            Object.assign(fields, this.flattenSchema(prop.items, `${fullPath}[]`));
          }
        }
      }
    }

    return fields;
  }
}