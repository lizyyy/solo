import fs from 'fs';
import path from 'path';
import { parseEnvFile, isEnvFile, isExampleEnvFile, isLocalEnvFile } from '../parsers/envParser.js';
import { parseDockerCompose, isDockerComposeFile } from '../parsers/dockerComposeParser.js';
import { parsePackageJson, isPackageJson } from '../parsers/packageJsonParser.js';
import { parseMarkdown, isMarkdownFile } from '../parsers/markdownParser.js';

export function scanProject(projectDir, config) {
  const result = {
    projectDir: projectDir,
    scannedAt: new Date().toISOString(),
    files: [],
    variables: {
      all: {},
      fromExample: {},
      fromLocal: {},
      fromDocker: {},
      fromPackageJson: {},
      fromMarkdown: {},
    },
  };

  function shouldExclude(filePath) {
    const relativePath = path.relative(projectDir, filePath);
    
    for (const pattern of config.excludedFiles) {
      if (matchGlobPattern(relativePath, pattern)) {
        return true;
      }
    }
    return false;
  }

  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (shouldExclude(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else {
        processFile(fullPath, entry.name);
      }
    }
  }

  function processFile(filePath, fileName) {
    let fileResult = {
      path: filePath,
      fileName: fileName,
      variables: {},
      fileType: null,
    };

    if (isEnvFile(fileName)) {
      const vars = parseEnvFile(filePath);
      fileResult.variables = vars;
      fileResult.fileType = 'env_file';
      
      for (const [key, varInfo] of Object.entries(vars)) {
        mergeVariable(result.variables.all, key, varInfo);
        
        if (isExampleEnvFile(fileName)) {
          result.variables.fromExample[key] = { ...varInfo };
        }
        if (isLocalEnvFile(fileName)) {
          result.variables.fromLocal[key] = { ...varInfo };
        }
      }
      
      result.files.push(fileResult);
    }
    else if (config.scanDockerCompose && isDockerComposeFile(fileName)) {
      const vars = parseDockerCompose(filePath);
      fileResult.variables = vars;
      fileResult.fileType = 'docker_compose';
      
      for (const [key, varInfo] of Object.entries(vars)) {
        mergeVariable(result.variables.all, key, varInfo);
        result.variables.fromDocker[key] = { ...varInfo };
      }
      
      result.files.push(fileResult);
    }
    else if (config.scanPackageJson && isPackageJson(fileName)) {
      const vars = parsePackageJson(filePath);
      fileResult.variables = vars;
      fileResult.fileType = 'package_json';
      
      for (const [key, varInfo] of Object.entries(vars)) {
        mergeVariable(result.variables.all, key, varInfo);
        result.variables.fromPackageJson[key] = { ...varInfo };
      }
      
      result.files.push(fileResult);
    }
    else if (config.scanMarkdown && isMarkdownFile(fileName)) {
      const vars = parseMarkdown(filePath);
      fileResult.variables = vars;
      fileResult.fileType = 'markdown';
      
      for (const [key, varInfo] of Object.entries(vars)) {
        mergeVariable(result.variables.all, key, varInfo);
        result.variables.fromMarkdown[key] = { ...varInfo };
      }
      
      result.files.push(fileResult);
    }
  }

  scanDirectory(projectDir);
  
  return result;
}

function mergeVariable(allVars, key, newInfo) {
  if (!allVars[key]) {
    allVars[key] = {
      name: key,
      values: [],
      sources: [],
      foundIn: [],
    };
  }

  const varInfo = allVars[key];
  
  if (newInfo.value !== undefined && 
      !varInfo.values.some(v => v.value === newInfo.value && v.source === newInfo.source)) {
    varInfo.values.push({
      value: newInfo.value,
      source: newInfo.source,
      filePath: newInfo.filePath,
    });
  }
  
  if (!varInfo.sources.includes(newInfo.source)) {
    varInfo.sources.push(newInfo.source);
  }
  
  if (!varInfo.foundIn.includes(newInfo.foundIn)) {
    varInfo.foundIn.push(newInfo.foundIn);
  }
}

function matchGlobPattern(str, pattern) {
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(str) || str.includes(pattern.replace(/\*\*$/, '').replace(/\*$/, ''));
}
