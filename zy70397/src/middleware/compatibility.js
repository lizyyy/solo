const config = require('../config/compatibility');

function compareVersions(v1, v2) {
  const v1Parts = v1.split('.').map(Number);
  const v2Parts = v2.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    const part1 = v1Parts[i] || 0;
    const part2 = v2Parts[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

function processFieldMappings(body) {
  const adaptedBody = { ...body };
  const matchedRules = [];
  const warnings = [];
  const errors = [];
  const usedMappings = new Set();
  
  config.fieldMappings.forEach(mapping => {
    if (adaptedBody.hasOwnProperty(mapping.oldField)) {
      usedMappings.add(mapping.oldField);
      
      if (adaptedBody.hasOwnProperty(mapping.newField)) {
        errors.push({
          type: 'fieldConflict',
          oldField: mapping.oldField,
          newField: mapping.newField,
          message: `新旧字段冲突：同时存在旧字段 '${mapping.oldField}' 和新字段 '${mapping.newField}'`,
          suggestion: `请只使用新字段 '${mapping.newField}'，旧字段 '${mapping.oldField}' 已被弃用`
        });
      } else {
        adaptedBody[mapping.newField] = adaptedBody[mapping.oldField];
        delete adaptedBody[mapping.oldField];
        
        matchedRules.push({
          type: 'fieldMapping',
          oldField: mapping.oldField,
          newField: mapping.newField,
          description: mapping.description
        });
        
        warnings.push({
          type: 'deprecatedFieldUsage',
          field: mapping.oldField,
          message: `使用了即将弃用的旧字段 '${mapping.oldField}'，建议迁移到新字段 '${mapping.newField}'`
        });
      }
    }
  });
  
  return { adaptedBody, matchedRules, warnings, errors };
}

function processDeprecatedFields(body, clientVersion) {
  const warnings = [];
  const matchedRules = [];
  
  config.deprecatedFields.forEach(deprecated => {
    if (body.hasOwnProperty(deprecated.field)) {
      matchedRules.push({
        type: 'deprecatedField',
        field: deprecated.field,
        willBeRemoved: deprecated.willBeRemoved
      });
      
      warnings.push({
        type: 'deprecatedField',
        field: deprecated.field,
        message: `字段 '${deprecated.field}' 即将在版本 ${deprecated.willBeRemoved} 下线`,
        suggestion: deprecated.suggestion,
        willBeRemoved: deprecated.willBeRemoved
      });
    }
  });
  
  return { warnings, matchedRules };
}

function processNewFieldsWithDefaults(body) {
  const adaptedBody = { ...body };
  const matchedRules = [];
  
  config.newFieldsWithDefaults.forEach(fieldConfig => {
    if (!adaptedBody.hasOwnProperty(fieldConfig.field)) {
      adaptedBody[fieldConfig.field] = fieldConfig.defaultValue;
      
      matchedRules.push({
        type: 'defaultValueApplied',
        field: fieldConfig.field,
        defaultValue: fieldConfig.defaultValue,
        description: fieldConfig.description
      });
    }
  });
  
  return { adaptedBody, matchedRules };
}

function processGrayFields(body, clientVersion) {
  const adaptedBody = { ...body };
  const warnings = [];
  const errors = [];
  const matchedRules = [];
  
  config.grayFields.forEach(grayField => {
    if (adaptedBody.hasOwnProperty(grayField.field)) {
      if (compareVersions(clientVersion, grayField.minimumVersion) < 0) {
        errors.push({
          type: 'grayFieldVersionMismatch',
          field: grayField.field,
          minimumVersion: grayField.minimumVersion,
          message: `灰度字段 '${grayField.field}' 仅在版本 ${grayField.minimumVersion} 及以上可用，当前版本 ${clientVersion}`,
          suggestion: `请升级客户端到 ${grayField.minimumVersion} 或以上版本才能使用此字段`
        });
        delete adaptedBody[grayField.field];
      } else {
        matchedRules.push({
          type: 'grayField',
          field: grayField.field,
          minimumVersion: grayField.minimumVersion
        });
      }
    }
  });
  
  return { adaptedBody, warnings, errors, matchedRules };
}

function checkVersionDeprecation(clientVersion) {
  const warnings = [];
  
  if (config.versions.deprecated.includes(clientVersion)) {
    warnings.push({
      type: 'versionDeprecation',
      clientVersion,
      message: config.versions.deprecationWarning,
      currentVersion: config.versions.current
    });
  }
  
  return warnings;
}

function adaptRequest(body, clientVersion, endpoint) {
  const result = {
    originalBody: JSON.parse(JSON.stringify(body)),
    adaptedBody: JSON.parse(JSON.stringify(body)),
    clientVersion,
    endpoint,
    matchedRules: [],
    warnings: [],
    errors: [],
    riskLevel: 'normal'
  };
  
  const versionWarnings = checkVersionDeprecation(clientVersion);
  result.warnings.push(...versionWarnings);
  
  const mappingResult = processFieldMappings(result.adaptedBody);
  result.adaptedBody = mappingResult.adaptedBody;
  result.matchedRules.push(...mappingResult.matchedRules);
  result.warnings.push(...mappingResult.warnings);
  result.errors.push(...mappingResult.errors);
  
  const deprecatedResult = processDeprecatedFields(result.adaptedBody, clientVersion);
  result.matchedRules.push(...deprecatedResult.matchedRules);
  result.warnings.push(...deprecatedResult.warnings);
  
  const grayResult = processGrayFields(result.adaptedBody, clientVersion);
  result.adaptedBody = grayResult.adaptedBody;
  result.warnings.push(...grayResult.warnings);
  result.errors.push(...grayResult.errors);
  result.matchedRules.push(...grayResult.matchedRules);
  
  const defaultsResult = processNewFieldsWithDefaults(result.adaptedBody);
  result.adaptedBody = defaultsResult.adaptedBody;
  result.matchedRules.push(...defaultsResult.matchedRules);
  
  if (result.errors.length > 0) {
    result.riskLevel = 'error';
  } else if (result.warnings.length > 0) {
    result.riskLevel = 'warning';
  }
  
  return result;
}

module.exports = {
  adaptRequest,
  compareVersions,
  config
};
