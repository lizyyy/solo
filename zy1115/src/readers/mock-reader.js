const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { ValidationError, FileError } = require('../utils/errors');

class MockReader {
  constructor() {
    this.supportedExtensions = ['.json', '.js'];
  }

  async read(dirPath) {
    try {
      const absolutePath = path.resolve(dirPath);
      
      if (!fs.existsSync(absolutePath)) {
        throw new FileError(`Mock 目录不存在: ${dirPath}`, { dirPath });
      }

      const stats = fs.statSync(absolutePath);
      if (!stats.isDirectory()) {
        throw new ValidationError(`${dirPath} 不是一个目录`, { dirPath });
      }

      const endpoints = this.scanMockDirectory(absolutePath);

      return {
        type: 'mock',
        endpoints,
        sourceDir: absolutePath
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof FileError) {
        throw error;
      }
      throw new Error(`读取 Mock 目录时出错: ${error.message}`);
    }
  }

  scanMockDirectory(dirPath) {
    const endpoints = [];
    const files = this.getAllFiles(dirPath);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!this.supportedExtensions.includes(ext)) continue;

      try {
        const mockData = this.loadMockFile(file);
        const parsedEndpoints = this.parseMockData(mockData, file, dirPath);
        endpoints.push(...parsedEndpoints);
      } catch (error) {
        console.warn(`警告: 无法读取 mock 文件 ${file}: ${error.message}`);
      }
    }

    return endpoints;
  }

  getAllFiles(dirPath, files = []) {
    const dirFiles = fs.readdirSync(dirPath);
    
    for (const file of dirFiles) {
      const absolutePath = path.join(dirPath, file);
      const stats = fs.statSync(absolutePath);
      
      if (stats.isDirectory()) {
        this.getAllFiles(absolutePath, files);
      } else {
        files.push(absolutePath);
      }
    }
    
    return files;
  }

  loadMockFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.js') {
      try {
        delete require.cache[require.resolve(filePath)];
        return require(filePath);
      } catch (error) {
        throw new ValidationError(`无法加载 JS mock 文件: ${filePath}`, {
          filePath,
          originalError: error.message
        });
      }
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new ValidationError(`Mock JSON 格式错误: ${filePath}`, {
        filePath,
        originalError: error.message
      });
    }
  }

  parseMockData(mockData, filePath, baseDir) {
    const endpoints = [];
    
    if (Array.isArray(mockData)) {
      for (let i = 0; i < mockData.length; i++) {
        const item = mockData[i];
        const endpoint = this.parseMockEndpoint(item, filePath, i);
        if (endpoint) {
          endpoints.push(endpoint);
        }
      }
    } else if (typeof mockData === 'object' && mockData !== null) {
      const endpoint = this.parseMockEndpoint(mockData, filePath);
      if (endpoint) {
        endpoints.push(endpoint);
      }
    }

    if (endpoints.length === 0) {
      const inferredEndpoint = this.inferEndpointFromPath(filePath, baseDir, mockData);
      if (inferredEndpoint) {
        endpoints.push(inferredEndpoint);
      }
    }

    return endpoints;
  }

  parseMockEndpoint(mockItem, filePath, index = null) {
    const method = this.extractMethod(mockItem);
    const path = this.extractPath(mockItem, filePath);
    
    if (!path) return null;

    const endpoint = {
      method: method || 'GET',
      path,
      requestSchema: this.extractRequestSchema(mockItem),
      responseSchemas: this.extractResponseSchemas(mockItem),
      source: {
        type: 'mock',
        filePath,
        index,
        path,
        method: method || 'GET'
      }
    };

    return endpoint;
  }

  extractMethod(mockItem) {
    const methodField = mockItem.method || mockItem.httpMethod || mockItem.type;
    if (methodField) {
      const method = String(methodField).toUpperCase();
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
      if (validMethods.includes(method)) {
        return method;
      }
    }
    return null;
  }

  extractPath(mockItem, filePath) {
    const pathField = mockItem.path || mockItem.url || mockItem.route;
    if (pathField) {
      return pathField;
    }
    return null;
  }

  extractRequestSchema(mockItem) {
    const request = mockItem.request || mockItem.req || mockItem.requestBody;
    if (request) {
      return this.inferSchemaFromValue(request);
    }
    return null;
  }

  extractResponseSchemas(mockItem) {
    const responses = {};
    
    const response = mockItem.response || mockItem.res || mockItem.data || mockItem.body;
    const statusCode = mockItem.status || mockItem.statusCode || 200;
    
    if (response !== undefined) {
      responses[String(statusCode)] = this.inferSchemaFromValue(response);
    }
    
    if (mockItem.responses && typeof mockItem.responses === 'object') {
      for (const [code, resp] of Object.entries(mockItem.responses)) {
        responses[code] = this.inferSchemaFromValue(resp);
      }
    }

    return responses;
  }

  inferEndpointFromPath(filePath, baseDir, mockData) {
    const relativePath = path.relative(baseDir, filePath);
    const dirParts = path.dirname(relativePath).split(path.sep).filter(p => p && p !== '.');
    
    let apiPath = '/' + dirParts.join('/');
    
    const fileName = path.basename(filePath, path.extname(filePath));
    if (fileName !== 'index' && fileName !== 'mock' && dirParts.length > 0) {
      apiPath += '/' + fileName;
    } else if (fileName !== 'index' && fileName !== 'mock') {
      apiPath = '/' + fileName;
    }

    if (apiPath === '/') {
      return null;
    }

    return {
      method: 'GET',
      path: apiPath,
      responseSchemas: {
        '200': this.inferSchemaFromValue(mockData)
      },
      source: {
        type: 'mock',
        filePath,
        inferred: true,
        path: apiPath,
        method: 'GET'
      }
    };
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

module.exports = MockReader;
