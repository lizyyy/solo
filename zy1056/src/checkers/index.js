'use strict';

const { shouldIgnoreKey, shouldIgnoreLanguage, shouldIgnoreRule } = require('../config');

const SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

const RULES = {
  MISSING_KEY: 'missing-key',
  EXTRA_KEY: 'extra-key',
  EMPTY_VALUE: 'empty-value',
  PLACEHOLDER_MISMATCH: 'placeholder-mismatch',
  ICU_PLURAL_MISSING: 'icu-plural-missing',
  ICU_PLURAL_EXTRA: 'icu-plural-extra',
  VARIABLE_NAME_MISMATCH: 'variable-name-mismatch',
  LENGTH_RISK: 'length-risk',
  FILE_PARSE_ERROR: 'file-parse-error'
};

function extractPlaceholders(text) {
  const placeholders = {
    simple: new Set(),
    percent: new Set(),
    icu: new Set()
  };
  
  if (!text || typeof text !== 'string') {
    return placeholders;
  }
  
  const simplePattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  let match;
  while ((match = simplePattern.exec(text)) !== null) {
    placeholders.simple.add(match[1]);
  }
  
  const percentPattern = /%\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  while ((match = percentPattern.exec(text)) !== null) {
    placeholders.percent.add(match[1]);
  }
  
  const icuPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*),\s*plural/g;
  while ((match = icuPattern.exec(text)) !== null) {
    placeholders.icu.add(match[1]);
  }
  
  return placeholders;
}

function extractICUPluralForms(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  
  const pluralStart = text.indexOf(', plural,');
  if (pluralStart === -1) {
    return null;
  }
  
  const variableMatch = text.match(/\{([a-zA-Z_][a-zA-Z0-9_]*),\s*plural/);
  if (!variableMatch) {
    return null;
  }
  const variable = variableMatch[1];
  
  const contentStart = text.indexOf('{', pluralStart);
  if (contentStart === -1) {
    return null;
  }
  
  let braceCount = 0;
  let contentEnd = -1;
  
  for (let i = contentStart; i < text.length; i++) {
    if (text[i] === '{') {
      braceCount++;
    } else if (text[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        contentEnd = i;
        break;
      }
    }
  }
  
  if (contentEnd === -1) {
    return null;
  }
  
  const content = text.substring(contentStart + 1, contentEnd);
  const forms = new Set();
  
  const formPattern = /(zero|one|two|few|many|other|=\d+)/g;
  let formMatch;
  while ((formMatch = formPattern.exec(content)) !== null) {
    forms.add(formMatch[0]);
  }
  
  return { variable, forms: Array.from(forms) };
}

function checkMissingKeys(baseData, targetData, baseLang, targetLang, config) {
  const issues = [];
  const ignored = [];
  
  for (const key of Object.keys(baseData)) {
    if (!(key in targetData)) {
      const ignorePattern = shouldIgnoreKey(key, config.ignore);
      if (ignorePattern) {
        ignored.push({
          key,
          language: targetLang,
          rule: RULES.MISSING_KEY,
          ignorePattern,
          baseValue: baseData[key]
        });
      } else {
        issues.push({
          rule: RULES.MISSING_KEY,
          severity: SEVERITY.ERROR,
          key,
          baseLanguage: baseLang,
          targetLanguage: targetLang,
          baseValue: baseData[key],
          message: `在 ${targetLang} 中缺少 key: ${key}`
        });
      }
    }
  }
  
  return { issues, ignored };
}

function checkExtraKeys(baseData, targetData, baseLang, targetLang, config) {
  const issues = [];
  const ignored = [];
  
  for (const key of Object.keys(targetData)) {
    if (!(key in baseData)) {
      const ignorePattern = shouldIgnoreKey(key, config.ignore);
      if (ignorePattern) {
        ignored.push({
          key,
          language: targetLang,
          rule: RULES.EXTRA_KEY,
          ignorePattern,
          targetValue: targetData[key]
        });
      } else {
        issues.push({
          rule: RULES.EXTRA_KEY,
          severity: SEVERITY.WARNING,
          key,
          baseLanguage: baseLang,
          targetLanguage: targetLang,
          targetValue: targetData[key],
          message: `在 ${targetLang} 中有多余的 key: ${key}`
        });
      }
    }
  }
  
  return { issues, ignored };
}

function checkEmptyValues(data, lang, config) {
  const issues = [];
  const ignored = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || 
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)) {
      const ignorePattern = shouldIgnoreKey(key, config.ignore);
      if (ignorePattern) {
        ignored.push({
          key,
          language: lang,
          rule: RULES.EMPTY_VALUE,
          ignorePattern
        });
      } else {
        issues.push({
          rule: RULES.EMPTY_VALUE,
          severity: SEVERITY.WARNING,
          key,
          language: lang,
          message: `key ${key} 的值为空`
        });
      }
    }
  }
  
  return { issues, ignored };
}

function checkPlaceholders(baseData, targetData, baseLang, targetLang, config) {
  const issues = [];
  const ignored = [];
  
  for (const [key, baseValue] of Object.entries(baseData)) {
    if (!(key in targetData)) continue;
    
    const targetValue = targetData[key];
    
    if (typeof baseValue !== 'string' || typeof targetValue !== 'string') continue;
    
    const basePlaceholders = extractPlaceholders(baseValue);
    const targetPlaceholders = extractPlaceholders(targetValue);
    
    const allBase = new Set([
      ...basePlaceholders.simple,
      ...basePlaceholders.percent,
      ...basePlaceholders.icu
    ]);
    const allTarget = new Set([
      ...targetPlaceholders.simple,
      ...targetPlaceholders.percent,
      ...targetPlaceholders.icu
    ]);
    
    const missing = [...allBase].filter(p => !allTarget.has(p));
    const extra = [...allTarget].filter(p => !allBase.has(p));
    
    if (missing.length > 0 || extra.length > 0) {
      const ignorePattern = shouldIgnoreKey(key, config.ignore);
      if (ignorePattern) {
        ignored.push({
          key,
          language: targetLang,
          rule: RULES.PLACEHOLDER_MISMATCH,
          ignorePattern,
          baseValue,
          targetValue,
          missing,
          extra
        });
      } else {
        let message = `${targetLang} 中 key ${key} 的占位符不一致。`;
        if (missing.length > 0) message += ` 缺少: ${missing.join(', ')}`;
        if (extra.length > 0) message += ` 多余: ${extra.join(', ')}`;
        
        issues.push({
          rule: RULES.PLACEHOLDER_MISMATCH,
          severity: SEVERITY.ERROR,
          key,
          baseLanguage: baseLang,
          targetLanguage: targetLang,
          baseValue,
          targetValue,
          missingPlaceholders: missing,
          extraPlaceholders: extra,
          message
        });
      }
    }
  }
  
  return { issues, ignored };
}

function checkICUPlurals(baseData, targetData, baseLang, targetLang, config) {
  const issues = [];
  const ignored = [];
  
  for (const [key, baseValue] of Object.entries(baseData)) {
    if (!(key in targetData)) continue;
    
    const targetValue = targetData[key];
    
    if (typeof baseValue !== 'string' || typeof targetValue !== 'string') continue;
    
    const baseICU = extractICUPluralForms(baseValue);
    const targetICU = extractICUPluralForms(targetValue);
    
    if (baseICU && targetICU) {
      const baseForms = new Set(baseICU.forms);
      const targetForms = new Set(targetICU.forms);
      
      const missing = baseICU.forms.filter(f => !targetForms.has(f));
      const extra = targetICU.forms.filter(f => !baseForms.has(f));
      
      if (missing.length > 0 || extra.length > 0) {
        const ignorePattern = shouldIgnoreKey(key, config.ignore);
        if (ignorePattern) {
          ignored.push({
            key,
            language: targetLang,
            rule: missing.length > 0 ? RULES.ICU_PLURAL_MISSING : RULES.ICU_PLURAL_EXTRA,
            ignorePattern,
            baseValue,
            targetValue,
            missing,
            extra
          });
        } else {
          if (missing.length > 0) {
            issues.push({
              rule: RULES.ICU_PLURAL_MISSING,
              severity: SEVERITY.ERROR,
              key,
              baseLanguage: baseLang,
              targetLanguage: targetLang,
              baseValue,
              targetValue,
              missingForms: missing,
              message: `${targetLang} 中 key ${key} 的 ICU plural 缺少分支: ${missing.join(', ')}`
            });
          }
          if (extra.length > 0) {
            issues.push({
              rule: RULES.ICU_PLURAL_EXTRA,
              severity: SEVERITY.WARNING,
              key,
              baseLanguage: baseLang,
              targetLanguage: targetLang,
              baseValue,
              targetValue,
              extraForms: extra,
              message: `${targetLang} 中 key ${key} 的 ICU plural 有多余分支: ${extra.join(', ')}`
            });
          }
        }
      }
    } else if (baseICU && !targetICU) {
      const ignorePattern = shouldIgnoreKey(key, config.ignore);
      if (ignorePattern) {
        ignored.push({
          key,
          language: targetLang,
          rule: RULES.ICU_PLURAL_MISSING,
          ignorePattern,
          baseValue,
          targetValue
        });
      } else {
        issues.push({
          rule: RULES.ICU_PLURAL_MISSING,
          severity: SEVERITY.ERROR,
          key,
          baseLanguage: baseLang,
          targetLanguage: targetLang,
          baseValue,
          targetValue,
          message: `${targetLang} 中 key ${key} 缺少 ICU plural 结构`
        });
      }
    }
  }
  
  return { issues, ignored };
}

function checkVariableNames(baseData, targetData, baseLang, targetLang, config) {
  const issues = [];
  const ignored = [];
  
  for (const [key, baseValue] of Object.entries(baseData)) {
    if (!(key in targetData)) continue;
    
    const targetValue = targetData[key];
    
    if (typeof baseValue !== 'string' || typeof targetValue !== 'string') continue;
    
    const baseVars = extractVariableNames(baseValue);
    const targetVars = extractVariableNames(targetValue);
    
    const baseNames = new Set(baseVars.map(v => v.name));
    const targetNames = new Set(targetVars.map(v => v.name));
    
    const missing = [...baseNames].filter(n => !targetNames.has(n));
    const extra = [...targetNames].filter(n => !baseNames.has(n));
    
    if (missing.length > 0 || extra.length > 0) {
      const ignorePattern = shouldIgnoreKey(key, config.ignore);
      if (ignorePattern) {
        ignored.push({
          key,
          language: targetLang,
          rule: RULES.VARIABLE_NAME_MISMATCH,
          ignorePattern,
          baseValue,
          targetValue,
          missing,
          extra
        });
      } else {
        issues.push({
          rule: RULES.VARIABLE_NAME_MISMATCH,
          severity: SEVERITY.WARNING,
          key,
          baseLanguage: baseLang,
          targetLanguage: targetLang,
          baseValue,
          targetValue,
          missingVariables: missing,
          extraVariables: extra,
          message: `${targetLang} 中 key ${key} 的变量名不一致。缺少: ${missing.join(', ') || '无'}，多余: ${extra.join(', ') || '无'}`
        });
      }
    }
  }
  
  return { issues, ignored };
}

function extractVariableNames(text) {
  const vars = [];
  
  if (!text || typeof text !== 'string') return vars;
  
  const patterns = [
    /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    /%\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g
  ];
  
  for (const pattern of patterns) {
    let match;
    const textCopy = text;
    while ((match = pattern.exec(textCopy)) !== null) {
      vars.push({ name: match[1], type: pattern.source });
    }
  }
  
  return vars;
}

function checkLengthRisk(baseData, targetData, baseLang, targetLang, config) {
  const issues = [];
  const ignored = [];
  
  const lengthConfig = config.lengthRisk || { threshold: 1.5, minBaseLength: 5 };
  const threshold = lengthConfig.threshold || 1.5;
  const minBaseLength = lengthConfig.minBaseLength || 5;
  
  for (const [key, baseValue] of Object.entries(baseData)) {
    if (!(key in targetData)) continue;
    
    const targetValue = targetData[key];
    
    if (typeof baseValue !== 'string' || typeof targetValue !== 'string') continue;
    if (baseValue.length < minBaseLength) continue;
    
    if (lengthConfig.ignoreKeys && lengthConfig.ignoreKeys.some(pattern => {
      if (typeof pattern === 'string') {
        return pattern === key || matchWildcard(pattern, key);
      }
      return false;
    })) {
      continue;
    }
    
    const baseLength = baseValue.length;
    const targetLength = targetValue.length;
    const ratio = targetLength / baseLength;
    
    if (ratio > threshold) {
      const ignorePattern = shouldIgnoreKey(key, config.ignore);
      if (ignorePattern) {
        ignored.push({
          key,
          language: targetLang,
          rule: RULES.LENGTH_RISK,
          ignorePattern,
          baseValue,
          targetValue,
          baseLength,
          targetLength,
          ratio
        });
      } else {
        issues.push({
          rule: RULES.LENGTH_RISK,
          severity: SEVERITY.WARNING,
          key,
          baseLanguage: baseLang,
          targetLanguage: targetLang,
          baseValue,
          targetValue,
          baseLength,
          targetLength,
          ratio: ratio.toFixed(2),
          threshold,
          message: `${targetLang} 中 key ${key} 的翻译长度可能过长。基准: ${baseLength} 字符, 翻译: ${targetLength} 字符, 比例: ${ratio.toFixed(2)}x (阈值: ${threshold}x)`
        });
      }
    }
  }
  
  return { issues, ignored };
}

function matchWildcard(pattern, str) {
  if (!pattern.includes('*') && !pattern.includes('?')) {
    return pattern === str;
  }
  
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  return new RegExp(`^${regexPattern}$`).test(str);
}

function runAllChecks(languages, config) {
  const allIssues = [];
  const allIgnored = [];
  const statistics = {
    total: 0,
    bySeverity: {
      error: 0,
      warning: 0,
      info: 0
    },
    byRule: {},
    byLanguage: {}
  };
  
  const baseLang = config.baseLang;
  
  if (baseLang in languages) {
    const baseLangData = languages[baseLang];
    
    if (baseLangData.errors && baseLangData.errors.length > 0) {
      for (const error of baseLangData.errors) {
        allIssues.push({
          rule: RULES.FILE_PARSE_ERROR,
          severity: SEVERITY.ERROR,
          language: baseLang,
          message: error
        });
      }
    }
    
    for (const [lang, langData] of Object.entries(languages)) {
      if (lang === baseLang) continue;
      if (shouldIgnoreLanguage(lang, config.ignore)) continue;
      
      if (langData.errors && langData.errors.length > 0) {
        for (const error of langData.errors) {
          allIssues.push({
            rule: RULES.FILE_PARSE_ERROR,
            severity: SEVERITY.ERROR,
            language: lang,
            message: error
          });
        }
      }
      
      const baseData = baseLangData.data;
      const targetData = langData.data;
      
      if (config.checks.missingKeys) {
        const result = checkMissingKeys(baseData, targetData, baseLang, lang, config);
        allIssues.push(...result.issues);
        allIgnored.push(...result.ignored);
      }
      
      if (config.checks.extraKeys) {
        const result = checkExtraKeys(baseData, targetData, baseLang, lang, config);
        allIssues.push(...result.issues);
        allIgnored.push(...result.ignored);
      }
      
      if (config.checks.emptyValues) {
        const result = checkEmptyValues(targetData, lang, config);
        allIssues.push(...result.issues);
        allIgnored.push(...result.ignored);
      }
      
      if (config.checks.placeholders) {
        const result = checkPlaceholders(baseData, targetData, baseLang, lang, config);
        allIssues.push(...result.issues);
        allIgnored.push(...result.ignored);
      }
      
      if (config.checks.icuPlurals) {
        const result = checkICUPlurals(baseData, targetData, baseLang, lang, config);
        allIssues.push(...result.issues);
        allIgnored.push(...result.ignored);
      }
      
      if (config.checks.variableNames) {
        const result = checkVariableNames(baseData, targetData, baseLang, lang, config);
        allIssues.push(...result.issues);
        allIgnored.push(...result.ignored);
      }
      
      if (config.checks.lengthRisk) {
        const result = checkLengthRisk(baseData, targetData, baseLang, lang, config);
        allIssues.push(...result.issues);
        allIgnored.push(...result.ignored);
      }
    }
  } else {
    allIssues.push({
      rule: 'configuration-error',
      severity: SEVERITY.ERROR,
      message: `未找到基准语言 ${baseLang} 的翻译文件`
    });
  }
  
  for (const issue of allIssues) {
    statistics.total++;
    statistics.bySeverity[issue.severity]++;
    
    if (!statistics.byRule[issue.rule]) {
      statistics.byRule[issue.rule] = 0;
    }
    statistics.byRule[issue.rule]++;
    
    const lang = issue.targetLanguage || issue.language || 'unknown';
    if (!statistics.byLanguage[lang]) {
      statistics.byLanguage[lang] = 0;
    }
    statistics.byLanguage[lang]++;
  }
  
  return {
    issues: allIssues,
    ignored: allIgnored,
    statistics,
    languages: Object.keys(languages)
  };
}

module.exports = {
  SEVERITY,
  RULES,
  extractPlaceholders,
  extractICUPluralForms,
  extractVariableNames,
  checkMissingKeys,
  checkExtraKeys,
  checkEmptyValues,
  checkPlaceholders,
  checkICUPlurals,
  checkVariableNames,
  checkLengthRisk,
  runAllChecks
};
