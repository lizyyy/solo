import { OpenAPIParser } from './openapi-parser.js';
import { MockParser } from './mock-parser.js';

export class ConsistencyChecker {
  constructor(openapiPath, mockPath, options = {}) {
    this.openapiPath = openapiPath;
    this.mockPath = mockPath;
    this.options = {
      strictType: options.strictType ?? true,
      checkOptional: options.checkOptional ?? false,
      ...options
    };
    
    this.openapiParser = new OpenAPIParser(openapiPath);
    this.mockParser = new MockParser(mockPath);
    
    this.endpoints = [];
    this.mockFiles = [];
    this.results = [];
  }

  async run() {
    await this.openapiParser.parse();
    this.endpoints = this.openapiParser.getEndpoints();
    
    this.mockFiles = await this.mockParser.parse();
    
    for (const mockFile of this.mockFiles) {
      const result = this.checkMockFile(mockFile);
      this.results.push(result);
    }
    
    return this.results;
  }

  checkMockFile(mockFile) {
    if (mockFile.unparseable) {
      return {
        file: mockFile.filePath,
        fileName: mockFile.fileName,
        status: 'error',
        error: mockFile.error,
        issues: []
      };
    }

    const endpoint = this.findMatchingEndpoint(mockFile);
    
    if (!endpoint) {
      return {
        file: mockFile.filePath,
        fileName: mockFile.fileName,
        method: mockFile.method,
        path: mockFile.path,
        status: 'unmatched',
        message: `No matching OpenAPI endpoint found for ${mockFile.method} ${mockFile.path}`,
        issues: []
      };
    }

    const schema = this.openapiParser.getSchemaForEndpoint(
      mockFile.method,
      endpoint.path,
      String(mockFile.statusCode)
    );

    if (!schema) {
      return {
        file: mockFile.filePath,
        fileName: mockFile.fileName,
        method: mockFile.method,
        path: mockFile.path,
        matchedEndpoint: endpoint,
        status: 'no_schema',
        message: `No schema found for status code ${mockFile.statusCode}`,
        issues: []
      };
    }

    const contractFields = this.openapiParser.flattenSchema(schema);
    const mockFields = this.mockParser.flattenResponse(mockFile.response);
    
    const issues = this.compareFields(contractFields, mockFields, mockFile);
    
    const requiredIssues = issues.filter(i => i.severity === 'error');
    const warningIssues = issues.filter(i => i.severity === 'warning');
    
    const status = requiredIssues.length > 0 ? 'fail' : 
                   warningIssues.length > 0 ? 'warn' : 'pass';

    return {
      file: mockFile.filePath,
      fileName: mockFile.fileName,
      method: mockFile.method,
      path: mockFile.path,
      matchedEndpoint: endpoint,
      statusCode: mockFile.statusCode,
      status,
      contractFields: Object.keys(contractFields).length,
      mockFields: Object.keys(mockFields).length,
      issues,
      summary: {
        errors: requiredIssues.length,
        warnings: warningIssues.length,
        passed: Object.keys(contractFields).length - requiredIssues.length - warningIssues.length
      }
    };
  }

  findMatchingEndpoint(mockFile) {
    const mockMethod = mockFile.method.toUpperCase();
    const mockPath = mockFile.path;
    
    for (const endpoint of this.endpoints) {
      if (endpoint.method.toUpperCase() !== mockMethod) {
        continue;
      }
      
      if (this.pathMatches(mockPath, endpoint.path)) {
        return endpoint;
      }
    }
    
    return null;
  }

  pathMatches(mockPath, endpointPath) {
    if (mockPath === endpointPath) {
      return true;
    }
    
    const mockParts = mockPath.split('/').filter(Boolean);
    const endpointParts = endpointPath.split('/').filter(Boolean);
    
    if (mockParts.length !== endpointParts.length) {
      return false;
    }
    
    for (let i = 0; i < mockParts.length; i++) {
      const mockPart = mockParts[i];
      const endpointPart = endpointParts[i];
      
      if (endpointPart.startsWith('{') && endpointPart.endsWith('}')) {
        continue;
      }
      
      if (mockPart !== endpointPart) {
        return false;
      }
    }
    
    return true;
  }

  compareFields(contractFields, mockFields, mockFile) {
    const issues = [];
    
    for (const [path, contractField] of Object.entries(contractFields)) {
      if (path.endsWith('[]') || contractField.isArrayItem) {
        continue;
      }
      
      const mockField = mockFields[path];
      
      if (!mockField) {
        if (contractField.required || this.options.checkOptional) {
          issues.push({
            type: 'missing_field',
            path,
            severity: contractField.required ? 'error' : 'warning',
            message: `Missing ${contractField.required ? 'required' : 'optional'} field`,
            expected: {
              type: contractField.type,
              required: contractField.required,
              description: contractField.description
            }
          });
        }
        continue;
      }
      
      if (this.options.strictType) {
        const typeIssue = this.checkType(path, contractField, mockField);
        if (typeIssue) {
          issues.push(typeIssue);
        }
      }
      
      const valueIssue = this.checkValue(path, contractField, mockField);
      if (valueIssue) {
        issues.push(valueIssue);
      }
    }
    
    for (const [path, mockField] of Object.entries(mockFields)) {
      if (path.endsWith('[]')) {
        continue;
      }
      
      if (!contractFields[path]) {
        issues.push({
          type: 'extra_field',
          path,
          severity: 'warning',
          message: 'Extra field not in contract',
          actual: {
            type: mockField.type,
            value: mockField.value
          }
        });
      }
    }
    
    return issues;
  }

  checkType(path, contractField, mockField) {
    const contractType = contractField.type;
    const mockType = mockField.type;
    
    if (!contractType) {
      return null;
    }
    
    const normalizedContractType = this.normalizeType(contractType);
    const normalizedMockType = this.normalizeType(mockType);
    
    if (normalizedContractType !== normalizedMockType) {
      if (normalizedContractType === 'number' && normalizedMockType === 'integer') {
        return null;
      }
      if (normalizedContractType === 'integer' && normalizedMockType === 'number') {
        return null;
      }
      
      return {
        type: 'type_mismatch',
        path,
        severity: contractField.required ? 'error' : 'warning',
        message: 'Type mismatch',
        expected: contractType,
        actual: mockType,
        sampleValue: mockField.value
      };
    }
    
    return null;
  }

  checkValue(path, contractField, mockField) {
    if (contractField.enum && mockField.value !== undefined) {
      if (!contractField.enum.includes(mockField.value)) {
        return {
          type: 'invalid_enum',
          path,
          severity: 'error',
          message: 'Value not in allowed enum',
          expected: contractField.enum,
          actual: mockField.value
        };
      }
    }
    
    return null;
  }

  normalizeType(type) {
    if (!type) return 'undefined';
    
    const typeMap = {
      'int': 'integer',
      'int32': 'integer',
      'int64': 'integer',
      'float': 'number',
      'double': 'number',
      'bool': 'boolean',
      'datetime': 'string',
      'date-time': 'string',
      'date': 'string',
      'time': 'string',
      'uuid': 'string',
      'uri': 'string',
      'email': 'string',
      'password': 'string',
      'byte': 'string',
      'binary': 'string'
    };
    
    return typeMap[type.toLowerCase()] || type.toLowerCase();
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warned = this.results.filter(r => r.status === 'warn').length;
    const unmatched = this.results.filter(r => r.status === 'unmatched').length;
    const errors = this.results.filter(r => r.status === 'error').length;
    const noSchema = this.results.filter(r => r.status === 'no_schema').length;
    
    const totalIssues = this.results.reduce((sum, r) => sum + (r.issues?.length || 0), 0);
    const totalErrors = this.results.reduce((sum, r) => sum + (r.summary?.errors || 0), 0);
    const totalWarnings = this.results.reduce((sum, r) => sum + (r.summary?.warnings || 0), 0);
    
    return {
      total,
      passed,
      failed,
      warned,
      unmatched,
      errors,
      noSchema,
      totalIssues,
      totalErrors,
      totalWarnings,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(1) : 0
    };
  }
}