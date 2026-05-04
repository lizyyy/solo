import * as fs from 'fs';
import * as path from 'path';
import { Locale, ScanConfig } from '../types';

export const flattenObject = (obj: Record<string, any>, prefix = ''): Record<string, string> => {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (typeof value === 'string') {
      result[newKey] = value;
    }
  }
  
  return result;
};

export const extractPlaceholders = (str: string): string[] => {
  const regex = /\{(\w+)\}/g;
  const matches: string[] = [];
  let match;
  
  while ((match = regex.exec(str)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  
  return matches.sort();
};

export const isPluralKey = (key: string): boolean => {
  const pluralSuffixes = ['_zero', '_one', '_two', '_few', '_many', '_other'];
  return pluralSuffixes.some(suffix => key.endsWith(suffix));
};

export const getPluralBaseKey = (key: string): string => {
  const pluralSuffixes = ['_zero', '_one', '_two', '_few', '_many', '_other'];
  for (const suffix of pluralSuffixes) {
    if (key.endsWith(suffix)) {
      return key.slice(0, -suffix.length);
    }
  }
  return key;
};

export const getPluralForm = (key: string): string | null => {
  const pluralSuffixes = ['_zero', '_one', '_two', '_few', '_many', '_other'];
  for (const suffix of pluralSuffixes) {
    if (key.endsWith(suffix)) {
      return suffix.slice(1);
    }
  }
  return null;
};

export const hasChineseChars = (str: string): boolean => {
  const chineseRegex = /[\u4e00-\u9fa5]/;
  return chineseRegex.test(str);
};

export const readJsonFile = (filePath: string): Record<string, any> => {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const defaultConfig: ScanConfig = {
  projectPath: process.cwd(),
  locales: ['zh', 'en', 'ja'],
  localePatterns: ['locales/**/*.json', 'i18n/**/*.json'],
  sourcePatterns: ['src/**/*.{ts,tsx,js,jsx,vue}'],
  ignorePatterns: ['node_modules/**', 'dist/**', 'build/**'],
  pluralRules: {
    zh: ['other'],
    en: ['one', 'other'],
    ja: ['other'],
  },
  i18nFunctionNames: ['t', 'translate', '$t', 'i18n.t'],
};

export const getSeverityLabel = (severity: string): string => {
  const labels: Record<string, string> = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低',
  };
  return labels[severity] || severity;
};

export const getIssueTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    missing_key: '缺失 Key',
    extra_key: '多余 Key',
    placeholder_mismatch: '占位符不一致',
    plural_rule_missing: '复数规则漏配',
    plural_rule_inconsistent: '复数规则不一致',
    hardcoded_chinese: '硬编码中文',
    unused_key: '未使用 Key',
    empty_value: '空值',
  };
  return labels[type] || type;
};
