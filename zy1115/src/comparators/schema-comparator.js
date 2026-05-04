const _ = require('lodash');

const IssueSeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

const IssueCategory = {
  DESTRUCTIVE_CHANGE: 'destructive_change',
  MOCK_OUT_OF_SYNC: 'mock_out_of_sync',
  NEW_FIELD_IN_CAPTURE: 'new_field_in_capture',
  DOCUMENTATION_MISSING: 'documentation_missing',
  TYPE_MISMATCH: 'type_mismatch',
  ENUM_MISMATCH: 'enum_mismatch',
  NULLABLE_MISMATCH: 'nullable_mismatch',
  REQUIRED_MISMATCH: 'required_mismatch',
  PAGINATION_MISMATCH: 'pagination_mismatch',
  FORMAT_MISMATCH: 'format_mismatch',
  ENDPOINT_MISSING: 'endpoint_missing',
  ENDPOINT_EXTRA: 'endpoint_extra'
};

const IssueFixSuggestions = {
  [IssueCategory.DESTRUCTIVE_CHANGE]: '这是破坏性变更，需要更新所有依赖方并考虑版本控制。',
  [IssueCategory.MOCK_OUT_OF_SYNC]: 'Mock 数据需要更新以匹配 OpenAPI 文档或实际实现。',
  [IssueCategory.NEW_FIELD_IN_CAPTURE]: '新字段在实际响应中出现，需要更新 OpenAPI 文档和 mock 数据。',
  [IssueCategory.DOCUMENTATION_MISSING]: 'OpenAPI 文档缺少字段定义，需要补充。',
  [IssueCategory.TYPE_MISMATCH]: '字段类型不一致，请检查并统一类型定义。',
  [IssueCategory.ENUM_MISMATCH]: '枚举值不一致，请检查文档和实现中的枚举定义。',
  [IssueCategory.NULLABLE_MISMATCH]: 'nullable 属性不一致，请检查字段是否允许为 null。',
  [IssueCategory.REQUIRED_MISMATCH]: '必填字段定义不一致，请检查 required 配置。',
  [IssueCategory.PAGINATION_MISMATCH]: '分页字段名称不一致，请统一使用 page/pageSize 或 limit/offset。',
  [IssueCategory.FORMAT_MISMATCH]: '数据格式不一致，请检查时间、金额等字段的格式。'
};

class SchemaComparator {
  constructor(ignoreRules = null) {
    this.ignoreRules = ignoreRules;
    this.issues = [];
    this.stats = {
      totalEndpoints: 0,
      endpointsWithIssues: 0,
      totalIssues: 0,
      issuesBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      },
      issuesByCategory: {}
    };
  }

  isParameterizedPath(path) {
    return /\{[^{}]+\}/.test(path);
  }

  pathToRegex(path) {
    const segments = path.split('/');
    const pattern = segments.map(segment => {
      if (segment.startsWith('{') && segment.endsWith('}')) {
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/');
    
    return new RegExp(`^${pattern}$`);
  }

  matchConcretePathToPattern(concretePath, parameterizedPaths) {
    for (const patternPath of parameterizedPaths) {
      const regex = this.pathToRegex(patternPath);
      if (regex.test(concretePath)) {
        return patternPath;
      }
    }
    return null;
  }

  areTypesCompatible(type1, type2, nullable1, nullable2) {
    if (type1 === type2) return true;

    if ((type1 === 'null' || type1 === 'mixed') && nullable2 === true) return true;
    if ((type2 === 'null' || type2 === 'mixed') && nullable1 === true) return true;

    if (type1 === 'integer' && type2 === 'number') return true;
    if (type1 === 'number' && type2 === 'integer') return true;

    return false;
  }

  compareAll(dataSources) {
    this.issues = [];
    this.stats = {
      totalEndpoints: 0,
      endpointsWithIssues: 0,
      totalIssues: 0,
      issuesBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      },
      issuesByCategory: {}
    };

    const allEndpoints = this.collectAllEndpoints(dataSources);
    this.stats.totalEndpoints = allEndpoints.size;

    for (const [key, endpointData] of allEndpoints) {
      const [method, path] = key.split(':');
      const endpointIssues = this.compareEndpointData(endpointData, { method, path });
      
      if (endpointIssues.length > 0) {
        this.stats.endpointsWithIssues++;
        this.issues.push(...endpointIssues);
      }
    }

    this.checkEndpointExistence(dataSources, allEndpoints);
    this.updateStats();

    const result = {
      issues: this.filterIgnoredIssues(this.issues),
      stats: this.stats,
      summary: this.generateSummary(),
      dataSources: Object.keys(dataSources)
    };

    return result;
  }

  compareTwo(dataSources, source1, source2) {
    this.issues = [];
    this.stats = {
      totalEndpoints: 0,
      endpointsWithIssues: 0,
      totalIssues: 0,
      issuesBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      },
      issuesByCategory: {}
    };

    const allEndpoints = this.collectAllEndpoints({ [source1]: dataSources[source1], [source2]: dataSources[source2] });
    this.stats.totalEndpoints = allEndpoints.size;

    for (const [key, endpointData] of allEndpoints) {
      const [method, path] = key.split(':');
      const endpointIssues = this.compareEndpointData(endpointData, { method, path });
      
      if (endpointIssues.length > 0) {
        this.stats.endpointsWithIssues++;
        this.issues.push(...endpointIssues);
      }
    }

    this.checkEndpointExistence({ [source1]: dataSources[source1], [source2]: dataSources[source2] }, allEndpoints);
    this.updateStats();

    const result = {
      issues: this.filterIgnoredIssues(this.issues),
      stats: this.stats,
      summary: this.generateSummary(),
      dataSources: [source1, source2]
    };

    return result;
  }

  compareEndpoint(dataSources, source1, source2, method, path) {
    this.issues = [];
    this.stats = {
      totalEndpoints: 1,
      endpointsWithIssues: 0,
      totalIssues: 0,
      issuesBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      },
      issuesByCategory: {}
    };

    const endpointData = {
      [source1]: this.findEndpoint(dataSources[source1], method, path),
      [source2]: this.findEndpoint(dataSources[source2], method, path)
    };

    const endpointIssues = this.compareEndpointData(endpointData, { method, path });
    
    if (endpointIssues.length > 0) {
      this.stats.endpointsWithIssues++;
      this.issues.push(...endpointIssues);
    }

    this.updateStats();

    const result = {
      issues: this.filterIgnoredIssues(this.issues),
      stats: this.stats,
      summary: this.generateSummary(),
      dataSources: [source1, source2]
    };

    return result;
  }

  collectAllEndpoints(dataSources) {
    const allEndpoints = new Map();
    const parameterizedPaths = new Map();

    for (const [sourceType, sourceData] of Object.entries(dataSources)) {
      if (!sourceData || !sourceData.endpoints) continue;

      for (const endpoint of sourceData.endpoints) {
        if (this.isParameterizedPath(endpoint.path)) {
          const method = endpoint.method.toUpperCase();
          if (!parameterizedPaths.has(method)) {
            parameterizedPaths.set(method, []);
          }
          parameterizedPaths.get(method).push(endpoint.path);
        }
      }
    }

    for (const [sourceType, sourceData] of Object.entries(dataSources)) {
      if (!sourceData || !sourceData.endpoints) continue;

      for (const endpoint of sourceData.endpoints) {
        let normalizedPath = endpoint.path;
        const method = endpoint.method.toUpperCase();

        if (!this.isParameterizedPath(normalizedPath) && parameterizedPaths.has(method)) {
          const matchedPattern = this.matchConcretePathToPattern(
            normalizedPath, 
            parameterizedPaths.get(method)
          );
          if (matchedPattern) {
            normalizedPath = matchedPattern;
          }
        }

        const key = `${method}:${normalizedPath}`;
        
        if (!allEndpoints.has(key)) {
          allEndpoints.set(key, {});
        }
        
        allEndpoints.get(key)[sourceType] = endpoint;
      }
    }

    return allEndpoints;
  }

  findEndpoint(sourceData, method, path) {
    if (!sourceData || !sourceData.endpoints) return null;
    return sourceData.endpoints.find(e => 
      e.method.toUpperCase() === method.toUpperCase() && e.path === path
    );
  }

  compareEndpointData(endpointData, endpointInfo) {
    const issues = [];
    const { method, path } = endpointInfo;
    
    const sources = Object.keys(endpointData);
    if (sources.length < 2) {
      return issues;
    }

    const referenceSource = endpointData.openapi ? 'openapi' : sources[0];
    const referenceEndpoint = endpointData[referenceSource];

    for (const [sourceType, endpoint] of Object.entries(endpointData)) {
      if (sourceType === referenceSource) continue;

      const comparisonIssues = this.compareTwoEndpoints(
        referenceEndpoint, 
        endpoint, 
        referenceSource, 
        sourceType,
        { method, path }
      );
      
      issues.push(...comparisonIssues);
    }

    return issues;
  }

  compareTwoEndpoints(endpoint1, endpoint2, source1, source2, endpointInfo) {
    const issues = [];
    
    if (!endpoint1 || !endpoint2) return issues;

    if (endpoint1.requestSchema && endpoint2.requestSchema) {
      const requestIssues = this.compareSchemas(
        endpoint1.requestSchema,
        endpoint2.requestSchema,
        'request',
        source1,
        source2,
        endpointInfo
      );
      issues.push(...requestIssues);
    }

    const responseCodes = new Set([
      ...Object.keys(endpoint1.responseSchemas || {}),
      ...Object.keys(endpoint2.responseSchemas || {})
    ]);

    for (const statusCode of responseCodes) {
      const schema1 = endpoint1.responseSchemas?.[statusCode];
      const schema2 = endpoint2.responseSchemas?.[statusCode];
      
      if (schema1 && schema2) {
        const responseIssues = this.compareSchemas(
          schema1,
          schema2,
          `response.${statusCode}`,
          source1,
          source2,
          endpointInfo
        );
        issues.push(...responseIssues);
      } else if (schema1 && !schema2) {
        issues.push(this.createIssue({
          category: IssueCategory.DOCUMENTATION_MISSING,
          severity: IssueSeverity.LOW,
          message: `${source2} 中缺少状态码 ${statusCode} 的响应 schema`,
          endpoint: endpointInfo,
          source1,
          source2,
          location: `response.${statusCode}`
        }));
      }
    }

    const paginationIssues = this.checkPaginationConsistency(
      endpoint1,
      endpoint2,
      source1,
      source2,
      endpointInfo
    );
    issues.push(...paginationIssues);

    return issues;
  }

  compareSchemas(schema1, schema2, schemaType, source1, source2, endpointInfo, jsonPath = '') {
    const issues = [];

    if (!schema1 || !schema2) return issues;

    const type1 = schema1.type;
    const type2 = schema2.type;
    const nullable1 = schema1.nullable || false;
    const nullable2 = schema2.nullable || false;

    if (type1 !== type2) {
      const typesCompatible = this.areTypesCompatible(type1, type2, nullable1, nullable2);
      
      if (!typesCompatible) {
        issues.push(this.createIssue({
          category: IssueCategory.TYPE_MISMATCH,
          severity: this.isTypeMismatchCritical(type1, type2) ? IssueSeverity.CRITICAL : IssueSeverity.HIGH,
          message: `字段类型不匹配: ${source1} 是 ${type1}, ${source2} 是 ${type2}`,
          endpoint: endpointInfo,
          source1,
          source2,
          field: jsonPath || schemaType,
          expected: type1,
          actual: type2,
          location: jsonPath || schemaType
        }));
      }
    }

    if (schema1.nullable !== undefined && schema2.nullable !== undefined) {
      if (schema1.nullable !== schema2.nullable) {
        const isIncompatible = 
          (schema1.nullable === false && (type2 === 'null' || type2 === 'mixed')) ||
          (schema2.nullable === false && (type1 === 'null' || type1 === 'mixed'));
        
        if (isIncompatible) {
          issues.push(this.createIssue({
            category: IssueCategory.NULLABLE_MISMATCH,
            severity: IssueSeverity.MEDIUM,
            message: `nullable 属性不匹配: ${source1} 是 ${schema1.nullable}, ${source2} 是 ${schema2.nullable}`,
            endpoint: endpointInfo,
            source1,
            source2,
            field: jsonPath || schemaType,
            location: jsonPath || schemaType
          }));
        }
      }
    }

    if (schema1.enum && schema2.enum) {
      const enumIssues = this.compareEnums(schema1.enum, schema2.enum, source1, source2, endpointInfo, jsonPath);
      issues.push(...enumIssues);
    }

    if (schema1.format && schema2.format && schema1.format !== schema2.format) {
      issues.push(this.createIssue({
        category: IssueCategory.FORMAT_MISMATCH,
        severity: this.isFormatMismatchCritical(schema1.format, schema2.format) ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
        message: `格式不匹配: ${source1} 是 ${schema1.format}, ${source2} 是 ${schema2.format}`,
        endpoint: endpointInfo,
        source1,
        source2,
        field: jsonPath || schemaType,
        location: jsonPath || schemaType
      }));
    }

    if (schema1.type === 'object' && schema2.type === 'object') {
      const props1 = schema1.properties || {};
      const props2 = schema2.properties || {};
      const allProps = new Set([...Object.keys(props1), ...Object.keys(props2)]);

      for (const propName of allProps) {
        const propPath = jsonPath ? `${jsonPath}.${propName}` : propName;
        
        if (props1[propName] && !props2[propName]) {
          const severity = this.isMissingFieldCritical(propName, props1[propName]) ? IssueSeverity.CRITICAL : IssueSeverity.HIGH;
          const category = source1 === 'openapi' ? IssueCategory.DOCUMENTATION_MISSING : IssueCategory.MOCK_OUT_OF_SYNC;
          
          issues.push(this.createIssue({
            category,
            severity,
            message: `${source2} 中缺少字段: ${propName}`,
            endpoint: endpointInfo,
            source1,
            source2,
            field: propPath,
            location: propPath,
            isMissing: true
          }));
        } else if (!props1[propName] && props2[propName]) {
          const category = source2 === 'captured' ? IssueCategory.NEW_FIELD_IN_CAPTURE : IssueCategory.MOCK_OUT_OF_SYNC;
          const severity = source2 === 'captured' ? IssueSeverity.MEDIUM : IssueSeverity.HIGH;
          
          issues.push(this.createIssue({
            category,
            severity,
            message: `${source2} 中存在额外字段: ${propName} (${source1} 中未定义)`,
            endpoint: endpointInfo,
            source1,
            source2,
            field: propPath,
            location: propPath,
            isExtra: true
          }));
        } else {
          const prop1 = props1[propName];
          const prop2 = props2[propName];

          if (prop1.required !== undefined && prop2.required !== undefined) {
            if (prop1.required !== prop2.required) {
              const isOpenAPIInferred = source1 === 'openapi' && (prop1.required === false);
              const isDataInferred1 = ['mock', 'fixture', 'captured'].includes(source1);
              const isDataInferred2 = ['mock', 'fixture', 'captured'].includes(source2);
              
              if (!(isDataInferred1 && prop2.required === false) && 
                  !(isDataInferred2 && prop1.required === false)) {
                issues.push(this.createIssue({
                  category: IssueCategory.REQUIRED_MISMATCH,
                  severity: IssueSeverity.HIGH,
                  message: `required 属性不匹配: ${source1} 是 ${prop1.required}, ${source2} 是 ${prop2.required}`,
                  endpoint: endpointInfo,
                  source1,
                  source2,
                  field: propPath,
                  location: propPath
                }));
              }
            }
          }

          const nestedIssues = this.compareSchemas(
            prop1,
            prop2,
            schemaType,
            source1,
            source2,
            endpointInfo,
            propPath
          );
          issues.push(...nestedIssues);
        }
      }
    }

    if (schema1.type === 'array' && schema2.type === 'array') {
      if (schema1.items && schema2.items) {
        const itemPath = jsonPath ? `${jsonPath}[]` : '[]';
        const itemIssues = this.compareSchemas(
          schema1.items,
          schema2.items,
          schemaType,
          source1,
          source2,
          endpointInfo,
          itemPath
        );
        issues.push(...itemIssues);
      }
    }

    return issues;
  }

  compareEnums(enum1, enum2, source1, source2, endpointInfo, jsonPath) {
    const issues = [];
    const set1 = new Set(enum1);
    const set2 = new Set(enum2);

    const missingFromSource2 = enum1.filter(v => !set2.has(v));
    const extraInSource2 = enum2.filter(v => !set1.has(v));

    if (missingFromSource2.length > 0) {
      issues.push(this.createIssue({
        category: IssueCategory.ENUM_MISMATCH,
        severity: IssueSeverity.HIGH,
        message: `${source2} 中缺少枚举值: ${missingFromSource2.join(', ')}`,
        endpoint: endpointInfo,
        source1,
        source2,
        field: jsonPath,
        location: jsonPath,
        missingValues: missingFromSource2
      }));
    }

    if (extraInSource2.length > 0) {
      const severity = source2 === 'captured' ? IssueSeverity.MEDIUM : IssueSeverity.HIGH;
      const category = source2 === 'captured' ? IssueCategory.NEW_FIELD_IN_CAPTURE : IssueCategory.ENUM_MISMATCH;
      
      issues.push(this.createIssue({
        category,
        severity,
        message: `${source2} 中存在额外枚举值: ${extraInSource2.join(', ')} (${source1} 中未定义)`,
        endpoint: endpointInfo,
        source1,
        source2,
        field: jsonPath,
        location: jsonPath,
        extraValues: extraInSource2
      }));
    }

    return issues;
  }

  checkPaginationConsistency(endpoint1, endpoint2, source1, source2, endpointInfo) {
    const issues = [];
    
    const paginationFields1 = this.extractPaginationFields(endpoint1);
    const paginationFields2 = this.extractPaginationFields(endpoint2);

    if (paginationFields1.style && paginationFields2.style && paginationFields1.style !== paginationFields2.style) {
      issues.push(this.createIssue({
        category: IssueCategory.PAGINATION_MISMATCH,
        severity: IssueSeverity.HIGH,
        message: `分页字段风格不匹配: ${source1} 使用 ${paginationFields1.style}, ${source2} 使用 ${paginationFields2.style}`,
        endpoint: endpointInfo,
        source1,
        source2,
        field: 'pagination',
        location: 'pagination'
      }));
    }

    return issues;
  }

  extractPaginationFields(endpoint) {
    const result = {
      style: null,
      fields: []
    };

    if (endpoint.parameters) {
      const pageParam = endpoint.parameters.find(p => 
        p.name === 'page' || p.name === 'pageNumber' || p.name === 'offset'
      );
      const sizeParam = endpoint.parameters.find(p => 
        p.name === 'pageSize' || p.name === 'limit' || p.name === 'size'
      );

      if (pageParam || sizeParam) {
        if ((pageParam?.name === 'page' || pageParam?.name === 'pageNumber') && 
            (sizeParam?.name === 'pageSize' || sizeParam?.name === 'size')) {
          result.style = 'page-based';
        } else if (pageParam?.name === 'offset' && sizeParam?.name === 'limit') {
          result.style = 'offset-based';
        }
        result.fields = [pageParam?.name, sizeParam?.name].filter(Boolean);
      }
    }

    const responseSchema = endpoint.responseSchemas?.['200'] || endpoint.responseSchemas?.['201'];
    if (responseSchema?.type === 'object' && responseSchema.properties) {
      const props = responseSchema.properties;
      
      if (props.page && (props.pageSize || props.size)) {
        result.style = result.style || 'page-based';
        result.fields.push('page', props.pageSize ? 'pageSize' : 'size');
      } else if (props.offset && props.limit) {
        result.style = result.style || 'offset-based';
        result.fields.push('offset', 'limit');
      }
      
      if (props.total || props.totalCount || props.totalElements) {
        result.fields.push(props.total ? 'total' : props.totalCount ? 'totalCount' : 'totalElements');
      }
      if (props.data || props.items || props.content) {
        result.fields.push(props.data ? 'data' : props.items ? 'items' : 'content');
      }
    }

    return result;
  }

  checkEndpointExistence(dataSources, allEndpoints) {
    const sourceTypes = Object.keys(dataSources);
    
    for (const [key, endpointData] of allEndpoints) {
      const [method, path] = key.split(':');
      
      for (const sourceType of sourceTypes) {
        if (!endpointData[sourceType] && dataSources[sourceType]) {
          const referenceSource = Object.keys(endpointData)[0];
          
          this.issues.push(this.createIssue({
            category: IssueCategory.ENDPOINT_MISSING,
            severity: IssueSeverity.HIGH,
            message: `端点 ${method} ${path} 在 ${sourceType} 中不存在`,
            endpoint: { method, path },
            source1: referenceSource,
            source2: sourceType,
            location: 'endpoint'
          }));
        }
      }
    }
  }

  createIssue(details) {
    const issue = {
      id: this.generateIssueId(),
      ...details,
      timestamp: new Date().toISOString(),
      suggestion: IssueFixSuggestions[details.category] || '请检查相关配置和文档。'
    };

    return issue;
  }

  generateIssueId() {
    return `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  isTypeMismatchCritical(type1, type2) {
    const criticalPairs = [
      ['object', 'array'],
      ['array', 'object'],
      ['object', 'string'],
      ['object', 'number'],
      ['object', 'integer'],
      ['object', 'boolean'],
      ['array', 'string'],
      ['array', 'number'],
      ['array', 'integer'],
      ['array', 'boolean']
    ];

    return criticalPairs.some(pair => 
      (pair[0] === type1 && pair[1] === type2) ||
      (pair[0] === type2 && pair[1] === type1)
    );
  }

  isFormatMismatchCritical(format1, format2) {
    const criticalFormats = ['date-time', 'date', 'uuid', 'email', 'uri'];
    return criticalFormats.includes(format1) || criticalFormats.includes(format2);
  }

  isMissingFieldCritical(fieldName, fieldSchema) {
    if (fieldSchema.required) return true;
    
    const criticalFields = ['id', 'userId', 'orderId', 'amount', 'price', 'status'];
    if (criticalFields.includes(fieldName)) return true;
    
    return false;
  }

  filterIgnoredIssues(issues) {
    if (!this.ignoreRules) return issues;
    return this.ignoreRules.filterIssues(issues);
  }

  updateStats() {
    this.stats.totalIssues = this.issues.length;
    
    for (const issue of this.issues) {
      this.stats.issuesBySeverity[issue.severity]++;
      this.stats.issuesByCategory[issue.category] = 
        (this.stats.issuesByCategory[issue.category] || 0) + 1;
    }
  }

  generateSummary() {
    return {
      hasIssues: this.issues.length > 0,
      totalIssues: this.issues.length,
      criticalCount: this.stats.issuesBySeverity.critical,
      highCount: this.stats.issuesBySeverity.high,
      mediumCount: this.stats.issuesBySeverity.medium,
      lowCount: this.stats.issuesBySeverity.low,
      infoCount: this.stats.issuesBySeverity.info,
      affectedEndpoints: this.stats.endpointsWithIssues,
      totalEndpoints: this.stats.totalEndpoints
    };
  }
}

module.exports = {
  SchemaComparator,
  IssueSeverity,
  IssueCategory,
  IssueFixSuggestions
};
