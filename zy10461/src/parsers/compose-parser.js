const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class ComposeParser {
  constructor() {
    this.name = 'compose';
    this.priority = 30;
  }

  parse(filePath) {
    const result = {
      source: filePath,
      type: 'compose',
      variables: [],
      errors: []
    };

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const doc = yaml.load(content);

      if (doc && doc.services) {
        Object.keys(doc.services).forEach(serviceName => {
          const service = doc.services[serviceName];
          if (service.environment) {
            this._parseEnvironment(service.environment, serviceName, filePath, result);
          }
        });
      }

      if (doc && doc.environment) {
        this._parseEnvironment(doc.environment, 'global', filePath, result);
      }
    } catch (error) {
      if (error.mark) {
        result.errors.push({
          type: 'YAML_ERROR',
          message: `YAML解析错误: ${error.message}`,
          lineNumber: error.mark.line + 1,
          column: error.mark.column + 1,
          source: filePath
        });
      } else {
        result.errors.push({
          type: 'FILE_ERROR',
          message: `文件读取或解析失败: ${error.message}`,
          source: filePath
        });
      }
    }

    return result;
  }

  _parseEnvironment(environment, serviceName, filePath, result) {
    if (Array.isArray(environment)) {
      environment.forEach((envItem, index) => {
        if (typeof envItem === 'string') {
          const eqIndex = envItem.indexOf('=');
          if (eqIndex > 0) {
            const name = envItem.substring(0, eqIndex).trim();
            const value = envItem.substring(eqIndex + 1).trim();
            result.variables.push({
              name,
              value,
              rawValue: value,
              serviceName,
              arrayIndex: index,
              source: filePath,
              sourceType: 'compose',
              priority: this.priority
            });
          }
        }
      });
    } else if (typeof environment === 'object') {
      Object.entries(environment).forEach(([name, value]) => {
        result.variables.push({
          name,
          value: String(value),
          rawValue: String(value),
          serviceName,
          source: filePath,
          sourceType: 'compose',
          priority: this.priority
        });
      });
    }
  }

  canParse(filePath) {
    const basename = path.basename(filePath);
    return basename === 'docker-compose.yml' ||
           basename === 'docker-compose.yaml' ||
           basename.startsWith('docker-compose.') ||
           basename === 'compose.yml' ||
           basename === 'compose.yaml';
  }
}

module.exports = ComposeParser;
