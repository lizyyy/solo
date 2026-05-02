export class DiffRuleEngine {
  constructor(contractIndex) {
    this.contractIndex = contractIndex;
    this.rules = this.initRules();
  }

  initRules() {
    return [
      {
        id: 'field_missing_in_response',
        name: '响应字段缺失',
        severity: 'error',
        check: this.checkMissingFields.bind(this)
      },
      {
        id: 'field_added_in_response',
        name: '响应新增字段',
        severity: 'warning',
        check: this.checkAddedFields.bind(this)
      },
      {
        id: 'type_mismatch',
        name: '类型不匹配',
        severity: 'error',
        check: this.checkTypeMismatch.bind(this)
      },
      {
        id: 'enum_violation',
        name: '枚举违规',
        severity: 'error',
        check: this.checkEnumViolation.bind(this)
      },
      {
        id: 'enum_added',
        name: '枚举新增值',
        severity: 'info',
        check: this.checkEnumAdded.bind(this)
      },
      {
        id: 'enum_removed',
        name: '枚举移除值',
        severity: 'warning',
        check: this.checkEnumRemoved.bind(this)
      },
      {
        id: 'nullable_misuse',
        name: 'Nullable 误用',
        severity: 'error',
        check: this.checkNullableMisuse.bind(this)
      },
      {
        id: 'null_in_non_nullable',
        name: '非 nullable 字段返回 null',
        severity: 'error',
        check: this.checkNullInNonNullable.bind(this)
      },
      {
        id: 'mock_coverage_missing_field',
        name: 'Mock 覆盖但真实响应缺字段',
        severity: 'warning',
        check: this.checkMockCoverageMissingField.bind(this)
      },
      {
        id: 'required_field_missing',
        name: '必填字段缺失',
        severity: 'error',
        check: this.checkRequiredFieldMissing.bind(this)
      }
    ];
  }

  analyze(requestResponsePair, operation) {
    const issues = [];
    const context = {
      request: requestResponsePair.request,
      response: requestResponsePair.response,
      mockResponse: requestResponsePair.mockResponse,
      operation,
      pairId: requestResponsePair.id
    };

    this.rules.forEach((rule) => {
      const ruleIssues = rule.check(context);
      if (ruleIssues && ruleIssues.length > 0) {
        ruleIssues.forEach((issue) => {
          issues.push({
            ...issue,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity
          });
        });
      }
    });

    return issues;
  }

  checkMissingFields(context) {
    const issues = [];
    const { response, operation } = context;
    
    if (!response || !response.body) return issues;

    const responseSchema = this.getResponseSchema(operation, response.status);
    if (!responseSchema) return issues;

    const responseBody = this.normalizeBody(response.body);

    const missingFields = this.findMissingFields(responseBody, responseSchema);
    
    missingFields.forEach(({ path, schema }) => {
      issues.push({
        path,
        message: `响应中缺少定义的字段: ${path}`,
        expected: this.getSchemaDescription(schema),
        actual: null
      });
    });

    return issues;
  }

  checkAddedFields(context) {
    const issues = [];
    const { response, operation } = context;
    
    if (!response || !response.body) return issues;

    const responseSchema = this.getResponseSchema(operation, response.status);
    if (!responseSchema) return issues;

    const responseBody = this.normalizeBody(response.body);
    const additionalFields = this.findAdditionalFields(responseBody, responseSchema);
    
    additionalFields.forEach(({ path, value }) => {
      issues.push({
        path,
        message: `响应中出现合约未定义的字段: ${path}`,
        expected: null,
        actual: typeof value
      });
    });

    return issues;
  }

  checkTypeMismatch(context) {
    const issues = [];
    const { response, operation } = context;
    
    if (!response || !response.body) return issues;

    const responseSchema = this.getResponseSchema(operation, response.status);
    if (!responseSchema) return issues;

    const responseBody = this.normalizeBody(response.body);
    const mismatches = this.findTypeMismatches(responseBody, responseSchema);
    
    mismatches.forEach(({ path, expectedType, actualType, actualValue }) => {
      issues.push({
        path,
        message: `字段类型不匹配: ${path}`,
        expected: expectedType,
        actual: actualType,
        actualValue
      });
    });

    return issues;
  }

  checkEnumViolation(context) {
    const issues = [];
    const { response, operation } = context;
    
    if (!response || !response.body) return issues;

    const responseSchema = this.getResponseSchema(operation, response.status);
    if (!responseSchema) return issues;

    const responseBody = this.normalizeBody(response.body);
    const violations = this.findEnumViolations(responseBody, responseSchema);
    
    violations.forEach(({ path, enumValues, actualValue }) => {
      issues.push({
        path,
        message: `字段值不在枚举范围内: ${path}`,
        expected: enumValues,
        actual: actualValue
      });
    });

    return issues;
  }

  checkEnumAdded(context) {
    const issues = [];
    const { response, operation } = context;
    
    if (!response || !response.body) return issues;

    const responseSchema = this.getResponseSchema(operation, response.status);
    if (!responseSchema) return issues;

    const responseBody = this.normalizeBody(response.body);
    const addedEnums = this.findAddedEnums(responseBody, responseSchema);
    
    addedEnums.forEach(({ path, definedEnums, newValues }) => {
      issues.push({
        path,
        message: `响应中出现合约未定义的枚举值: ${path}`,
        expected: definedEnums,
        actual: newValues
      });
    });

    return issues;
  }

  checkEnumRemoved(context) {
    const issues = [];
    const { response, operation } = context;
    
    if (!response || !response.body) return issues;

    const responseSchema = this.getResponseSchema(operation, response.status);
    if (!responseSchema) return issues;

    const responseBody = this.normalizeBody(response.body);
    const removedEnums = this.findRemovedEnums(responseBody, responseSchema);
    
    removedEnums.forEach(({ path, definedEnums, missingValues }) => {
      issues.push({
        path,
        message: `合约中定义的枚举值在响应中未出现: ${path}`,
        expected: definedEnums,
        actual: missingValues
      });
    });

    return issues;
  }

  checkNullableMisuse(context) {
    const issues = [];
    const { response, operation } = context;
    
    if (!response || !response.body) return issues;

    const responseSchema = this.getResponseSchema(operation, response.status);
    if (!responseSchema) return issues;

    const responseBody = this.normalizeBody(response.body);
    const misuses = this.findNullableMisuses(responseBody, responseSchema);
    
    misuses.forEach(({ path, schema }) => {
      issues.push({
        path,
        message: `字段被标记为 nullable 但从未返回 null 值: ${path}`,
        expected: 'nullable: true',
        actual: '实际值始终非 null'
      });
    });

    return issues;
  }

  checkNullInNonNullable(context) {
    const issues = [];
    const { response, operation } = context;
    
    if (!response || !response.body) return issues;

    const responseSchema = this.getResponseSchema(operation, response.status);
    if (!responseSchema) return issues;

    const responseBody = this.normalizeBody(response.body);
    const violations = this.findNullInNonNullable(responseBody, responseSchema);
    
    violations.forEach(({ path, schema }) => {
      issues.push({
        path,
        message: `非 nullable 字段返回了 null 值: ${path}`,
        expected: '非 null 值',
        actual: null
      });
    });

    return issues;
  }

  checkMockCoverageMissingField(context) {
    const issues = [];
    const { response, mockResponse, operation } = context;
    
    if (!mockResponse || !response) return issues;

    const mockBody = this.normalizeBody(mockResponse.body);
    const actualBody = this.normalizeBody(response.body);

    if (!mockBody || !actualBody) return issues;

    const missingFields = this.findMissingFieldsInMock(mockBody, actualBody);
    
    missingFields.forEach(({ path }) => {
      issues.push({
        path,
        message: `Mock 数据包含该字段但真实响应缺失: ${path}`,
        expected: 'mock 中存在',
        actual: '真实响应中缺失'
      });
    });

    return issues;
  }

  checkRequiredFieldMissing(context) {
    const issues = [];
    const { response, operation } = context;
    
    if (!response || !response.body) return issues;

    const responseSchema = this.getResponseSchema(operation, response.status);
    if (!responseSchema) return issues;

    const responseBody = this.normalizeBody(response.body);
    const missingRequired = this.findMissingRequiredFields(responseBody, responseSchema);
    
    missingRequired.forEach(({ path, schema }) => {
      issues.push({
        path,
        message: `必填字段缺失: ${path}`,
        expected: '必填字段',
        actual: '缺失'
      });
    });

    return issues;
  }

  getResponseSchema(operation, statusCode) {
    const responses = operation.responses;
    if (!responses) return null;

    let schema = responses[statusCode] || responses['default'];
    if (!schema) {
      const statusPattern = `${statusCode.toString()[0]}XX`;
      schema = responses[statusPattern];
    }

    if (schema && schema.content) {
      const jsonContent = schema.content['application/json'];
      if (jsonContent && jsonContent.schema) {
        return jsonContent.schema;
      }
    }

    return schema;
  }

  normalizeBody(body) {
    if (typeof body === 'string') {
      try {
        return JSON.parse(body);
      } catch {
        return body;
      }
    }
    return body;
  }

  findMissingFields(data, schema, path = '') {
    const missing = [];
    
    if (!schema || !data) return missing;

    if (schema.type === 'object' && schema.properties) {
      const properties = Object.keys(schema.properties);
      
      properties.forEach((prop) => {
        const propPath = path ? `${path}.${prop}` : prop;
        const propSchema = schema.properties[prop];
        
        if (!(prop in data)) {
          if (schema.required && schema.required.includes(prop)) {
            missing.push({ path: propPath, schema: propSchema });
          }
        } else {
          missing.push(...this.findMissingFields(data[prop], propSchema, propPath));
        }
      });
    }

    if (schema.type === 'array' && schema.items && Array.isArray(data)) {
      data.forEach((item, index) => {
        missing.push(...this.findMissingFields(item, schema.items, `${path}[${index}]`));
      });
    }

    if (schema.$ref) {
      const resolvedSchema = this.resolveRef(schema.$ref);
      if (resolvedSchema) {
        missing.push(...this.findMissingFields(data, resolvedSchema, path));
      }
    }

    return missing;
  }

  findAdditionalFields(data, schema, path = '') {
    const additional = [];
    
    if (!schema || !data || typeof data !== 'object') return additional;

    if (schema.type === 'object' && schema.properties) {
      const definedProps = Object.keys(schema.properties);
      const actualProps = Object.keys(data);
      
      actualProps.forEach((prop) => {
        const propPath = path ? `${path}.${prop}` : prop;
        
        if (!definedProps.includes(prop) && !schema.additionalProperties) {
          additional.push({ path: propPath, value: data[prop] });
        } else if (definedProps.includes(prop)) {
          additional.push(...this.findAdditionalFields(data[prop], schema.properties[prop], propPath));
        }
      });
    }

    if (schema.type === 'array' && schema.items && Array.isArray(data)) {
      data.forEach((item, index) => {
        additional.push(...this.findAdditionalFields(item, schema.items, `${path}[${index}]`));
      });
    }

    if (schema.$ref) {
      const resolvedSchema = this.resolveRef(schema.$ref);
      if (resolvedSchema) {
        additional.push(...this.findAdditionalFields(data, resolvedSchema, path));
      }
    }

    return additional;
  }

  findTypeMismatches(data, schema, path = '') {
    const mismatches = [];
    
    if (!schema || data === undefined) return mismatches;

    if (schema.$ref) {
      const resolvedSchema = this.resolveRef(schema.$ref);
      if (resolvedSchema) {
        return this.findTypeMismatches(data, resolvedSchema, path);
      }
      return mismatches;
    }

    if (data === null) {
      return mismatches;
    }

    if (schema.type) {
      const actualType = this.getJsonType(data);
      const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
      
      if (!expectedTypes.includes(actualType) && !expectedTypes.includes(this.normalizeType(actualType))) {
        mismatches.push({
          path: path || '(root)',
          expectedType: schema.type,
          actualType,
          actualValue: data
        });
        return mismatches;
      }
    }

    if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null) {
      Object.keys(schema.properties).forEach((prop) => {
        if (prop in data) {
          const propPath = path ? `${path}.${prop}` : prop;
          mismatches.push(...this.findTypeMismatches(data[prop], schema.properties[prop], propPath));
        }
      });
    }

    if (schema.type === 'array' && schema.items && Array.isArray(data)) {
      data.forEach((item, index) => {
        mismatches.push(...this.findTypeMismatches(item, schema.items, `${path}[${index}]`));
      });
    }

    return mismatches;
  }

  findEnumViolations(data, schema, path = '') {
    const violations = [];
    
    if (!schema || data === undefined) return violations;

    if (schema.$ref) {
      const resolvedSchema = this.resolveRef(schema.$ref);
      if (resolvedSchema) {
        return this.findEnumViolations(data, resolvedSchema, path);
      }
      return violations;
    }

    if (schema.enum && data !== null && data !== undefined) {
      if (!schema.enum.includes(data)) {
        violations.push({
          path: path || '(root)',
          enumValues: schema.enum,
          actualValue: data
        });
      }
    }

    if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null) {
      Object.keys(schema.properties).forEach((prop) => {
        if (prop in data) {
          const propPath = path ? `${path}.${prop}` : prop;
          violations.push(...this.findEnumViolations(data[prop], schema.properties[prop], propPath));
        }
      });
    }

    if (schema.type === 'array' && schema.items && Array.isArray(data)) {
      data.forEach((item, index) => {
        violations.push(...this.findEnumViolations(item, schema.items, `${path}[${index}]`));
      });
    }

    return violations;
  }

  findNullableMisuses(data, schema, path = '') {
    const misuses = [];
    
    if (!schema || data === undefined) return misuses;

    if (schema.$ref) {
      const resolvedSchema = this.resolveRef(schema.$ref);
      if (resolvedSchema) {
        return this.findNullableMisuses(data, resolvedSchema, path);
      }
      return misuses;
    }

    if (schema.nullable === true && data !== null) {
      misuses.push({
        path: path || '(root)',
        schema
      });
    }

    if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null) {
      Object.keys(schema.properties).forEach((prop) => {
        if (prop in data) {
          const propPath = path ? `${path}.${prop}` : prop;
          misuses.push(...this.findNullableMisuses(data[prop], schema.properties[prop], propPath));
        }
      });
    }

    return misuses;
  }

  findNullInNonNullable(data, schema, path = '') {
    const violations = [];
    
    if (!schema || data === undefined) return violations;

    if (schema.$ref) {
      const resolvedSchema = this.resolveRef(schema.$ref);
      if (resolvedSchema) {
        return this.findNullInNonNullable(data, resolvedSchema, path);
      }
      return violations;
    }

    if (schema.nullable !== true && data === null) {
      violations.push({
        path: path || '(root)',
        schema
      });
    }

    if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null) {
      Object.keys(schema.properties).forEach((prop) => {
        if (prop in data) {
          const propPath = path ? `${path}.${prop}` : prop;
          violations.push(...this.findNullInNonNullable(data[prop], schema.properties[prop], propPath));
        }
      });
    }

    if (schema.type === 'array' && schema.items && Array.isArray(data)) {
      data.forEach((item, index) => {
        violations.push(...this.findNullInNonNullable(item, schema.items, `${path}[${index}]`));
      });
    }

    return violations;
  }

  findMissingFieldsInMock(mockData, actualData, path = '') {
    const missing = [];
    
    if (!mockData || !actualData) return missing;

    if (typeof mockData === 'object' && mockData !== null && typeof actualData === 'object' && actualData !== null) {
      Object.keys(mockData).forEach((prop) => {
        const propPath = path ? `${path}.${prop}` : prop;
        
        if (!(prop in actualData)) {
          missing.push({ path: propPath });
        } else {
          missing.push(...this.findMissingFieldsInMock(mockData[prop], actualData[prop], propPath));
        }
      });
    }

    if (Array.isArray(mockData) && Array.isArray(actualData)) {
      const minLength = Math.min(mockData.length, actualData.length);
      for (let i = 0; i < minLength; i++) {
        missing.push(...this.findMissingFieldsInMock(mockData[i], actualData[i], `${path}[${i}]`));
      }
    }

    return missing;
  }

  findMissingRequiredFields(data, schema, path = '') {
    const missing = [];
    
    if (!schema || !data) return missing;

    if (schema.$ref) {
      const resolvedSchema = this.resolveRef(schema.$ref);
      if (resolvedSchema) {
        return this.findMissingRequiredFields(data, resolvedSchema, path);
      }
      return missing;
    }

    if (schema.type === 'object' && schema.properties && schema.required) {
      schema.required.forEach((prop) => {
        const propPath = path ? `${path}.${prop}` : prop;
        
        if (!(prop in data)) {
          missing.push({
            path: propPath,
            schema: schema.properties[prop]
          });
        } else if (schema.properties[prop]) {
          missing.push(...this.findMissingRequiredFields(data[prop], schema.properties[prop], propPath));
        }
      });
    }

    return missing;
  }

  findAddedEnums(data, schema, path = '', seenValues = new Map()) {
    const added = [];
    
    if (!schema || data === undefined) return added;

    if (schema.$ref) {
      const resolvedSchema = this.resolveRef(schema.$ref);
      if (resolvedSchema) {
        return this.findAddedEnums(data, resolvedSchema, path, seenValues);
      }
      return added;
    }

    if (schema.enum && data !== null && data !== undefined) {
      if (!seenValues.has(path)) {
        seenValues.set(path, new Set());
      }
      seenValues.get(path).add(data);
    }

    if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null) {
      Object.keys(schema.properties).forEach((prop) => {
        if (prop in data) {
          const propPath = path ? `${path}.${prop}` : prop;
          added.push(...this.findAddedEnums(data[prop], schema.properties[prop], propPath, seenValues));
        }
      });
    }

    if (schema.type === 'array' && schema.items && Array.isArray(data)) {
      data.forEach((item, index) => {
        added.push(...this.findAddedEnums(item, schema.items, `${path}[${index}]`, seenValues));
      });
    }

    if (schema.enum && seenValues.has(path)) {
      const seen = Array.from(seenValues.get(path));
      const newValues = seen.filter((v) => !schema.enum.includes(v));
      
      if (newValues.length > 0) {
        added.push({
          path,
          definedEnums: schema.enum,
          newValues
        });
      }
    }

    return added;
  }

  findRemovedEnums(data, schema, path = '', seenValues = new Map()) {
    const removed = [];
    
    if (!schema || data === undefined) return removed;

    if (schema.$ref) {
      const resolvedSchema = this.resolveRef(schema.$ref);
      if (resolvedSchema) {
        return this.findRemovedEnums(data, resolvedSchema, path, seenValues);
      }
      return removed;
    }

    if (schema.enum && data !== null && data !== undefined) {
      if (!seenValues.has(path)) {
        seenValues.set(path, new Set());
      }
      seenValues.get(path).add(data);
    }

    if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null) {
      Object.keys(schema.properties).forEach((prop) => {
        if (prop in data) {
          const propPath = path ? `${path}.${prop}` : prop;
          removed.push(...this.findRemovedEnums(data[prop], schema.properties[prop], propPath, seenValues));
        }
      });
    }

    if (schema.type === 'array' && schema.items && Array.isArray(data)) {
      data.forEach((item, index) => {
        removed.push(...this.findRemovedEnums(item, schema.items, `${path}[${index}]`, seenValues));
      });
    }

    if (schema.enum && seenValues.has(path)) {
      const seen = Array.from(seenValues.get(path));
      const missingValues = schema.enum.filter((v) => !seen.includes(v));
      
      if (missingValues.length > 0) {
        removed.push({
          path,
          definedEnums: schema.enum,
          missingValues
        });
      }
    }

    return removed;
  }

  getJsonType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  normalizeType(type) {
    const typeMap = {
      'integer': 'number',
      'float': 'number',
      'double': 'number'
    };
    return typeMap[type] || type;
  }

  getSchemaDescription(schema) {
    if (!schema) return 'unknown';
    
    const parts = [];
    if (schema.type) parts.push(`type: ${schema.type}`);
    if (schema.enum) parts.push(`enum: [${schema.enum.join(', ')}]`);
    if (schema.nullable) parts.push('nullable: true');
    if (schema.required) parts.push(`required: [${schema.required.join(', ')}]`);
    
    return parts.join(', ') || 'unknown';
  }

  resolveRef(ref) {
    if (!ref || !ref.startsWith('#/')) {
      return null;
    }

    const parts = ref.slice(2).split('/');
    let current = this.contractIndex.spec;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  }
}
