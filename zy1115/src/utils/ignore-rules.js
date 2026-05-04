const fs = require('fs');
const path = require('path');
const { ConfigError, ValidationError } = require('./errors');

class IgnoreRules {
  constructor(rulesPath = null) {
    this.rules = {
      endpoints: [],
      fields: [],
      patterns: []
    };
    
    if (rulesPath) {
      this.loadFromFile(rulesPath);
    }
  }

  loadFromFile(filePath) {
    try {
      const absolutePath = path.resolve(filePath);
      
      if (!fs.existsSync(absolutePath)) {
        throw new ConfigError(`忽略规则文件不存在: ${filePath}`, {
          configPath: filePath
        });
      }

      const content = fs.readFileSync(absolutePath, 'utf-8');
      const rules = JSON.parse(content);
      
      this.validateRules(rules, absolutePath);
      this.rules = this.normalizeRules(rules);
      
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ValidationError(`忽略规则文件 JSON 格式错误: ${filePath}`, {
          filePath,
          originalError: error.message
        });
      }
      if (error instanceof ConfigError || error instanceof ValidationError) {
        throw error;
      }
      throw new ConfigError(`加载忽略规则文件时出错: ${error.message}`, {
        configPath: filePath
      });
    }
  }

  validateRules(rules, filePath) {
    if (!rules || typeof rules !== 'object') {
      throw new ValidationError('忽略规则必须是一个对象', {
        filePath
      });
    }

    if (rules.endpoints) {
      if (!Array.isArray(rules.endpoints)) {
        throw new ValidationError('endpoints 规则必须是数组', {
          filePath,
          field: 'endpoints'
        });
      }
      
      for (const endpoint of rules.endpoints) {
        if (typeof endpoint === 'string') {
          continue;
        }
        if (typeof endpoint === 'object' && endpoint !== null) {
          if (!endpoint.method && !endpoint.path) {
            throw new ValidationError('endpoint 规则对象必须包含 method 或 path', {
              filePath,
              field: 'endpoints'
            });
          }
          continue;
        }
        throw new ValidationError('endpoint 规则必须是字符串或对象', {
          filePath,
          field: 'endpoints'
        });
      }
    }

    if (rules.fields) {
      if (!Array.isArray(rules.fields)) {
        throw new ValidationError('fields 规则必须是数组', {
          filePath,
          field: 'fields'
        });
      }
      
      for (const field of rules.fields) {
        if (typeof field === 'string') {
          continue;
        }
        if (typeof field === 'object' && field !== null) {
          if (!field.name && !field.pattern) {
            throw new ValidationError('field 规则对象必须包含 name 或 pattern', {
              filePath,
              field: 'fields'
            });
          }
          continue;
        }
        throw new ValidationError('field 规则必须是字符串或对象', {
          filePath,
          field: 'fields'
        });
      }
    }

    if (rules.patterns) {
      if (!Array.isArray(rules.patterns)) {
        throw new ValidationError('patterns 规则必须是数组', {
          filePath,
          field: 'patterns'
        });
      }
      
      for (const pattern of rules.patterns) {
        if (typeof pattern !== 'string') {
          throw new ValidationError('pattern 必须是字符串', {
            filePath,
            field: 'patterns'
          });
        }
        try {
          new RegExp(pattern);
        } catch (error) {
          throw new ValidationError(`无效的正则表达式: ${pattern}`, {
            filePath,
            field: 'patterns',
            originalError: error.message
          });
        }
      }
    }
  }

  normalizeRules(rules) {
    const normalized = {
      endpoints: [],
      fields: [],
      patterns: []
    };

    if (rules.endpoints) {
      for (const endpoint of rules.endpoints) {
        if (typeof endpoint === 'string') {
          const parts = endpoint.split(' ');
          if (parts.length === 2) {
            normalized.endpoints.push({
              method: parts[0].toUpperCase(),
              path: parts[1]
            });
          } else {
            normalized.endpoints.push({
              path: endpoint
            });
          }
        } else {
          normalized.endpoints.push({
            method: endpoint.method?.toUpperCase(),
            path: endpoint.path
          });
        }
      }
    }

    if (rules.fields) {
      for (const field of rules.fields) {
        if (typeof field === 'string') {
          normalized.fields.push({
            name: field,
            endpoint: null
          });
        } else {
          normalized.fields.push({
            name: field.name,
            pattern: field.pattern ? new RegExp(field.pattern) : null,
            endpoint: field.endpoint || null,
            method: field.method?.toUpperCase()
          });
        }
      }
    }

    if (rules.patterns) {
      for (const pattern of rules.patterns) {
        normalized.patterns.push(new RegExp(pattern));
      }
    }

    return normalized;
  }

  shouldIgnoreEndpoint(method, path) {
    const upperMethod = method.toUpperCase();
    
    for (const rule of this.rules.endpoints) {
      const methodMatch = !rule.method || rule.method === upperMethod;
      const pathMatch = !rule.path || this.matchPath(rule.path, path);
      
      if (methodMatch && pathMatch) {
        return true;
      }
    }

    for (const pattern of this.rules.patterns) {
      if (pattern.test(`${upperMethod} ${path}`)) {
        return true;
      }
    }

    return false;
  }

  shouldIgnoreField(fieldName, method = null, path = null) {
    for (const rule of this.rules.fields) {
      const endpointMatch = this.matchEndpointRule(rule, method, path);
      const nameMatch = this.matchFieldName(rule, fieldName);
      
      if (endpointMatch && nameMatch) {
        return true;
      }
    }

    return false;
  }

  shouldIgnoreIssue(issue) {
    if (issue.endpoint && this.shouldIgnoreEndpoint(issue.endpoint.method, issue.endpoint.path)) {
      return true;
    }

    if (issue.field) {
      const method = issue.endpoint?.method;
      const path = issue.endpoint?.path;
      if (this.shouldIgnoreField(issue.field, method, path)) {
        return true;
      }
    }

    return false;
  }

  matchPath(pattern, actualPath) {
    if (pattern === actualPath) {
      return true;
    }

    const patternParts = pattern.split('/');
    const pathParts = actualPath.split('/');

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart.startsWith('{') && patternPart.endsWith('}')) {
        continue;
      }

      if (patternPart === '*') {
        continue;
      }

      if (patternPart !== pathPart) {
        return false;
      }
    }

    return true;
  }

  matchEndpointRule(rule, method, path) {
    if (!rule.endpoint && !rule.method) {
      return true;
    }

    const methodMatch = !rule.method || !method || rule.method === method.toUpperCase();
    const pathMatch = !rule.endpoint || !path || this.matchPath(rule.endpoint, path);

    return methodMatch && pathMatch;
  }

  matchFieldName(rule, fieldName) {
    if (rule.name && rule.name === fieldName) {
      return true;
    }

    if (rule.pattern && rule.pattern.test(fieldName)) {
      return true;
    }

    return false;
  }

  filterIssues(issues) {
    return issues.filter(issue => !this.shouldIgnoreIssue(issue));
  }
}

module.exports = IgnoreRules;
