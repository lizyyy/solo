const fs = require('fs');
const path = require('path');

const EXIT_CODES = {
  SUCCESS: 0,
  INPUT_ERROR: 1,
  VALIDATION_ERROR: 2,
  FILE_NOT_FOUND: 3,
  INVALID_JSON: 4,
  ANALYSIS_ERROR: 5,
};

function validateOptions(options) {
  const errors = [];
  const warnings = [];

  if (!options.input) {
    errors.push('必须指定 --input 参数');
  }

  if (options.input && !fs.existsSync(options.input)) {
    errors.push(`输入文件不存在: ${options.input}`);
  }

  if (options.previous && !fs.existsSync(options.previous)) {
    errors.push(`历史快照文件不存在: ${options.previous}`);
  }

  const prefixDepth = parseInt(options.prefixDepth, 10);
  if (isNaN(prefixDepth) || prefixDepth < 1 || prefixDepth > 10) {
    errors.push('prefix-depth 必须是 1-10 之间的整数');
  }

  const topN = parseInt(options.topN, 10);
  if (isNaN(topN) || topN < 1 || topN > 1000) {
    errors.push('top-n 必须是 1-1000 之间的整数');
  }

  const sampleRate = parseFloat(options.sampleRate);
  if (isNaN(sampleRate) || sampleRate < 0.01 || sampleRate > 1.0) {
    errors.push('sample-rate 必须是 0.01-1.0 之间的数值');
  }

  const validFormats = ['all', 'terminal', 'json', 'markdown'];
  if (!validFormats.includes(options.format)) {
    errors.push(`format 必须是: ${validFormats.join(', ')}`);
  }

  try {
    const buckets = options.ttlBuckets.split(',').map(b => parseInt(b.trim(), 10));
    if (buckets.some(isNaN)) {
      errors.push('ttl-buckets 必须是逗号分隔的整数');
    }
    if (buckets[0] !== 0) {
      warnings.push('建议 ttl-buckets 从 0 开始，以便统计无 TTL 的 Key');
    }
  } catch (e) {
    errors.push('ttl-buckets 格式错误');
  }

  return { errors, warnings, isValid: errors.length === 0 };
}

function validateSampleData(data, strictMode = false) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(data)) {
    errors.push('样本数据必须是数组格式');
    return { errors, warnings, isValid: false };
  }

  if (data.length === 0) {
    errors.push('样本数据为空');
    return { errors, warnings, isValid: false };
  }

  const requiredFields = ['key', 'memory'];
  const optionalFields = ['ttl', 'type'];

  data.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      errors.push(`第 ${index} 项不是有效的对象`);
      return;
    }

    requiredFields.forEach(field => {
      if (!(field in item)) {
        errors.push(`第 ${index} 项缺少必填字段: ${field}`);
      }
    });

    if (item.key !== undefined && typeof item.key !== 'string') {
      errors.push(`第 ${index} 项的 key 必须是字符串`);
    }

    if (item.memory !== undefined) {
      if (typeof item.memory !== 'number' || item.memory < 0) {
        errors.push(`第 ${index} 项的 memory 必须是非负数字`);
      }
    }

    if (item.ttl !== undefined) {
      if (typeof item.ttl !== 'number' && item.ttl !== -1) {
        if (typeof item.ttl === 'number' && item.ttl < -1) {
          errors.push(`第 ${index} 项的 ttl 必须 >= -1 (-1 表示无 TTL)`);
        }
      }
    }

    if (item.type !== undefined && typeof item.type !== 'string') {
      warnings.push(`第 ${index} 项的 type 应该是字符串`);
    }
  });

  const hasNoTTL = data.some(item => item.ttl === -1 || item.ttl === undefined);
  if (hasNoTTL) {
    warnings.push(`检测到 ${data.filter(i => i.ttl === -1 || i.ttl === undefined).length} 个无 TTL 的 Key`);
  }

  const keySet = new Set();
  data.forEach(item => {
    if (item.key) {
      if (keySet.has(item.key)) {
        warnings.push(`发现重复 Key: ${item.key}`);
      }
      keySet.add(item.key);
    }
  });

  return {
    errors,
    warnings,
    isValid: strictMode ? errors.length === 0 && warnings.length === 0 : errors.length === 0,
    totalCount: data.length
  };
}

module.exports = {
  validateOptions,
  validateSampleData,
  EXIT_CODES
};
