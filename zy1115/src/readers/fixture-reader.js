const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { ValidationError, FileError } = require('../utils/errors');

class FixtureReader {
  constructor() {
    this.supportedExtensions = ['.json', '.js'];
  }

  async read(filePath) {
    try {
      const absolutePath = path.resolve(filePath);
      
      if (!fs.existsSync(absolutePath)) {
        throw new FileError(`Fixture 文件不存在: ${filePath}`, { filePath });
      }

      const fixtureData = this.loadFixtureFile(absolutePath);

      if (!Array.isArray(fixtureData)) {
        throw new ValidationError(`Fixture 文件必须包含一个数组: ${filePath}`, {
          filePath,
          foundType: typeof fixtureData
        });
      }

      const endpoints = this.parseFixtures(fixtureData, absolutePath);

      return {
        type: 'fixture',
        endpoints,
        sourceFile: absolutePath
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof FileError) {
        throw error;
      }
      throw new Error(`读取 Fixture 文件时出错: ${error.message}`);
    }
  }

  loadFixtureFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.js') {
      try {
        delete require.cache[require.resolve(filePath)];
        return require(filePath);
      } catch (error) {
        throw new ValidationError(`无法加载 JS fixture 文件: ${filePath}`, {
          filePath,
          originalError: error.message
        });
      }
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new ValidationError(`Fixture JSON 格式错误: ${filePath}`, {
        filePath,
        originalError: error.message
      });
    }
  }

  parseFixtures(fixtures, filePath) {
    const endpoints = [];

    for (let index = 0; index < fixtures.length; index++) {
      const fixture = fixtures[index];
      
      if (!fixture || typeof fixture !== 'object') {
        console.warn(`警告: Fixture 第 ${index} 项不是对象，已跳过`);
        continue;
      }

      const endpoint = this.parseFixtureItem(fixture, filePath, index);
      if (endpoint) {
        endpoints.push(endpoint);
      }
    }

    return endpoints;
  }

  parseFixtureItem(fixture, filePath, index) {
    const method = this.extractMethod(fixture);
    const path = this.extractPath(fixture);
    
    if (!path) {
      console.warn(`警告: Fixture 第 ${index} 项缺少 path/url/route 字段，已跳过`);
      return null;
    }

    const endpoint = {
      method: method || 'GET',
      path,
      name: fixture.name || fixture.id,
      description: fixture.description,
      requestSchema: this.extractRequestSchema(fixture),
      responseSchemas: this.extractResponseSchemas(fixture),
      parameters: this.extractParameters(fixture),
      source: {
        type: 'fixture',
        filePath,
        index,
        path,
        method: method || 'GET'
      }
    };

    return endpoint;
  }

  extractMethod(fixture) {
    const methodField = fixture.method || fixture.httpMethod || fixture.type;
    if (methodField) {
      const method = String(methodField).toUpperCase();
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
      if (validMethods.includes(method)) {
        return method;
      }
    }
    return null;
  }

  extractPath(fixture) {
    const pathField = fixture.path || fixture.url || fixture.route || fixture.endpoint;
    if (pathField) {
      return pathField;
    }
    return null;
  }

  extractRequestSchema(fixture) {
    const request = fixture.request || fixture.req || fixture.requestBody || fixture.body;
    if (request) {
      return this.inferSchemaFromValue(request);
    }
    return null;
  }

  extractResponseSchemas(fixture) {
    const responses = {};
    
    const response = fixture.response || fixture.res || fixture.data || fixture.result;
    const statusCode = fixture.status || fixture.statusCode || 200;
    
    if (response !== undefined) {
      responses[String(statusCode)] = this.inferSchemaFromValue(response);
    }
    
    if (fixture.responses && typeof fixture.responses === 'object') {
      for (const [code, resp] of Object.entries(fixture.responses)) {
        responses[code] = this.inferSchemaFromValue(resp);
      }
    }

    return responses;
  }

  extractParameters(fixture) {
    const params = [];
    
    if (fixture.params && typeof fixture.params === 'object') {
      for (const [name, value] of Object.entries(fixture.params)) {
        params.push({
          name,
          in: 'query',
          required: false,
          schema: this.inferSchemaFromValue(value)
        });
      }
    }

    if (fixture.query && typeof fixture.query === 'object') {
      for (const [name, value] of Object.entries(fixture.query)) {
        params.push({
          name,
          in: 'query',
          required: false,
          schema: this.inferSchemaFromValue(value)
        });
      }
    }

    if (fixture.headers && typeof fixture.headers === 'object') {
      for (const [name, value] of Object.entries(fixture.headers)) {
        params.push({
          name,
          in: 'header',
          required: false,
          schema: this.inferSchemaFromValue(value)
        });
      }
    }

    return params;
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

module.exports = FixtureReader;
