import fs from 'fs/promises';
import path from 'path';

export class MockParser {
  constructor(inputPath) {
    this.inputPath = inputPath;
    this.mockFiles = [];
  }

  async parse() {
    const stats = await fs.stat(this.inputPath);
    
    if (stats.isDirectory()) {
      await this.parseDirectory(this.inputPath);
    } else {
      await this.parseFile(this.inputPath);
    }

    return this.mockFiles;
  }

  async parseDirectory(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.parseDirectory(fullPath);
      } else if (entry.isFile() && this.isMockFile(entry.name)) {
        await this.parseFile(fullPath);
      }
    }
  }

  isMockFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.json', '.js'].includes(ext);
  }

  async parseFile(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      let data;
      
      if (ext === '.json') {
        const content = await fs.readFile(filePath, 'utf-8');
        data = JSON.parse(content);
      } else if (ext === '.js') {
        data = await this.parseJsFile(filePath);
      }

      const mockData = this.extractMockData(data, filePath);
      
      if (mockData) {
        this.mockFiles.push({
          filePath,
          fileName: path.basename(filePath),
          ...mockData
        });
      }
    } catch (error) {
      this.mockFiles.push({
        filePath,
        fileName: path.basename(filePath),
        error: error.message,
        unparseable: true
      });
    }
  }

  async parseJsFile(filePath) {
    try {
      const module = await import(filePath);
      return module.default || module;
    } catch (error) {
      throw new Error(`Failed to parse JS file: ${error.message}`);
    }
  }

  extractMockData(data, filePath) {
    if (!data || typeof data !== 'object') {
      return null;
    }

    if (this.isEndpointMock(data)) {
      return {
        method: data.method || 'GET',
        path: data.path || this.inferPathFromFilename(filePath),
        statusCode: data.statusCode || data.status || 200,
        response: data.response || data.data || data.body || data,
        metadata: data.metadata || {}
      };
    }

    if (Array.isArray(data)) {
      return {
        method: 'GET',
        path: this.inferPathFromFilename(filePath),
        statusCode: 200,
        response: data,
        metadata: {}
      };
    }

    return {
      method: 'GET',
      path: this.inferPathFromFilename(filePath),
      statusCode: 200,
      response: data,
      metadata: {}
    };
  }

  isEndpointMock(data) {
    return data.method || data.path || data.response || data.data || data.body;
  }

  inferPathFromFilename(filePath) {
    const basename = path.basename(filePath, path.extname(filePath));
    const normalized = basename
      .replace(/\[.*?\]/g, param => `/${param}`)
      .replace(/\./g, '/')
      .replace(/_/g, '-')
      .replace(/mock/gi, '')
      .replace(/response/gi, '')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
    
    return `/${normalized}`.replace(/\/+/g, '/');
  }

  flattenResponse(response, prefix = '') {
    const fields = {};

    if (response === null || response === undefined) {
      return fields;
    }

    if (Array.isArray(response)) {
      if (response.length > 0) {
        const itemFields = this.flattenResponse(response[0], `${prefix}[]`);
        Object.assign(fields, itemFields);
      }
      return fields;
    }

    if (typeof response === 'object') {
      for (const [key, value] of Object.entries(response)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        
        fields[fullPath] = {
          type: this.inferType(value),
          value: value,
          present: true
        };

        if (typeof value === 'object' && value !== null) {
          Object.assign(fields, this.flattenResponse(value, fullPath));
        }
      }
    }

    return fields;
  }

  inferType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'string';
    return typeof value;
  }
}