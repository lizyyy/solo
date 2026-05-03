'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  localeDir: './locales',
  baseLang: 'zh-CN',
  outputDir: './reports',
  formats: ['console', 'json', 'markdown'],
  checks: {
    missingKeys: true,
    extraKeys: true,
    emptyValues: true,
    placeholders: true,
    icuPlurals: true,
    variableNames: true,
    lengthRisk: true
  },
  lengthRisk: {
    threshold: 1.5,
    minBaseLength: 5,
    ignoreKeys: []
  },
  ignore: {
    keys: [],
    languages: [],
    rules: []
  },
  fileTypes: ['.json', '.yaml', '.yml', '.po']
};

function loadConfig(configPath) {
  const possiblePaths = configPath 
    ? [configPath]
    : [
        './i18n-lint.config.js',
        './i18n-lint.config.json',
        './.i18n-lintrc.js',
        './.i18n-lintrc.json'
      ];

  for (const p of possiblePaths) {
    const fullPath = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    if (fs.existsSync(fullPath)) {
      try {
        let config;
        if (fullPath.endsWith('.js')) {
          config = require(fullPath);
        } else {
          const content = fs.readFileSync(fullPath, 'utf-8');
          config = JSON.parse(content);
        }
        return mergeConfig(DEFAULT_CONFIG, config);
      } catch (error) {
        throw new Error(`配置文件解析失败 ${fullPath}: ${error.message}`);
      }
    }
  }

  return { ...DEFAULT_CONFIG };
}

function mergeConfig(defaultConfig, userConfig) {
  const merged = { ...defaultConfig };

  for (const [key, value] of Object.entries(userConfig)) {
    if (key === 'checks' && typeof value === 'object') {
      merged.checks = { ...defaultConfig.checks, ...value };
    } else if (key === 'lengthRisk' && typeof value === 'object') {
      merged.lengthRisk = { ...defaultConfig.lengthRisk, ...value };
    } else if (key === 'ignore' && typeof value === 'object') {
      merged.ignore = {
        keys: Array.isArray(value.keys) ? value.keys : defaultConfig.ignore.keys,
        languages: Array.isArray(value.languages) ? value.languages : defaultConfig.ignore.languages,
        rules: Array.isArray(value.rules) ? value.rules : defaultConfig.ignore.rules
      };
    } else if (key === 'formats' || key === 'fileTypes') {
      if (Array.isArray(value)) {
        merged[key] = value;
      }
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

function validateConfig(config) {
  const errors = [];

  if (typeof config.localeDir !== 'string' || !config.localeDir) {
    errors.push('localeDir 必须是非空字符串');
  }

  if (typeof config.baseLang !== 'string' || !config.baseLang) {
    errors.push('baseLang 必须是非空字符串');
  }

  if (typeof config.outputDir !== 'string') {
    errors.push('outputDir 必须是字符串');
  }

  if (!Array.isArray(config.formats) || config.formats.length === 0) {
    errors.push('formats 必须是非空数组');
  }

  const validFormats = ['console', 'json', 'markdown', 'html'];
  for (const format of config.formats) {
    if (!validFormats.includes(format)) {
      errors.push(`不支持的输出格式: ${format}，支持的格式: ${validFormats.join(', ')}`);
    }
  }

  if (config.lengthRisk) {
    if (typeof config.lengthRisk.threshold !== 'number' || config.lengthRisk.threshold <= 1) {
      errors.push('lengthRisk.threshold 必须是大于 1 的数字');
    }
    if (typeof config.lengthRisk.minBaseLength !== 'number' || config.lengthRisk.minBaseLength < 0) {
      errors.push('lengthRisk.minBaseLength 必须是非负数字');
    }
  }

  if (errors.length > 0) {
    throw new Error(`配置验证失败:\n  - ${errors.join('\n  - ')}`);
  }

  return true;
}

function shouldIgnoreKey(key, ignoreConfig) {
  if (!ignoreConfig || !Array.isArray(ignoreConfig.keys)) {
    return false;
  }

  for (const pattern of ignoreConfig.keys) {
    if (typeof pattern === 'string') {
      if (pattern === key || matchWildcard(pattern, key)) {
        return pattern;
      }
    } else if (pattern instanceof RegExp) {
      if (pattern.test(key)) {
        return pattern.toString();
      }
    }
  }

  return false;
}

function shouldIgnoreLanguage(lang, ignoreConfig) {
  if (!ignoreConfig || !Array.isArray(ignoreConfig.languages)) {
    return false;
  }
  return ignoreConfig.languages.includes(lang);
}

function shouldIgnoreRule(rule, ignoreConfig) {
  if (!ignoreConfig || !Array.isArray(ignoreConfig.rules)) {
    return false;
  }
  return ignoreConfig.rules.includes(rule);
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

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  validateConfig,
  shouldIgnoreKey,
  shouldIgnoreLanguage,
  shouldIgnoreRule,
  matchWildcard
};
