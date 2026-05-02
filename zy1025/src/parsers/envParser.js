import fs from 'fs';
import path from 'path';
import { ENV_VAR_PATTERN } from '../utils/constants.js';

export function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const variables = {};
  const fileName = path.basename(filePath);

  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine === '' || trimmedLine.startsWith('#')) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      const cleanedValue = cleanEnvValue(value);
      
      variables[key] = {
        value: cleanedValue,
        source: fileName,
        filePath: filePath,
        foundIn: 'env_file',
      };
    }
  }

  return variables;
}

function cleanEnvValue(value) {
  let cleaned = value.trim();
  
  if (cleaned.startsWith('#')) {
    return '';
  }
  
  const commentIndex = cleaned.indexOf(' #');
  if (commentIndex !== -1) {
    cleaned = cleaned.substring(0, commentIndex).trim();
  }
  
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  
  return cleaned;
}

export function extractEnvVarsFromText(text, source, filePath) {
  const matches = text.matchAll(ENV_VAR_PATTERN);
  const variables = {};

  for (const match of matches) {
    const varName = match[0];
    if (!variables[varName]) {
      variables[varName] = {
        value: undefined,
        source: source,
        filePath: filePath,
        foundIn: source,
        references: [],
      };
    }
    variables[varName].references.push({
      match: match[0],
      index: match.index,
    });
  }

  return variables;
}

export function isEnvFile(fileName) {
  return fileName.startsWith('.env');
}

export function isExampleEnvFile(fileName) {
  return fileName === '.env.example' || fileName.endsWith('.env.example');
}

export function isLocalEnvFile(fileName) {
  return fileName === '.env.local' || fileName.endsWith('.env.local');
}
