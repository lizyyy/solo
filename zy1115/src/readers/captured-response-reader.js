const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ValidationError, FileError } = require('../utils/errors');

class CapturedResponseReader {
  constructor() {
    this.supportedExtensions = ['.jsonl', '.ndjson'];
  }

  async read(filePath) {
    try {
      const absolutePath = path.resolve(filePath);
      
      if (!fs.existsSync(absolutePath)) {
        throw new FileError(`Captured responses 文件不存在: ${filePath}`, { filePath });
      }

      const entries = await this.readJsonlFile(absolutePath);
      const endpoints = this.parseEntries(entries, absolutePath);

      return {
        type: 'captured',
        endpoints,
        entriesCount: entries.length,
        sourceFile: absolutePath
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof FileError) {
        throw error;
      }
      throw new Error(`读取 Captured responses 文件时出错: ${error.message}`);
    }
  }

  async readJsonlFile(filePath) {
    const entries = [];
    const errors = [];
    let lineNumber = 0;

    const fileStream = fs.createReadStream(filePath, 'utf-8');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      lineNumber++;
      const trimmedLine = line.trim();
      
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        continue;
      }

      try {
        const entry = JSON.parse(trimmedLine);
        entries.push({
          data: entry,
          lineNumber,
          rawLine: trimmedLine
        });
      } catch (error) {
        errors.push({
          lineNumber,
          error: error.message,
          line: trimmedLine.substring(0, 100)
        });
      }
    }

    if (errors.length > 0) {
      console.warn(`\n警告: Captured responses 文件中有 ${errors.length} 行解析失败:`);
      for (const err of errors.slice(0, 5)) {
        console.warn(`  行 ${err.lineNumber}: ${err.error}`);
        console.warn(`    内容: ${err.line}...`);
      }
      if (errors.length > 5) {
        console.warn(`  ...还有 ${errors.length - 5} 行`);
      }
      console.warn('');
    }

    if (entries.length === 0) {
      throw new ValidationError(`Captured responses 文件中没有有效的条目: ${filePath}`, {
        filePath,
        errors
      });
    }

    return entries;
  }

  parseEntries(entries, filePath) {
    const endpointMap = new Map();

    for (const entry of entries) {
      const endpoint = this.parseEntry(entry, filePath);
      if (!endpoint) continue;

      const key = `${endpoint.method}:${endpoint.path}`;
      
      if (!endpointMap.has(key)) {
        endpointMap.set(key, {
          method: endpoint.method,
          path: endpoint.path,
          requestSchemas: [],
          responseSchemas: [],
          sources: []
        });
      }

      const existing = endpointMap.get(key);
      
      if (endpoint.requestSchema) {
        existing.requestSchemas.push(endpoint.requestSchema);
      }
      if (endpoint.responseSchema) {
        existing.responseSchemas.push(endpoint.responseSchema);
      }
      existing.sources.push(endpoint.source);
    }

    const endpoints = [];
    for (const [key, endpointData] of endpointMap) {
      const endpoint = {
        method: endpointData.method,
        path: endpointData.path,
        requestSchema: this.unifySchemas(endpointData.requestSchemas),
        responseSchemas: {
          '200': this.unifySchemas(endpointData.responseSchemas)
        },
        samples: endpointData.sources.length,
        source: {
          type: 'captured',
          filePath,
          lines: endpointData.sources.map(s => s.lineNumber)
        }
      };
      endpoints.push(endpoint);
    }

    return endpoints;
  }

  parseEntry(entry, filePath) {
    const { data, lineNumber, rawLine } = entry;
    
    if (!data || typeof data !== 'object') {
      return null;
    }

    const method = this.extractMethod(data);
    const path = this.extractPath(data);

    if (!path) {
      return null;
    }

    return {
      method: method || 'GET',
      path,
      requestSchema: this.extractRequestSchema(data),
      responseSchema: this.extractResponseSchema(data),
      source: {
        type: 'captured',
        filePath,
        lineNumber,
        path,
        method: method || 'GET'
      }
    };
  }

  extractMethod(data) {
    const methodField = data.method || data.httpMethod || data.requestMethod || data.type;
    if (methodField) {
      const method = String(methodField).toUpperCase();
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
      if (validMethods.includes(method)) {
        return method;
      }
    }
    return null;
  }

  extractPath(data) {
    const pathField = data.path || data.url || data.route || data.endpoint || data.uri;
    if (pathField) {
      try {
        const url = new URL(pathField, 'http://localhost');
        return url.pathname;
      } catch {
        return pathField.split('?')[0];
      }
    }
    
    if (data.request && data.request.url) {
      try {
        const url = new URL(data.request.url, 'http://localhost');
        return url.pathname;
      } catch {
        return data.request.url.split('?')[0];
      }
    }

    return null;
  }

  extractRequestSchema(data) {
    let request = null;
    
    if (data.request && typeof data.request === 'object') {
      request = data.request.body || data.request.data || data.request.json;
    }
    
    if (!request) {
      request = data.requestBody || data.body || data.data;
    }

    if (request !== undefined) {
      return this.inferSchemaFromValue(request);
    }

    return null;
  }

  extractResponseSchema(data) {
    let response = null;
    
    if (data.response !== undefined && data.response !== null) {
      if (typeof data.response === 'object') {
        const hasBodyField = data.response.body !== undefined;
        const hasDataField = data.response.data !== undefined;
        const hasJsonField = data.response.json !== undefined;
        const hasStatusField = data.response.status !== undefined || data.response.statusCode !== undefined;
        const hasHeadersField = data.response.headers !== undefined;
        
        if ((hasStatusField || hasHeadersField) && (hasBodyField || hasDataField || hasJsonField)) {
          response = data.response.body || data.response.data || data.response.json;
        } else {
          response = data.response;
        }
      } else {
        response = data.response;
      }
    }
    
    if (response === null || response === undefined) {
      response = data.responseBody || data.body || data.data || data.result;
    }

    if (response !== undefined) {
      return this.inferSchemaFromValue(response);
    }

    return null;
  }

  inferSchemaFromValue(value) {
    if (value === null) {
      return { type: 'null', nullable: true };
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { type: 'array', items: null, nullable: false };
      }
      const itemSchemas = value.map(v => this.inferSchemaFromValue(v));
      const unifiedSchema = this.unifySchemas(itemSchemas);
      return { type: 'array', items: unifiedSchema, nullable: false };
    }

    if (typeof value === 'object') {
      const properties = {};
      for (const [key, val] of Object.entries(value)) {
        properties[key] = this.inferSchemaFromValue(val);
      }
      return {
        type: 'object',
        properties,
        required: Object.keys(value),
        nullable: false
      };
    }

    const type = typeof value;
    if (type === 'number') {
      return {
        type: Number.isInteger(value) ? 'integer' : 'number',
        nullable: false
      };
    }

    if (type === 'string') {
      const format = this.inferStringFormat(value);
      return {
        type: 'string',
        format,
        nullable: false
      };
    }

    return { type, nullable: false };
  }

  inferStringFormat(value) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return 'date-time';
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return 'date';
    }
    if (/^[+-]?\d+(\.\d+)?$/.test(value)) {
      return null;
    }
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) {
      return 'uuid';
    }
    return null;
  }

  unifySchemas(schemas) {
    if (schemas.length === 0) return null;
    if (schemas.length === 1) return schemas[0];

    const types = new Set(schemas.map(s => s.type));
    
    if (types.size === 1) {
      const type = types.values().next().value;
      
      if (type === 'object') {
        const allKeys = new Set();
        schemas.forEach(s => {
          if (s.properties) {
            Object.keys(s.properties).forEach(k => allKeys.add(k));
          }
        });
        
        const properties = {};
        for (const key of allKeys) {
          const propSchemas = schemas
            .filter(s => s.properties && s.properties[key])
            .map(s => s.properties[key]);
          
          properties[key] = this.unifySchemas(propSchemas);
          properties[key].required = schemas.every(s => s.required?.includes(key));
        }

        return {
          type: 'object',
          properties,
          required: []
        };
      }

      if (type === 'array') {
        const itemSchemas = schemas.filter(s => s.items).map(s => s.items);
        return {
          type: 'array',
          items: this.unifySchemas(itemSchemas)
        };
      }

      return { type, nullable: schemas.some(s => s.nullable) };
    }

    return { type: 'mixed', nullable: schemas.some(s => s.nullable || s.type === 'null') };
  }
}

module.exports = CapturedResponseReader;
