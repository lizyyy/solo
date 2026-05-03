export const SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

export const CATEGORIES = {
  PATH_REMOVED: 'path_removed',
  METHOD_REMOVED: 'method_removed',
  PARAMETER_MADE_REQUIRED: 'parameter_made_required',
  PARAMETER_TYPE_CHANGED: 'parameter_type_changed',
  PARAMETER_REMOVED: 'parameter_removed',
  REQUEST_BODY_TYPE_CHANGED: 'request_body_type_changed',
  REQUEST_BODY_FIELD_TYPE_CHANGED: 'request_body_field_type_changed',
  REQUEST_BODY_MADE_REQUIRED: 'request_body_made_required',
  REQUEST_BODY_FIELD_MADE_REQUIRED: 'request_body_field_made_required',
  RESPONSE_STATUS_REMOVED: 'response_status_removed',
  RESPONSE_FIELD_TYPE_CHANGED: 'response_field_type_changed',
  RESPONSE_FIELD_REMOVED: 'response_field_removed',
  ENUM_VALUE_REMOVED: 'enum_value_removed',
  ENUM_TYPE_CHANGED: 'enum_type_changed',
  SECURITY_REQUIREMENT_CHANGED: 'security_requirement_changed',
  DEPRECATION_NOTICE: 'deprecation_notice',
  MEDIA_TYPE_REMOVED: 'media_type_removed',
  SCHEMA_ADDITIONAL_PROPERTIES_REMOVED: 'schema_additional_properties_removed',
  SAMPLE_VALIDATION: 'sample_validation'
};

export function checkCompatibility(oldSpec, newSpec) {
  const issues = [];
  
  issues.push(...checkPaths(oldSpec, newSpec));
  issues.push(...checkOperations(oldSpec, newSpec));
  
  return {
    issues: sortIssues(issues),
    summary: generateSummary(issues)
  };
}

function sortIssues(issues) {
  const severityOrder = {
    [SEVERITY.CRITICAL]: 0,
    [SEVERITY.HIGH]: 1,
    [SEVERITY.MEDIUM]: 2,
    [SEVERITY.LOW]: 3,
    [SEVERITY.INFO]: 4
  };
  
  return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

function generateSummary(issues) {
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
  
  const hasBreakingChanges = counts.critical > 0 || counts.high > 0;
  const hasIssues = issues.length > 0;
  
  return {
    total: issues.length,
    bySeverity: counts,
    hasBreakingChanges,
    hasIssues
  };
}

function checkPaths(oldSpec, newSpec) {
  const issues = [];
  const oldPaths = Object.keys(oldSpec.paths);
  const newPaths = Object.keys(newSpec.paths);
  
  for (const path of oldPaths) {
    if (!newPaths.includes(path)) {
      issues.push(createIssue({
        category: CATEGORIES.PATH_REMOVED,
        severity: SEVERITY.CRITICAL,
        location: { path },
        message: `路径 "${path}" 已被移除`,
        reason: '旧客户端调用此路径将收到 404 错误',
        migration: `更新客户端代码，使用替代路径或移除相关调用。检查是否有 ${path} 的重定向或废弃通知。`
      }));
    }
  }
  
  return issues;
}

function checkOperations(oldSpec, newSpec) {
  const issues = [];
  
  for (const [path, oldPathItem] of Object.entries(oldSpec.paths)) {
    const newPathItem = newSpec.paths[path];
    if (!newPathItem) continue;
    
    const oldMethods = Object.keys(oldPathItem.operations);
    const newMethods = Object.keys(newPathItem.operations);
    
    for (const method of oldMethods) {
      if (!newMethods.includes(method)) {
        issues.push(createIssue({
          category: CATEGORIES.METHOD_REMOVED,
          severity: SEVERITY.CRITICAL,
          location: { path, method },
          message: `${method} ${path} 方法已被移除`,
          reason: '旧客户端使用此 HTTP 方法调用该路径将收到 405 Method Not Allowed 错误',
          migration: '更新客户端使用支持的 HTTP 方法，或移除相关调用。'
        }));
        continue;
      }
      
      const oldOp = oldPathItem.operations[method];
      const newOp = newPathItem.operations[method];
      
      issues.push(...checkParameters(oldOp, newOp, { path, method }));
      issues.push(...checkRequestBody(oldOp, newOp, { path, method }));
      issues.push(...checkResponses(oldOp, newOp, { path, method }));
      issues.push(...checkSecurity(oldOp, newOp, { path, method }));
      issues.push(...checkDeprecation(oldOp, newOp, { path, method }));
    }
  }
  
  return issues;
}

function checkParameters(oldOp, newOp, location) {
  const issues = [];
  
  const oldParamMap = new Map();
  for (const param of oldOp.parameters) {
    oldParamMap.set(`${param.in}:${param.name}`, param);
  }
  
  const newParamMap = new Map();
  for (const param of newOp.parameters) {
    newParamMap.set(`${param.in}:${param.name}`, param);
  }
  
  for (const [key, oldParam] of oldParamMap) {
    const newParam = newParamMap.get(key);
    
    if (!newParam) {
      if (oldParam.required) {
        issues.push(createIssue({
          category: CATEGORIES.PARAMETER_REMOVED,
          severity: SEVERITY.MEDIUM,
          location: { ...location, parameter: oldParam.name, in: oldParam.in },
          message: `参数 ${oldParam.name} (in: ${oldParam.in}) 已被移除`,
          reason: '该参数之前是必填的，现在已不存在。旧客户端继续发送可能会被忽略',
          migration: '从客户端代码中移除此参数的发送逻辑。'
        }));
      }
      continue;
    }
    
    if (!oldParam.required && newParam.required) {
      issues.push(createIssue({
        category: CATEGORIES.PARAMETER_MADE_REQUIRED,
        severity: SEVERITY.HIGH,
        location: { ...location, parameter: oldParam.name, in: oldParam.in },
        message: `参数 ${oldParam.name} (in: ${oldParam.in}) 从可选变为必填`,
        reason: '旧客户端可能不发送此参数，将导致 400 Bad Request 错误',
        migration: '更新客户端确保始终发送此参数，或联系服务端恢复为可选状态。'
      }));
    }
    
    if (oldParam.schema && newParam.schema) {
      const typeIssues = checkSchemaTypeChange(
        oldParam.schema,
        newParam.schema,
        { ...location, parameter: oldParam.name, in: oldParam.in },
        '参数'
      );
      issues.push(...typeIssues);
    }
  }
  
  return issues;
}

function checkRequestBody(oldOp, newOp, location) {
  const issues = [];
  const oldBody = oldOp.requestBody;
  const newBody = newOp.requestBody;
  
  if (oldBody && !newBody) {
    if (oldBody.required) {
      issues.push(createIssue({
        category: CATEGORIES.REQUEST_BODY_TYPE_CHANGED,
        severity: SEVERITY.MEDIUM,
        location: { ...location, requestBody: true },
        message: '请求体已被移除',
        reason: '旧客户端可能仍会发送请求体，虽然通常不会报错，但可能表示 API 设计变更',
        migration: '确认是否需要继续发送请求体，或根据新的 API 规范调整客户端。'
      }));
    }
    return issues;
  }
  
  if (!oldBody && newBody) {
    if (newBody.required) {
      issues.push(createIssue({
        category: CATEGORIES.REQUEST_BODY_MADE_REQUIRED,
        severity: SEVERITY.HIGH,
        location: { ...location, requestBody: true },
        message: '新增了必填请求体',
        reason: '旧客户端可能不发送请求体，将导致 400 Bad Request 错误',
        migration: '更新客户端根据新规范发送请求体。'
      }));
    }
    return issues;
  }
  
  if (!oldBody || !newBody) return issues;
  
  if (!oldBody.required && newBody.required) {
    issues.push(createIssue({
      category: CATEGORIES.REQUEST_BODY_MADE_REQUIRED,
      severity: SEVERITY.HIGH,
      location: { ...location, requestBody: true },
      message: '请求体从可选变为必填',
      reason: '旧客户端可能不发送请求体，将导致 400 Bad Request 错误',
      migration: '更新客户端确保始终发送请求体。'
    }));
  }
  
  const oldMediaTypes = Object.keys(oldBody.content || {});
  const newMediaTypes = Object.keys(newBody.content || {});
  
  for (const mediaType of oldMediaTypes) {
    if (!newMediaTypes.includes(mediaType)) {
      issues.push(createIssue({
        category: CATEGORIES.MEDIA_TYPE_REMOVED,
        severity: SEVERITY.HIGH,
        location: { ...location, mediaType, requestBody: true },
        message: `请求体 Media-Type "${mediaType}" 不再支持`,
        reason: '旧客户端使用此 Media-Type 发送请求将可能收到 415 Unsupported Media Type 错误',
        migration: `更新客户端使用支持的 Media-Type: ${newMediaTypes.join(', ')}`
      }));
      continue;
    }
    
    const oldContent = oldBody.content[mediaType];
    const newContent = newBody.content[mediaType];
    
    if (oldContent.schema && newContent.schema) {
      const fieldIssues = checkObjectSchemaFields(
        oldContent.schema,
        newContent.schema,
        { ...location, mediaType, requestBody: true },
        '请求体'
      );
      issues.push(...fieldIssues);
    }
  }
  
  return issues;
}

function checkResponses(oldOp, newOp, location) {
  const issues = [];
  
  const oldResponses = Object.keys(oldOp.responses || {});
  const newResponses = Object.keys(newOp.responses || {});
  
  for (const statusCode of oldResponses) {
    if (statusCode === 'default') continue;
    
    if (!newResponses.includes(statusCode) && !newResponses.includes('default')) {
      issues.push(createIssue({
        category: CATEGORIES.RESPONSE_STATUS_REMOVED,
        severity: SEVERITY.HIGH,
        location: { ...location, statusCode },
        message: `响应状态码 ${statusCode} 已被移除`,
        reason: '旧客户端可能期望此状态码的响应，服务端不再返回时可能导致错误处理逻辑失效',
        migration: '更新客户端的错误处理逻辑，确认新的状态码范围。'
      }));
      continue;
    }
    
    const oldResponse = oldOp.responses[statusCode];
    const newResponse = newOp.responses[statusCode] || newOp.responses['default'];
    
    if (!newResponse) continue;
    
    const oldMediaTypes = Object.keys(oldResponse.content || {});
    const newMediaTypes = Object.keys(newResponse.content || {});
    
    for (const mediaType of oldMediaTypes) {
      if (!newMediaTypes.includes(mediaType)) continue;
      
      const oldContent = oldResponse.content[mediaType];
      const newContent = newResponse.content[mediaType];
      
      if (oldContent.schema && newContent.schema) {
        const fieldIssues = checkResponseSchemaFields(
          oldContent.schema,
          newContent.schema,
          { ...location, statusCode, mediaType },
          `响应 ${statusCode}`
        );
        issues.push(...fieldIssues);
      }
    }
  }
  
  return issues;
}

function checkSchemaTypeChange(oldSchema, newSchema, location, contextName) {
  const issues = [];
  
  if (!oldSchema.type || !newSchema.type) return issues;
  
  const oldType = Array.isArray(oldSchema.type) ? oldSchema.type[0] : oldSchema.type;
  const newType = Array.isArray(newSchema.type) ? newSchema.type[0] : newSchema.type;
  
  if (oldType !== newType) {
    const compatible = isTypeCompatible(oldType, newType);
    
    issues.push(createIssue({
      category: CATEGORIES.PARAMETER_TYPE_CHANGED,
      severity: compatible ? SEVERITY.MEDIUM : SEVERITY.HIGH,
      location,
      message: `${contextName}类型从 "${oldType}" 变为 "${newType}"`,
      reason: compatible 
        ? '类型改变但可能兼容，客户端需要适配新的类型格式'
        : '类型不兼容将导致反序列化错误或运行时异常',
      migration: `更新客户端代码以正确处理新的 "${newType}" 类型。`
    }));
  }
  
  if (oldSchema.enum && newSchema.enum) {
    const oldValues = new Set(oldSchema.enum);
    const newValues = new Set(newSchema.enum);
    
    const removedValues = [...oldValues].filter(v => !newValues.has(v));
    if (removedValues.length > 0) {
      issues.push(createIssue({
        category: CATEGORIES.ENUM_VALUE_REMOVED,
        severity: SEVERITY.HIGH,
        location,
        message: `枚举值减少: [${removedValues.join(', ')}] 已被移除`,
        reason: '旧客户端可能发送已移除的枚举值，将导致验证失败',
        migration: '更新客户端仅发送新枚举中存在的值，或联系服务端恢复被移除的值。'
      }));
    }
  }
  
  return issues;
}

function checkObjectSchemaFields(oldSchema, newSchema, location, contextName) {
  const issues = [];
  
  if (!oldSchema.properties || !newSchema.properties) return issues;
  
  const oldProps = oldSchema.properties;
  const newProps = newSchema.properties;
  const oldRequired = new Set(oldSchema.required || []);
  const newRequired = new Set(newSchema.required || []);
  
  for (const [propName, oldPropSchema] of Object.entries(oldProps)) {
    const newPropSchema = newProps[propName];
    
    if (!newPropSchema) {
      if (oldRequired.has(propName)) {
        issues.push(createIssue({
          category: CATEGORIES.REQUEST_BODY_FIELD_TYPE_CHANGED,
          severity: SEVERITY.MEDIUM,
          location: { ...location, field: propName },
          message: `${contextName}字段 "${propName}" 已被移除`,
          reason: '旧客户端可能仍发送此字段，虽然不会报错，但建议同步更新',
          migration: '从客户端请求中移除此字段，或确认服务端是否仍接受它。'
        }));
      }
      continue;
    }
    
    if (!oldRequired.has(propName) && newRequired.has(propName)) {
      issues.push(createIssue({
        category: CATEGORIES.REQUEST_BODY_FIELD_MADE_REQUIRED,
        severity: SEVERITY.HIGH,
        location: { ...location, field: propName },
        message: `${contextName}字段 "${propName}" 从可选变为必填`,
        reason: '旧客户端可能不发送此字段，将导致 400 Bad Request 错误',
        migration: '更新客户端确保请求中始终包含此字段。'
      }));
    }
    
    const typeIssues = checkSchemaTypeChange(
      oldPropSchema,
      newPropSchema,
      { ...location, field: propName },
      `${contextName}字段 "${propName}"`
    );
    issues.push(...typeIssues);
    
    if (oldPropSchema.properties && newPropSchema.properties) {
      const nestedIssues = checkObjectSchemaFields(
        oldPropSchema,
        newPropSchema,
        { ...location, field: `${propName}.` },
        `${contextName}字段 "${propName}"`
      );
      issues.push(...nestedIssues);
    }
  }
  
  if (oldSchema.additionalProperties !== false && newSchema.additionalProperties === false) {
    issues.push(createIssue({
      category: CATEGORIES.SCHEMA_ADDITIONAL_PROPERTIES_REMOVED,
      severity: SEVERITY.MEDIUM,
      location,
      message: `${contextName}不再允许额外字段 (additionalProperties: false)`,
      reason: '旧客户端可能发送规范中未定义的额外字段，将导致 400 Bad Request 错误',
      migration: '检查客户端请求，确保只发送规范中定义的字段。'
    }));
  }
  
  return issues;
}

function checkResponseSchemaFields(oldSchema, newSchema, location, contextName) {
  const issues = [];
  
  if (!oldSchema.properties || !newSchema.properties) return issues;
  
  const oldProps = oldSchema.properties;
  const newProps = newSchema.properties;
  
  for (const [propName, oldPropSchema] of Object.entries(oldProps)) {
    const newPropSchema = newProps[propName];
    
    if (!newPropSchema) {
      issues.push(createIssue({
        category: CATEGORIES.RESPONSE_FIELD_REMOVED,
        severity: SEVERITY.HIGH,
        location: { ...location, field: propName },
        message: `${contextName}字段 "${propName}" 已被移除`,
        reason: '旧客户端可能依赖此字段，缺失将导致运行时错误或数据丢失',
        migration: '更新客户端代码，处理此字段可能不存在的情况，或寻找替代字段。'
      }));
      continue;
    }
    
    const typeIssues = checkSchemaTypeChange(
      oldPropSchema,
      newPropSchema,
      { ...location, field: propName },
      `${contextName}字段 "${propName}"`
    );
    issues.push(...typeIssues);
    
    if (oldPropSchema.properties && newPropSchema.properties) {
      const nestedIssues = checkResponseSchemaFields(
        oldPropSchema,
        newPropSchema,
        { ...location, field: `${propName}.` },
        `${contextName}字段 "${propName}"`
      );
      issues.push(...nestedIssues);
    }
  }
  
  return issues;
}

function checkSecurity(oldOp, newOp, location) {
  const issues = [];
  
  const oldSecurity = oldOp.security;
  const newSecurity = newOp.security;
  
  if (!oldSecurity && newSecurity && newSecurity.length > 0) {
    issues.push(createIssue({
      category: CATEGORIES.SECURITY_REQUIREMENT_CHANGED,
      severity: SEVERITY.HIGH,
      location,
      message: '新增了安全认证要求',
      reason: '旧客户端可能不包含认证信息，将导致 401 Unauthorized 错误',
      migration: '更新客户端添加所需的认证信息 (JWT, API Key 等)。'
    }));
  }
  
  return issues;
}

function checkDeprecation(oldOp, newOp, location) {
  const issues = [];
  
  if (!oldOp.deprecated && newOp.deprecated) {
    issues.push(createIssue({
      category: CATEGORIES.DEPRECATION_NOTICE,
      severity: SEVERITY.INFO,
      location,
      message: '此接口已被标记为弃用',
      reason: '虽然当前仍可使用，但未来版本可能会移除',
      migration: '计划迁移到新的替代接口，或联系服务端了解弃用时间表。'
    }));
  }
  
  return issues;
}

function isTypeCompatible(oldType, newType) {
  const compatiblePairs = [
    ['integer', 'number'],
    ['int32', 'number'],
    ['int64', 'number'],
    ['float', 'number'],
    ['double', 'number']
  ];
  
  return compatiblePairs.some(([from, to]) => 
    (oldType === from && newType === to)
  );
}

function createIssue({ category, severity, location, message, reason, migration }) {
  return {
    id: generateIssueId(),
    category,
    severity,
    location,
    message,
    reason,
    migration,
    timestamp: new Date().toISOString()
  };
}

let issueCounter = 0;
function generateIssueId() {
  return `ISSUE-${String(++issueCounter).padStart(4, '0')}`;
}
