const fs = require('fs');
const path = require('path');
const { mergeConfigs, ARRAY_MERGE_MODES } = require('./merger');
const { detectConflicts, getOverrideChain, filterByKeyPath, getStatistics } = require('./tracer');
const { validateAll, validateKeyPath, EXIT_CODES } = require('./validator');
const { printTerminalSummary, writeOutputs } = require('./output');

function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

function parseEnvFile(content) {
  const result = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    let key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }

    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (value === 'null') value = null;
    else if (!isNaN(Number(value)) && value !== '') value = Number(value);

    const nestedKey = key.toLowerCase().replace(/_/g, '.');
    setNestedValue(result, nestedKey, value);
  }

  return result;
}

function loadConfig(filePath, type = 'json') {
  const content = fs.readFileSync(filePath, 'utf-8');

  if (type === 'env' && !filePath.endsWith('.json')) {
    return parseEnvFile(content);
  }

  return JSON.parse(content);
}

function nestedValueToPaths(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, nestedValueToPaths(value, fullPath));
    } else {
      result[fullPath] = value;
    }
  }
  return result;
}

async function runConfigTrace(options) {
  const validation = validateAll(options);
  if (!validation.valid) {
    console.error('验证失败:');
    for (const error of validation.errors) {
      console.error('  -', error);
    }
    return validation.exitCode;
  }

  const mergeOptions = {
    arrayMergeMode: options.arrayMerge || ARRAY_MERGE_MODES.REPLACE,
    caseSensitive: options.caseSensitive || false
  };

  const layers = {};

  try {
    layers.default = loadConfig(options.default, 'json');
  } catch (e) {
    console.error(`加载默认配置失败: ${e.message}`);
    return EXIT_CODES.INVALID_JSON;
  }

  try {
    const envType = options.env.endsWith('.env') ? 'env' : 'json';
    layers.env = loadConfig(options.env, envType);
  } catch (e) {
    console.error(`加载环境配置失败: ${e.message}`);
    return EXIT_CODES.INVALID_ENV;
  }

  try {
    layers.tenant = loadConfig(options.tenant, 'json');
  } catch (e) {
    console.error(`加载租户配置失败: ${e.message}`);
    return EXIT_CODES.INVALID_JSON;
  }

  const { mergedConfig, traceMap } = mergeConfigs(layers, mergeOptions);

  if (options.keyPath) {
    const keyValidation = validateKeyPath(traceMap, options.keyPath);
    if (!keyValidation.valid) {
      console.error('键路径验证失败:');
      for (const error of keyValidation.errors) {
        console.error('  -', error);
      }
      return keyValidation.exitCode;
    }
  }

  const conflicts = detectConflicts(traceMap, mergeOptions);
  const stats = getStatistics(traceMap, conflicts);

  let filteredTraceMap = traceMap;
  let keyPathChain = null;

  if (options.keyPath) {
    filteredTraceMap = filterByKeyPath(traceMap, options.keyPath);
    keyPathChain = getOverrideChain(traceMap, options.keyPath);
  }

  const result = {
    mergedConfig,
    traceMap: filteredTraceMap,
    conflicts,
    stats,
    keyPathChain
  };

  if (options.format === 'all' || options.format === 'terminal') {
    printTerminalSummary(result, options);
  }

  let outputPaths = {};
  if (options.format === 'all' || options.format === 'json' || options.format === 'markdown') {
    outputPaths = writeOutputs(result, options);
    if (!options.silent) {
      console.log();
      console.log('📄 输出文件:');
      for (const [type, path] of Object.entries(outputPaths)) {
        console.log(`  ${type.toUpperCase()}: ${path}`);
      }
      console.log();
    }
  }

  if (conflicts.hasConflicts) {
    return EXIT_CODES.SUCCESS;
  }

  return EXIT_CODES.SUCCESS;
}

module.exports = {
  runConfigTrace,
  mergeConfigs,
  detectConflicts,
  loadConfig,
  parseEnvFile,
  EXIT_CODES,
  ARRAY_MERGE_MODES
};
