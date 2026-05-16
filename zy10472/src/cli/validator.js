const fs = require('fs');
const path = require('path');

function validateInputs(options) {
  const errors = [];

  if (!options.flags || options.flags.trim() === '') {
    errors.push('必须指定 --flags 参数，提供开关清单CSV文件路径');
  } else if (!fs.existsSync(options.flags)) {
    errors.push(`开关清单文件不存在: ${options.flags}`);
  } else if (!fs.statSync(options.flags).isFile()) {
    errors.push(`--flags 必须指向文件，而不是目录: ${options.flags}`);
  } else {
    const ext = path.extname(options.flags).toLowerCase();
    if (ext !== '.csv' && ext !== '.json') {
      errors.push(`开关清单文件格式不支持，请使用 CSV 或 JSON: ${ext}`);
    }
  }

  if (!options.code || options.code.trim() === '') {
    errors.push('必须指定 --code 参数，提供代码目录路径');
  } else if (!fs.existsSync(options.code)) {
    errors.push(`代码目录不存在: ${options.code}`);
  } else if (!fs.statSync(options.code).isDirectory()) {
    errors.push(`--code 必须指向目录，而不是文件: ${options.code}`);
  }

  if (options.defaultValue !== 'true' && options.defaultValue !== 'false') {
    errors.push(`--default-value 必须是 true 或 false，当前值: ${options.defaultValue}`);
  }

  if (options.extensions) {
    const exts = options.extensions.split(',').map(e => e.trim());
    const invalidExts = exts.filter(e => !/^[a-z0-9]+$/i.test(e));
    if (invalidExts.length > 0) {
      errors.push(`文件扩展名格式无效: ${invalidExts.join(', ')}`);
    }
  }

  if (options.output) {
    const outputPath = path.resolve(options.output);
    if (fs.existsSync(outputPath) && !options.force) {
      const stats = fs.statSync(outputPath);
      if (stats.isDirectory()) {
        const files = fs.readdirSync(outputPath);
        if (files.length > 0) {
          errors.push(
            `输出目录已存在且不为空: ${outputPath}。使用 --force 参数覆盖或选择其他目录`
          );
        }
      } else {
        errors.push(`输出路径已存在且不是目录: ${outputPath}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = { validateInputs };
