import fs from 'fs/promises';
import yaml from 'yaml';

export async function parseComposeFile(filePath) {
  const result = {
    file: filePath,
    services: {},
    errors: [],
    warnings: []
  };

  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const doc = yaml.parseDocument(content);

    if (doc.errors.length > 0) {
      result.errors = doc.errors.map((err, idx) => ({
        type: 'yaml_parse_error',
        message: err.message,
        line: err.linePos ? err.linePos.start.line : null,
        column: err.linePos ? err.linePos.start.col : null
      }));
      return result;
    }

    const composeData = doc.toJS();

    if (!composeData || !composeData.services) {
      result.warnings.push({
        type: 'no_services',
        message: '未找到services配置'
      });
      return result;
    }

    for (const [serviceName, serviceConfig] of Object.entries(composeData.services)) {
      result.services[serviceName] = {
        environment: [],
        env_file: []
      };

      if (serviceConfig.environment) {
        const env = serviceConfig.environment;
        
        if (Array.isArray(env)) {
          for (const envLine of env) {
            if (typeof envLine === 'string') {
              const [key, ...valueParts] = envLine.split('=');
              result.services[serviceName].environment.push({
                key: key.trim(),
                value: valueParts.join('=') || null,
                source: 'compose',
                sourceFile: filePath,
                format: 'array'
              });
            } else if (typeof envLine === 'object' && envLine !== null) {
              for (const [key, value] of Object.entries(envLine)) {
                result.services[serviceName].environment.push({
                  key,
                  value,
                  source: 'compose',
                  sourceFile: filePath,
                  format: 'array_object'
                });
              }
            }
          }
        } else if (typeof env === 'object' && env !== null) {
          for (const [key, value] of Object.entries(env)) {
            result.services[serviceName].environment.push({
              key,
              value,
              source: 'compose',
              sourceFile: filePath,
              format: 'object'
            });
          }
        }
      }

      if (serviceConfig.env_file) {
        const envFiles = Array.isArray(serviceConfig.env_file) 
          ? serviceConfig.env_file 
          : [serviceConfig.env_file];
        
        for (const ef of envFiles) {
          if (typeof ef === 'string') {
            result.services[serviceName].env_file.push({
              path: ef,
              sourceFile: filePath
            });
          } else if (typeof ef === 'object' && ef.path) {
            result.services[serviceName].env_file.push({
              path: ef.path,
              required: ef.required,
              sourceFile: filePath
            });
          }
        }
      }
    }

  } catch (err) {
    result.errors.push({
      type: 'file_read_error',
      message: err.message
    });
  }

  return result;
}

export function findComposeFiles(directory) {
  const composePatterns = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
    'docker-compose.override.yml',
    'docker-compose.override.yaml'
  ];
  return composePatterns.map(pattern => `${directory}/${pattern}`);
}
