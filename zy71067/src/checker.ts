import * as path from 'path';
import { LocaleEntry, CheckConfig, CheckResult } from './types';
import { parseI18nFile, extractPlaceholders } from './parser';
import { calculateWidth } from './widthCalculator';
import { checkPlaceholders, validatePlaceholderOrder, estimatePlaceholderMaxWidth } from './placeholderChecker';
import { assessRisk } from './riskAssessor';

export interface CheckOptions {
  sourceLocale?: string;
  verbose?: boolean;
}

export interface CheckResultWithErrors {
  results: CheckResult[];
  parseErrors: Array<{ file: string; error: string }>;
}

export function runChecks(
  inputFiles: string[],
  checkConfigs: CheckConfig[],
  options: CheckOptions = {}
): CheckResultWithErrors {
  const allEntries: LocaleEntry[] = [];
  const parseErrors: Array<{ file: string; error: string }> = [];
  
  for (const file of inputFiles) {
    try {
      const entries = parseI18nFile(file);
      allEntries.push(...entries);
    } catch (error) {
      const errorMessage = (error as Error).message;
      parseErrors.push({ file, error: errorMessage });
      console.error(`解析文件失败 ${file}:`, errorMessage);
    }
  }
  
  const results: CheckResult[] = [];
  const sourceEntries = options.sourceLocale
    ? allEntries.filter(e => e.locale === options.sourceLocale)
    : [];
  
  for (const entry of allEntries) {
    const matchingConfigs = checkConfigs.filter(config => 
      config.locale === entry.locale || config.locale === '*'
    );
    
    for (const config of matchingConfigs) {
      const result = checkEntry(entry, config, sourceEntries);
      results.push(result);
    }
  }
  
  return { results, parseErrors };
}

function checkEntry(
  entry: LocaleEntry,
  config: CheckConfig,
  sourceEntries: LocaleEntry[]
): CheckResult {
  const sourceEntry = sourceEntries.find(
    s => s.key === entry.key && s.pluralForm === entry.pluralForm
  );
  
  const sourceText = sourceEntry?.value || entry.value;
  
  let checkedText = entry.value;
  const placeholders = extractPlaceholders(checkedText);
  
  for (const placeholder of placeholders) {
    const estimatedWidth = estimatePlaceholderMaxWidth(placeholder);
    const replacement = 'X'.repeat(estimatedWidth);
    checkedText = checkedText.replace(placeholder, replacement);
  }
  
  const widthResult = calculateWidth(checkedText);
  const widthOverflow = Math.max(0, widthResult.charWidth - config.maxWidth);
  
  const placeholderIssues = [
    ...checkPlaceholders(sourceText, entry.value, config.placeholders),
    ...validatePlaceholderOrder(sourceText, entry.value),
  ];
  
  const riskAssessment = assessRisk(
    widthResult,
    config.maxWidth,
    placeholderIssues,
    config.maxChars
  );
  
  return {
    key: entry.key,
    locale: entry.locale,
    interfacePosition: config.interfacePosition,
    originalText: entry.value,
    checkedText,
    pluralForm: entry.pluralForm,
    widthResult,
    maxWidth: config.maxWidth,
    widthOverflow,
    placeholderIssues,
    riskLevel: riskAssessment.level,
    riskExplanation: riskAssessment.explanation,
  };
}

export function loadConfigFile(configPath: string): {
  checks: CheckConfig[];
  outputDir?: string;
  formats?: string[];
} {
  const fs = require('fs');
  const ext = path.extname(configPath).toLowerCase();
  
  let configData: any;
  
  if (ext === '.json') {
    configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } else if (ext === '.yaml' || ext === '.yml') {
    const { parseYaml } = require('./parser');
    configData = parseYaml(fs.readFileSync(configPath, 'utf-8'));
  } else {
    throw new Error(`不支持的配置文件格式: ${ext}`);
  }
  
  const checks: CheckConfig[] = configData.checks?.map((check: any) => ({
    locale: check.locale,
    interfacePosition: check.interfacePosition,
    maxWidth: check.maxWidth,
    maxChars: check.maxChars,
    placeholders: check.placeholders || configData.defaults?.placeholders,
    keyPattern: check.keyPattern,
  })) || [];
  
  return {
    checks,
    outputDir: configData.output?.dir,
    formats: configData.output?.formats,
  };
}

export function generateConfigHash(config: any): string {
  const crypto = require('crypto');
  
  function stableStringify(obj: any): string {
    if (obj === null || obj === undefined) {
      return String(obj);
    }
    if (typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => stableStringify(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(key => 
      JSON.stringify(key) + ':' + stableStringify(obj[key])
    ).join(',') + '}';
  }
  
  const configString = stableStringify(config);
  return crypto.createHash('md5').update(configString).digest('hex').substring(0, 8);
}
