import fs from 'fs';
import path from 'path';
import { ENV_VAR_PATTERN } from '../utils/constants.js';

export function parsePackageJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  const variables = {};

  try {
    const pkg = JSON.parse(content);
    
    if (pkg.scripts) {
      for (const [scriptName, scriptValue] of Object.entries(pkg.scripts)) {
        const matches = scriptValue.matchAll(ENV_VAR_PATTERN);
        
        for (const match of matches) {
          const varName = match[0];
          
          if (!variables[varName]) {
            variables[varName] = {
              value: undefined,
              source: fileName,
              filePath: filePath,
              foundIn: 'package_json',
              scripts: [],
            };
          }
          
          if (!variables[varName].scripts.includes(scriptName)) {
            variables[varName].scripts.push(scriptName);
          }
        }
      }
    }
  } catch (error) {
    console.warn(`警告: 解析 package.json 失败 ${filePath}: ${error.message}`);
  }

  return variables;
}

export function isPackageJson(fileName) {
  return fileName === 'package.json';
}
