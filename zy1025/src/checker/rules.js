import { ISSUE_TYPES, SECRET_PATTERNS } from '../utils/constants.js';

export function checkIssues(scanResult, config) {
  const issues = [];
  const variables = scanResult.variables;
  const allVarNames = Object.keys(variables.all);

  for (const varName of allVarNames) {
    if (config.optionalVars.includes(varName)) {
      continue;
    }

    const varInfo = variables.all[varName];

    if (checkMissingInExample(varName, variables, config)) {
      issues.push({
      type: ISSUE_TYPES.MISSING_IN_EXAMPLE,
      variable: varName,
      severity: 'high',
      message: `变量 ${varName} 在代码/脚本中使用，但 .env.example 中缺失`,
      details: {
        foundIn: varInfo.foundIn,
        sources: varInfo.sources,
      },
    });
  }

    if (checkExtraInLocal(varName, variables, config)) {
      issues.push({
        type: ISSUE_TYPES.EXTRA_IN_LOCAL,
        variable: varName,
        severity: 'medium',
        message: `变量 ${varName} 在 .env.local 中存在，但 .env.example 中未声明`,
        details: {
          localValue: variables.fromLocal[varName]?.value,
        },
      });
    }

    const conflictIssue = checkValueConflict(varName, varInfo);
    if (conflictIssue) {
      issues.push({
        type: ISSUE_TYPES.VALUE_CONFLICT,
        variable: varName,
        severity: 'medium',
        message: `变量 ${varName} 在不同文件中的默认值不一致`,
        details: {
          values: conflictIssue.values,
        },
      });
    }

    if (checkPotentialSecret(varName, varInfo)) {
      issues.push({
        type: ISSUE_TYPES.POTENTIAL_SECRET,
        variable: varName,
        severity: 'low',
        message: `变量 ${varName} 看起来可能包含敏感信息`,
        details: {
          sources: varInfo.sources,
        },
      });
    }
  }

  return issues;
}

function checkMissingInExample(varName, variables, config) {
  const inExample = variables.fromExample[varName];
  const inCodeOrScript = 
    variables.fromDocker[varName] || 
    variables.fromPackageJson[varName] || 
    variables.fromMarkdown[varName];
  
  const inOtherEnvFiles = Object.entries(variables.all[varName]?.foundIn || [])
    .some(source => source === 'env_file' && !variables.fromExample[varName]);

  const hasRealValue = variables.all[varName]?.values?.some(v => v.value !== undefined);

  return !inExample && (inCodeOrScript || (inOtherEnvFiles && hasRealValue));
}

function checkExtraInLocal(varName, variables, config) {
  const inLocal = variables.fromLocal[varName];
  const inExample = variables.fromExample[varName];
  const isLocalOnly = config.localOnlyVars.includes(varName);

  return inLocal && !inExample && !isLocalOnly;
}

function checkValueConflict(varName, varInfo) {
  const values = varInfo.values || [];
  
  if (values.length <= 1) {
    return null;
  }

  const nonUndefinedValues = values.filter(v => v.value !== undefined && v.value !== '');
  
  if (nonUndefinedValues.length <= 1) {
    return null;
  }

  const firstValue = nonUndefinedValues[0].value;
  const hasConflict = nonUndefinedValues.some(v => v.value !== firstValue);

  if (hasConflict) {
    return {
      values: nonUndefinedValues.map(v => ({
        value: v.value,
        source: v.source,
        filePath: v.filePath,
      })),
    };
  }

  return null;
}

function checkPotentialSecret(varName, varInfo) {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(varName)) {
      return true;
    }
  }
  
  for (const valueInfo of varInfo.values || []) {
    if (valueInfo.value && looksLikeSecretValue(valueInfo.value)) {
      return true;
    }
  }

  return false;
}

function looksLikeSecretValue(value) {
  if (typeof value !== 'string') return false;
  
  if (value.length >= 20 && /[a-zA-Z0-9+\/=]/.test(value)) {
    return true;
  }
  
  if (/^sk_[a-zA-Z0-9]{20,}/.test(value)) {
    return true;
  }
  
  if (/^[a-f0-9]{32}$/i.test(value) || /^[a-f0-9]{40}$/i.test(value)) {
    return true;
  }

  return false;
}

export function redactSecrets(scanResult, issues) {
  const redactedResult = JSON.parse(JSON.stringify(scanResult));
  
  for (const varName of Object.keys(redactedResult.variables.all)) {
    const varInfo = redactedResult.variables.all[varName];
    
    if (isSecretVariable(varName)) {
      varInfo.values = varInfo.values?.map(v => ({
        ...v,
        value: v.value ? '[REDACTED]' : v.value,
      }));
    }
  }
  
  const allEnvFiles = ['fromExample', 'fromLocal', 'fromDocker'];
  for (const key of allEnvFiles) {
    for (const varName of Object.keys(redactedResult.variables[key])) {
      if (isSecretVariable(varName)) {
        redactedResult.variables[key][varName].value = 
          redactedResult.variables[key][varName].value ? '[REDACTED]' : 
          redactedResult.variables[key][varName].value;
      }
    }
  }
  
  const redactedIssues = issues.map(issue => {
    if (issue.type === ISSUE_TYPES.POTENTIAL_SECRET || 
        isSecretVariable(issue.variable)) {
      const redacted = { ...issue };
      if (redacted.details?.localValue) {
        redacted.details.localValue = '[REDACTED]';
      }
      if (redacted.details?.values) {
        redacted.details.values = redacted.details.values.map(v => ({
          ...v,
          value: v.value ? '[REDACTED]' : v.value,
        }));
      }
      return redacted;
    }
    return issue;
  });

  return { scanResult: redactedResult, issues: redactedIssues };
}

function isSecretVariable(varName) {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(varName)) {
      return true;
    }
  }
  return false;
}
