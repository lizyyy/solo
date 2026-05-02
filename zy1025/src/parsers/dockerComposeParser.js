import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

export function parseDockerCompose(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  const variables = {};

  try {
    const doc = yaml.load(content);
    
    if (doc && doc.services) {
      for (const [serviceName, service] of Object.entries(doc.services)) {
        if (service.environment) {
          const envVars = service.environment;
          
          if (Array.isArray(envVars)) {
            for (const envLine of envVars) {
              if (typeof envLine === 'string') {
                const parsed = parseEnvLine(envLine);
                if (parsed) {
                  addVariable(variables, parsed.key, parsed.value, fileName, filePath, serviceName);
                }
              }
            }
          } else if (typeof envVars === 'object') {
            for (const [key, value] of Object.entries(envVars)) {
              addVariable(variables, key, value, fileName, filePath, serviceName);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn(`警告: 解析 docker-compose 文件失败 ${filePath}: ${error.message}`);
  }

  return variables;
}

function parseEnvLine(line) {
  const trimmedLine = line.trim();
  
  if (trimmedLine.includes('=')) {
    const equalIndex = trimmedLine.indexOf('=');
    const key = trimmedLine.substring(0, equalIndex);
    const value = trimmedLine.substring(equalIndex + 1);
    return { key, value: value || undefined };
  }
  
  return { key: trimmedLine, value: undefined };
}

function isVariableReference(value) {
  if (typeof value !== 'string') return false;
  return value.startsWith('${') && value.endsWith('}') || 
         value.startsWith('$') && /^\$[A-Z_][A-Z0-9_]*$/.test(value);
}

function addVariable(variables, key, value, fileName, filePath, serviceName) {
  const processedValue = isVariableReference(value) ? undefined : value;
  
  if (!variables[key]) {
    variables[key] = {
      value: processedValue,
      source: fileName,
      filePath: filePath,
      foundIn: 'docker_compose',
      services: [],
    };
  }
  
  if (serviceName && !variables[key].services.includes(serviceName)) {
    variables[key].services.push(serviceName);
  }
}

export function isDockerComposeFile(fileName) {
  return fileName === 'docker-compose.yml' || 
         fileName === 'docker-compose.yaml' ||
         fileName.startsWith('docker-compose.') && (
           fileName.endsWith('.yml') || fileName.endsWith('.yaml')
         );
}
