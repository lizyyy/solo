const fs = require('fs');
const path = require('path');

function parseArgs(options) {
  return {
    logsDir: options.logs,
    outputDir: options.output,
    matrixKeys: options.matrixKeys.split(',').map(k => k.trim()),
    rerunThreshold: parseInt(options.rerunThreshold, 10),
    formats: options.format.split(',').map(f => f.trim()),
    verbose: options.verbose || false
  };
}

function validateInputs(args) {
  const errors = [];

  if (args.logsDir) {
    if (!fs.existsSync(args.logsDir)) {
      errors.push(`日志目录不存在: ${args.logsDir}`);
    } else if (!fs.statSync(args.logsDir).isDirectory()) {
      errors.push(`日志路径不是目录: ${args.logsDir}`);
    }
  }

  if (isNaN(args.rerunThreshold) || args.rerunThreshold < 0) {
    errors.push(`重跑次数阈值必须是非负整数: ${args.rerunThreshold}`);
  }

  if (args.matrixKeys.length === 0) {
    errors.push('矩阵参数键名不能为空');
  }

  const validFormats = ['terminal', 'html', 'csv', 'json'];
  for (const format of args.formats) {
    if (!validFormats.includes(format)) {
      errors.push(`无效的输出格式: ${format} (可用: ${validFormats.join(', ')})`);
    }
  }

  try {
    fs.mkdirSync(args.outputDir, { recursive: true });
  } catch (e) {
    errors.push(`无法创建输出目录: ${args.outputDir}`);
  }

  if (errors.length > 0) {
    throw new Error(`输入校验失败:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }

  return args;
}

module.exports = { parseArgs, validateInputs };
