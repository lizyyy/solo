import { SEVERITY, CATEGORIES } from './checker.js';

let sampleIssueCounter = 0;

export function validateSamples(samples, newSpec) {
  const issues = [];
  const matchedEndpoints = new Set();
  
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const sampleIndex = i + 1;
    
    const validation = validateSampleFormat(sample, sampleIndex);
    if (validation.errors.length > 0) {
      issues.push(...validation.errors);
      continue;
    }
    
    const matchResult = findMatchingEndpoint(sample, newSpec);
    
    if (!matchResult.found) {
      issues.push(createSampleIssue({
        severity: SEVERITY.MEDIUM,
        location: { sampleIndex, method: sample.method, path: sample.path },
        message: `请求样例无法匹配任何 API 端点`,
        reason: matchResult.reason || '没有找到匹配的路径和方法组合',
        migration: '检查请求样例的 method 和 path 是否正确，或者更新 OpenAPI 规范'
      }));
      continue;
    }
    
    matchedEndpoints.add(`${matchResult.method}:${matchResult.templatePath}`);
    issues.push(...validateSampleAgainstOperation(sample, matchResult, sampleIndex));
  }
  
  const unmatchedEndpoints = findUnmatchedEndpoints(newSpec, matchedEndpoints);
  for (const endpoint of unmatchedEndpoints) {
    issues.push(createSampleIssue({
      severity: SEVERITY.INFO,
      location: { method: endpoint.method, path: endpoint.path },
      message: `API 端点没有对应的请求样例`,
      reason: '该端点在 OpenAPI 规范中定义，但没有请求样例覆盖',
      migration: '考虑添加请求样例以确保该端点的变更能够被检测到'
    }));
  }
  
  return {
    issues: sortSampleIssues(issues),
    summary: generateSampleSummary(issues)
  };
}

function validateSampleFormat(sample, sampleIndex) {
  const errors = [];
  
  if (!sample.method) {
    errors.push(createSampleIssue({
      severity: SEVERITY.HIGH,
      location: { sampleIndex },
      message: `请求样例 #${sampleIndex} 缺少 method 字段`,
      reason: '请求样例必须包含 HTTP method',
      migration: '添加 method 字段，如: "GET", "POST", "PUT" 等'
    }));
  }
  
  if (!sample.path) {
    errors.push(createSampleIssue({
      severity: SEVERITY.HIGH,
      location: { sampleIndex },
      message: `请求样例 #${sampleIndex} 缺少 path 字段`,
      reason: '请求样例必须包含 API 路径',
      migration: '添加 path 字段，如: "/users/123"'
    }));
  }
  
  if (sample.pathParams && typeof sample.pathParams !== 'object') {
    errors.push(createSampleIssue({
      severity: SEVERITY.HIGH,
      location: { sampleIndex },
      message: `请求样例 #${sampleIndex} 的 pathParams 必须是对象`,
      reason: 'pathParams 应该是键值对对象',
      migration: '将 pathParams 改为对象格式，如: { "userId": "123" }'
    }));
  }
  
  if (sample.queryParams && typeof sample.queryParams !== 'object') {
    errors.push(createSampleIssue({
      severity: SEVERITY.HIGH,
      location: { sampleIndex },
      message: `请求样例 #${sampleIndex} 的 queryParams 必须是对象`,
      reason: 'queryParams 应该是键值对对象',
      migration: '将 queryParams 改为对象格式，如: { "page": "1", "limit": "10" }'
    }));
  }
  
  return { errors };
}

function findMatchingEndpoint(sample, spec) {
  const method = sample.method?.toUpperCase();
  const path = sample.path;
  
  if (!method || !path) {
    return { found: false, reason: '缺少 method 或 path' };
  }
  
  for (const [templatePath, pathItem] of Object.entries(spec.paths)) {
    const matchResult = matchPath(path, templatePath, sample.pathParams);
    if (matchResult.matched) {
      const operation = pathItem.operations[method];
      if (operation) {
        return {
          found: true,
          method,
          templatePath,
          actualPath: path,
          pathItem,
          operation,
          pathParams: matchResult.params
        };
      }
    }
  }
  
  return { found: false, reason: `没有找到匹配 ${method} ${path} 的端点` };
}

function matchPath(actualPath, templatePath, samplePathParams) {
  const actualSegments = actualPath.split('/').filter(s => s);
  const templateSegments = templatePath.split('/').filter(s => s);
  
  if (actualSegments.length !== templateSegments.length) {
    return { matched: false };
  }
  
  const params = {};
  
  for (let i = 0; i < templateSegments.length; i++) {
    const templateSeg = templateSegments[i];
    const actualSeg = actualSegments[i];
    
    if (templateSeg.startsWith('{') && templateSeg.endsWith('}')) {
      const paramName = templateSeg.slice(1, -1);
      
      if (samplePathParams && samplePathParams[paramName] !== undefined) {
        if (samplePathParams[paramName] !== actualSeg) {
          return { matched: false };
        }
      }
      
      params[paramName] = actualSeg;
    } else if (templateSeg !== actualSeg) {
      return { matched: false };
    }
  }
  
  return { matched: true, params };
}

function validateSampleAgainstOperation(sample, matchResult, sampleIndex) {
  const issues = [];
  const { operation, templatePath } = matchResult;
  const method = matchResult.method;
  
  issues.push(...validatePathParams(sample, matchResult, sampleIndex));
  issues.push(...validateQueryParams(sample, operation, sampleIndex, { method, path: templatePath }));
  issues.push(...validateRequestBody(sample, operation, sampleIndex, { method, path: templatePath }));
  
  return issues;
}

function validatePathParams(sample, matchResult, sampleIndex) {
  const issues = [];
  const { operation, templatePath, method } = matchResult;
  
  const pathParams = operation.parameters.filter(p => p.in === 'path');
  
  for (const param of pathParams) {
    const sampleHasParam = sample.pathParams && sample.pathParams[param.name] !== undefined;
    
    if (param.required && !sampleHasParam) {
      issues.push(createSampleIssue({
        severity: SEVERITY.HIGH,
        location: { sampleIndex, method, path: templatePath, parameter: param.name, in: 'path' },
        message: `请求样例缺少必填路径参数 "${param.name}"`,
        reason: '该路径参数在 OpenAPI 规范中标记为必填',
        migration: `在请求样例中添加 pathParams.${param.name} 字段`
      }));
    }
  }
  
  return issues;
}

function validateQueryParams(sample, operation, sampleIndex, location) {
  const issues = [];
  
  const queryParams = operation.parameters.filter(p => p.in === 'query');
  const sampleQueryParams = sample.queryParams || {};
  const sampleParamNames = Object.keys(sampleQueryParams);
  
  for (const param of queryParams) {
    const sampleHasParam = sampleParamNames.includes(param.name);
    
    if (param.required && !sampleHasParam) {
      issues.push(createSampleIssue({
        severity: SEVERITY.HIGH,
        location: { ...location, sampleIndex, parameter: param.name, in: 'query' },
        message: `请求样例缺少必填查询参数 "${param.name}"`,
        reason: '该查询参数在 OpenAPI 规范中标记为必填',
        migration: `在请求样例中添加 queryParams.${param.name} 字段`
      }));
    }
    
    if (sampleHasParam && param.schema) {
      const validation = validateValueAgainstSchema(sampleQueryParams[param.name], param.schema);
      if (!validation.valid) {
        issues.push(createSampleIssue({
          severity: SEVERITY.MEDIUM,
          location: { ...location, sampleIndex, parameter: param.name, in: 'query' },
          message: `查询参数 "${param.name}" 值类型不匹配`,
          reason: validation.reason || '值与 schema 定义不匹配',
          migration: validation.migration || '更新请求样例使用正确的类型'
        }));
      }
    }
  }
  
  const definedParamNames = new Set(queryParams.map(p => p.name));
  for (const paramName of sampleParamNames) {
    if (!definedParamNames.has(paramName)) {
      issues.push(createSampleIssue({
        severity: SEVERITY.MEDIUM,
        location: { ...location, sampleIndex, parameter: paramName, in: 'query' },
        message: `请求样例包含未定义的查询参数 "${paramName}"`,
        reason: '该查询参数在 OpenAPI 规范中未定义，服务端可能拒绝或忽略',
        migration: '移除此参数，或检查 OpenAPI 规范是否需要更新'
      }));
    }
  }
  
  return issues;
}

function validateRequestBody(sample, operation, sampleIndex, location) {
  const issues = [];
  
  if (!operation.requestBody) {
    if (sample.body !== undefined) {
      issues.push(createSampleIssue({
        severity: SEVERITY.MEDIUM,
        location: { ...location, sampleIndex, requestBody: true },
        message: `请求样例包含请求体，但该端点不接受请求体`,
        reason: '该端点在 OpenAPI 规范中未定义请求体',
        migration: '移除请求体，或检查 OpenAPI 规范是否需要更新'
      }));
    }
    return issues;
  }
  
  const requestBody = operation.requestBody;
  
  if (requestBody.required && sample.body === undefined) {
    issues.push(createSampleIssue({
      severity: SEVERITY.HIGH,
      location: { ...location, sampleIndex, requestBody: true },
      message: `请求样例缺少必填请求体`,
      reason: '该端点的请求体在 OpenAPI 规范中标记为必填',
      migration: '在请求样例中添加 body 字段'
    }));
    return issues;
  }
  
  if (sample.body === undefined) return issues;
  
  const mediaTypes = Object.keys(requestBody.content || {});
  const sampleMediaType = sample.mediaType || 'application/json';
  
  if (!mediaTypes.includes(sampleMediaType)) {
    issues.push(createSampleIssue({
      severity: SEVERITY.MEDIUM,
      location: { ...location, sampleIndex, mediaType: sampleMediaType },
      message: `请求体 Media-Type "${sampleMediaType}" 不被支持`,
      reason: `支持的 Media-Type: ${mediaTypes.join(', ')}`,
      migration: `使用支持的 Media-Type，或更新样例的 mediaType 字段`
    }));
    return issues;
  }
  
  const content = requestBody.content[sampleMediaType];
  if (content.schema && sample.body) {
    const validation = validateObjectAgainstSchema(sample.body, content.schema, 'body');
    issues.push(...validation.issues.map(v => createSampleIssue({
      severity: v.severity,
      location: { ...location, sampleIndex, field: v.path },
      message: `请求体字段 "${v.path}" ${v.message}`,
      reason: v.reason,
      migration: v.migration
    })));
  }
  
  return issues;
}

function validateObjectAgainstSchema(obj, schema, basePath = '') {
  const issues = [];
  
  if (!schema.properties || !obj || typeof obj !== 'object') {
    return { issues };
  }
  
  const required = new Set(schema.required || []);
  const properties = schema.properties;
  const objKeys = Object.keys(obj);
  
  for (const [propName, propSchema] of Object.entries(properties)) {
    const path = basePath ? `${basePath}.${propName}` : propName;
    const hasValue = objKeys.includes(propName);
    
    if (required.has(propName) && !hasValue) {
      issues.push({
        severity: SEVERITY.HIGH,
        path,
        message: '是必填字段但缺失',
        reason: '该字段在 schema 中标记为 required',
        migration: `在请求样例中添加 ${path} 字段`
      });
      continue;
    }
    
    if (!hasValue) continue;
    
    const value = obj[propName];
    const validation = validateValueAgainstSchema(value, propSchema);
    
    if (!validation.valid) {
      issues.push({
        severity: SEVERITY.MEDIUM,
        path,
        message: validation.reason || '类型不匹配',
        reason: `期望类型: ${propSchema.type}`,
        migration: validation.migration || `更新 ${path} 的值类型`
      });
    }
    
    if (propSchema.type === 'object' && propSchema.properties && typeof value === 'object') {
      const nestedValidation = validateObjectAgainstSchema(value, propSchema, path);
      issues.push(...nestedValidation.issues);
    }
    
    if (propSchema.type === 'array' && propSchema.items && Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const itemPath = `${path}[${i}]`;
        const itemValidation = validateValueAgainstSchema(value[i], propSchema.items);
        if (!itemValidation.valid) {
          issues.push({
            severity: SEVERITY.MEDIUM,
            path: itemPath,
            message: itemValidation.reason || '数组元素类型不匹配',
            reason: `期望数组元素类型: ${propSchema.items.type}`,
            migration: itemValidation.migration || `更新 ${itemPath} 的值类型`
          });
        }
      }
    }
    
    if (propSchema.enum && propSchema.enum.length > 0) {
      if (!propSchema.enum.includes(value)) {
        issues.push({
          severity: SEVERITY.HIGH,
          path,
          message: `值 "${value}" 不在允许的枚举值中`,
          reason: `允许的枚举值: [${propSchema.enum.join(', ')}]`,
          migration: `使用允许的枚举值之一`
        });
      }
    }
  }
  
  if (schema.additionalProperties === false) {
    const definedProps = new Set(Object.keys(properties));
    for (const key of objKeys) {
      if (!definedProps.has(key)) {
        const path = basePath ? `${basePath}.${key}` : key;
        issues.push({
          severity: SEVERITY.MEDIUM,
          path,
          message: '是未定义的额外字段',
          reason: 'schema 设置了 additionalProperties: false，不允许额外字段',
          migration: `移除此字段，或更新 schema`
        });
      }
    }
  }
  
  return { issues };
}

function validateValueAgainstSchema(value, schema) {
  if (schema.nullable && value === null) {
    return { valid: true };
  }
  
  const expectedType = schema.type;
  const actualType = getJsonType(value);
  
  if (expectedType === 'integer') {
    if (actualType !== 'number' || !Number.isInteger(value)) {
      return {
        valid: false,
        reason: `期望 integer，但实际是 ${actualType}`,
        migration: '使用整数值'
      };
    }
  } else if (expectedType === 'number') {
    if (actualType !== 'number') {
      return {
        valid: false,
        reason: `期望 number，但实际是 ${actualType}`,
        migration: '使用数字值'
      };
    }
  } else if (expectedType === 'boolean') {
    if (actualType !== 'boolean') {
      return {
        valid: false,
        reason: `期望 boolean，但实际是 ${actualType}`,
        migration: '使用 true 或 false'
      };
    }
  } else if (expectedType === 'string') {
    if (actualType !== 'string') {
      return {
        valid: false,
        reason: `期望 string，但实际是 ${actualType}`,
        migration: '使用字符串值'
      };
    }
    
    if (schema.enum && !schema.enum.includes(value)) {
      return {
        valid: false,
        reason: `值 "${value}" 不在枚举 [${schema.enum.join(', ')}] 中`,
        migration: '使用允许的枚举值'
      };
    }
  } else if (expectedType === 'array') {
    if (actualType !== 'array') {
      return {
        valid: false,
        reason: `期望 array，但实际是 ${actualType}`,
        migration: '使用数组值'
      };
    }
  } else if (expectedType === 'object') {
    if (actualType !== 'object') {
      return {
        valid: false,
        reason: `期望 object，但实际是 ${actualType}`,
        migration: '使用对象值'
      };
    }
  }
  
  return { valid: true };
}

function getJsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function findUnmatchedEndpoints(spec, matchedEndpoints) {
  const unmatched = [];
  
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of Object.keys(pathItem.operations)) {
      const key = `${method}:${path}`;
      if (!matchedEndpoints.has(key)) {
        unmatched.push({ method, path });
      }
    }
  }
  
  return unmatched;
}

function createSampleIssue({ severity, location, message, reason, migration }) {
  return {
    id: `SAMPLE-ISSUE-${String(++sampleIssueCounter).padStart(4, '0')}`,
    category: CATEGORIES.SAMPLE_VALIDATION,
    severity,
    location,
    message,
    reason,
    migration,
    timestamp: new Date().toISOString()
  };
}

function sortSampleIssues(issues) {
  const severityOrder = {
    [SEVERITY.CRITICAL]: 0,
    [SEVERITY.HIGH]: 1,
    [SEVERITY.MEDIUM]: 2,
    [SEVERITY.LOW]: 3,
    [SEVERITY.INFO]: 4
  };
  
  return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

function generateSampleSummary(issues) {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };
  
  for (const issue of issues) {
    counts[issue.severity]++;
  }
  
  return {
    total: issues.length,
    bySeverity: counts,
    hasIssues: issues.length > 0
  };
}
