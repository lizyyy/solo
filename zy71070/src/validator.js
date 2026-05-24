const fs = require('fs');
const path = require('path');
const { ARRAY_MERGE_MODES } = require('./merger');

const EXIT_CODES = {
  SUCCESS: 0,
  VALIDATION_ERROR: 1,
  FILE_NOT_FOUND: 2,
  INVALID_JSON: 3,
  INVALID_ENV: 4,
  OUTPUT_ERROR: 5,
  KEY_NOT_FOUND: 6
};

const ERROR_MESSAGES = {
  [EXIT_CODES.SUCCESS]: '成功',
  [EXIT_CODES.VALIDATION_ERROR]: '参数验证错误',
  [EXIT_CODES.FILE_NOT_FOUND]: '文件不存在',
  [EXIT_CODES.INVALID_JSON]: 'JSON格式错误',
  [EXIT_CODES.INVALID_ENV]: '环境文件格式错误',
  [EXIT_CODES.OUTPUT_ERROR]: '输出错误',
  [EXIT_CODES.KEY_NOT_FOUND]: '键路径不存在'
};

function validateOptions(options) {
  const errors = [];

  if (!options.default) {
    errors.push('必须提供默认配置文件路径 (-d, --default)');
  }

  if (!options.env) {
    errors.push('必须提供环境配置文件路径 (-e, --env)');
  }

  if (!options.tenant) {
    errors.push('必须提供租户配置文件路径 (-t, --tenant)');
  }

  const validModes = Object.values(ARRAY_MERGE_MODES);
  if (options.arrayMerge && !validModes.includes(options.arrayMerge)) {
    errors.push(`数组合并模式必须是: ${validModes.join(', ')}`);
  }

  const validFormats = ['all', 'terminal', 'json', 'markdown'];
  if (options.format && !validFormats.includes(options.format)) {
    errors.push(`输出格式必须是: ${validFormats.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateFile(filePath, type = 'json') {
  const errors = [];

  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      errors: [`文件不存在: ${filePath}`],
      exitCode: EXIT_CODES.FILE_NOT_FOUND
    };
  }

  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    return {
      valid: false,
      errors: [`路径不是文件: ${filePath}`],
      exitCode: EXIT_CODES.FILE_NOT_FOUND
    };
  }

  if (type === 'json') {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      JSON.parse(content);
    } catch (e) {
      return {
        valid: false,
        errors: [`JSON解析错误 (${filePath}): ${e.message}`],
        exitCode: EXIT_CODES.INVALID_JSON
      };
    }
  } else if (type === 'env') {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (filePath.endsWith('.json')) {
        JSON.parse(content);
      } else {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && !line.startsWith('#') && !line.includes('=')) {
            errors.push(`.env文件第${i + 1}行格式错误: "${line}"`);
          }
        }
      }
    } catch (e) {
      return {
        valid: false,
        errors: [`环境文件解析错误 (${filePath}): ${e.message}`],
        exitCode: EXIT_CODES.INVALID_ENV
      };
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    exitCode: errors.length > 0 ? EXIT_CODES.VALIDATION_ERROR : EXIT_CODES.SUCCESS
  };
}

function validateKeyPath(traceMap, keyPath) {
  if (!keyPath) return { valid: true };

  const exists = traceMap[keyPath] !== undefined;
  if (!exists) {
    const similarKeys = Object.keys(traceMap)
      .filter(k => k.includes(keyPath.split('.').pop() || keyPath))
      .slice(0, 5);

    return {
      valid: false,
      errors: [
        `键路径不存在: ${keyPath}`,
        similarKeys.length > 0 ? `相似的键: ${similarKeys.join(', ')}` : ''
      ].filter(Boolean),
      exitCode: EXIT_CODES.KEY_NOT_FOUND
    };
  }

  return { valid: true };
}

function ensureOutputDir(outputDir) {
  try {
    if (fs.existsSync(outputDir)) {
      const stats = fs.statSync(outputDir);
      if (!stats.isDirectory()) {
        return {
          valid: false,
          errors: [`输出路径已存在且不是目录: ${outputDir}`],
          exitCode: EXIT_CODES.OUTPUT_ERROR
        };
      }
    } else {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      errors: [`无法创建输出目录: ${e.message}`],
      exitCode: EXIT_CODES.OUTPUT_ERROR
    };
  }
}

function validateAll(options) {
  const results = [];

  results.push(validateOptions(options));

  if (options.default) {
    results.push(validateFile(options.default, 'json'));
  }

  if (options.env) {
    const envType = options.env.endsWith('.env') ? 'env' : 'json';
    results.push(validateFile(options.env, envType));
  }

  if (options.tenant) {
    results.push(validateFile(options.tenant, 'json'));
  }

  if (options.output) {
    results.push(ensureOutputDir(options.output));
  }

  const allErrors = results.flatMap(r => r.errors || []);
  const firstError = results.find(r => !r.valid);

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    exitCode: firstError?.exitCode || (allErrors.length > 0 ? EXIT_CODES.VALIDATION_ERROR : EXIT_CODES.SUCCESS)
  };
}

module.exports = {
  validateOptions,
  validateFile,
  validateKeyPath,
  ensureOutputDir,
  validateAll,
  EXIT_CODES,
  ERROR_MESSAGES
};
