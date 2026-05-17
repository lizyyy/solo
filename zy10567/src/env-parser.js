import fs from 'fs/promises';
import path from 'path';

const ENV_LINE_REGEX = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)$/;
const COMMENT_REGEX = /^\s*#/;
const EMPTY_LINE_REGEX = /^\s*$/;

function expandValue(value, variables) {
  let expanded = value;
  
  expanded = expanded.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)(?::-([^}]*))?\}/g, (match, varName, _, defaultValue) => {
    if (variables.hasOwnProperty(varName)) {
      return variables[varName] || '';
    }
    return defaultValue || '';
  });
  
  expanded = expanded.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, varName) => {
    return variables.hasOwnProperty(varName) ? variables[varName] : '';
  });
  
  return expanded;
}

export function parseEnvLine(line, lineNumber, filePath, contextVars = {}) {
  const result = {
    line,
    lineNumber,
    valid: true,
    key: null,
    value: null,
    rawValue: null,
    errors: [],
    warnings: []
  };

  if (EMPTY_LINE_REGEX.test(line)) {
    result.type = 'empty';
    return result;
  }

  if (COMMENT_REGEX.test(line)) {
    result.type = 'comment';
    return result;
  }

  const match = line.match(ENV_LINE_REGEX);
  if (!match) {
    result.valid = false;
    result.type = 'invalid';
    result.errors.push({
      type: 'invalid_syntax',
      message: '无效的环境变量语法',
      lineNumber,
      line
    });
    return result;
  }

  result.key = match[1];
  result.rawValue = match[2];
  result.type = 'variable';

  let value = result.rawValue;

  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  result.value = expandValue(value, contextVars);

  return result;
}

export async function parseEnvFile(filePath, baseDir = process.cwd()) {
  const result = {
    file: filePath,
    variables: [],
    errors: [],
    warnings: [],
    loaded: false
  };

  try {
    const absolutePath = path.resolve(baseDir, filePath);
    result.file = absolutePath;
    
    const content = await fs.readFile(absolutePath, 'utf8');
    result.loaded = true;
    
    const lines = content.split('\n');
    const contextVars = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parsed = parseEnvLine(line, i + 1, filePath, contextVars);
      
      if (parsed.type === 'variable' && parsed.valid) {
        contextVars[parsed.key] = parsed.value;
        result.variables.push({
          key: parsed.key,
          value: parsed.value,
          rawValue: parsed.rawValue,
          lineNumber: i + 1,
          source: 'env_file',
          sourceFile: absolutePath
        });
      } else if (!parsed.valid) {
        result.errors.push(...parsed.errors);
      }
    }

  } catch (err) {
    result.errors.push({
      type: 'file_read_error',
      message: err.message,
      file: filePath
    });
  }

  return result;
}

export function getShellEnv(keys = null) {
  const result = {
    variables: [],
    source: 'shell'
  };

  for (const [key, value] of Object.entries(process.env)) {
    if (keys && !keys.includes(key)) continue;
    result.variables.push({
      key,
      value,
      source: 'shell',
      sourceFile: null
    });
  }

  return result;
}

export function parseCliEnvArgs(envArgs) {
  const result = {
    variables: [],
    errors: []
  };

  if (!envArgs || envArgs.length === 0) {
    return result;
  }

  for (const arg of envArgs) {
    const [key, ...valueParts] = arg.split('=');
    if (key) {
      result.variables.push({
        key: key.trim(),
        value: valueParts.join('=') || '',
        source: 'cli',
        sourceFile: null
      });
    }
  }

  return result;
}
