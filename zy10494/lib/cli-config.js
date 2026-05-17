const fs = require('fs');
const path = require('path');

const VALID_FORMATS = ['all', 'summary', 'json', 'markdown'];
const VALID_SCAN_GATES = ['critical', 'high', 'medium', 'all'];

function validateOptions(options) {
  const errors = [];

  if (!options.input) {
    errors.push('必须指定输入文件路径 (-i/--input)');
  } else if (!fs.existsSync(options.input)) {
    errors.push(`输入文件不存在: ${options.input}`);
  } else {
    const ext = path.extname(options.input).toLowerCase();
    if (!['.csv', '.yaml', '.yml', '.json'].includes(ext)) {
      errors.push(`不支持的文件格式: ${ext}，仅支持 CSV、YAML、JSON`);
    }
  }

  if (!VALID_FORMATS.includes(options.format)) {
    errors.push(`无效的输出格式: ${options.format}，必须是: ${VALID_FORMATS.join(', ')}`);
  }

  if (!VALID_SCAN_GATES.includes(options.scanGate)) {
    errors.push(`无效的扫描门禁: ${options.scanGate}，必须是: ${VALID_SCAN_GATES.join(', ')}`);
  }

  if (options.outputDir) {
    try {
      fs.accessSync(path.dirname(path.resolve(options.outputDir)));
    } catch (e) {
      errors.push(`输出目录的父目录不存在或不可访问: ${options.outputDir}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function getScanGateLevel(gate) {
  const levels = {
    'all': 0,
    'medium': 1,
    'high': 2,
    'critical': 3
  };
  return levels[gate] || 3;
}

function getSeverityLevel(severity) {
  const levels = {
    'low': 0,
    'medium': 1,
    'high': 2,
    'critical': 3
  };
  return levels[severity.toLowerCase()] || 0;
}

module.exports = {
  validateOptions,
  getScanGateLevel,
  getSeverityLevel,
  VALID_FORMATS,
  VALID_SCAN_GATES
};
