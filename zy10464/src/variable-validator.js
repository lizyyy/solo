const fs = require('fs');

class VariableValidator {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.quiet = options.quiet || false;
  }

  validate(requests, environmentPath) {
    const envVars = this.loadEnvironment(environmentPath);
    const results = {
      environmentFile: environmentPath,
      environmentVariables: envVars,
      totalRequests: requests.length,
      requestsWithVariables: 0,
      requestsWithoutVariables: 0,
      variableReferences: {},
      undefinedVariables: [],
      details: [],
      issues: []
    };

    for (const request of requests) {
      const requestResult = this.validateRequest(request, envVars);
      results.details.push(requestResult);

      if (requestResult.hasVariables) {
        results.requestsWithVariables++;
      } else {
        results.requestsWithoutVariables++;
      }

      for (const [varName, count] of Object.entries(requestResult.variableReferences)) {
        results.variableReferences[varName] = (results.variableReferences[varName] || 0) + count;
      }

      results.undefinedVariables.push(...requestResult.undefinedVariables);
      results.issues.push(...requestResult.issues);
    }

    const uniqueUndefinedVars = [...new Set(results.undefinedVariables.map(v => v.name))];
    results.uniqueUndefinedVariables = uniqueUndefinedVars;

    return results;
  }

  loadEnvironment(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const env = JSON.parse(content);
      
      const variables = {};
      
      if (env.values) {
        for (const value of env.values) {
          if (!value.disabled) {
            variables[value.key] = {
              value: value.value,
              type: value.type,
              enabled: true
            };
          }
        }
      }

      return {
        name: env.name,
        variables
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`环境变量文件 JSON 格式错误: ${error.message}`);
      }
      throw new Error(`无法读取环境变量文件: ${error.message}`);
    }
  }

  validateRequest(request, envVars) {
    const variableReferences = {};
    const undefinedVariables = [];
    const issues = [];

    const urlVariables = this.extractVariables(request.url);
    this.processVariables(urlVariables, 'url', variableReferences, undefinedVariables, envVars, request);

    if (request.eventScripts) {
      for (const script of [...request.eventScripts.test, ...request.eventScripts.prerequest]) {
        const scriptVariables = this.extractVariablesFromScript(script.content);
        this.processVariables(scriptVariables, 'script', variableReferences, undefinedVariables, envVars, request);
      }
    }

    const headers = request.headers || [];
    for (const header of headers) {
      if (header.value) {
        const headerVariables = this.extractVariables(header.value);
        this.processVariables(headerVariables, 'header', variableReferences, undefinedVariables, envVars, request);
      }
    }

    const hasVariables = Object.keys(variableReferences).length > 0;

    return {
      requestId: request.id,
      requestName: request.name,
      requestPath: request.path,
      requestMethod: request.method,
      requestUrl: request.url,
      hasVariables,
      variableReferences,
      undefinedVariables,
      issues,
      sourceFile: request.sourceFile,
      sourceLocation: request.sourceLocation
    };
  }

  extractVariables(text) {
    if (!text) return [];
    
    const variables = [];
    const pattern = /\{\{([^{}]+)\}\}/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      variables.push({
        name: match[1],
        fullMatch: match[0],
        index: match.index
      });
    }

    return variables;
  }

  extractVariablesFromScript(scriptContent) {
    if (!scriptContent) return [];
    
    const variables = [];
    const pmPattern = /pm\.(environment|globals|collectionVariables)\.(get|has)\s*\(\s*["']([^"']+)["']/g;
    const varPattern = /pm\.variables\.(get|has)\s*\(\s*["']([^"']+)["']/g;

    let match;

    while ((match = pmPattern.exec(scriptContent)) !== null) {
      variables.push({
        name: match[3],
        scope: match[1],
        method: match[2],
        index: match.index
      });
    }

    while ((match = varPattern.exec(scriptContent)) !== null) {
      variables.push({
        name: match[2],
        scope: 'variables',
        method: match[1],
        index: match.index
      });
    }

    return variables;
  }

  processVariables(variables, source, variableReferences, undefinedVariables, envVars, request) {
    for (const variable of variables) {
      const varName = variable.name;
      variableReferences[varName] = (variableReferences[varName] || 0) + 1;

      if (!envVars.variables[varName]) {
        const isUndefined = !undefinedVariables.some(v => 
          v.name === varName && v.source === source
        );
        
        if (isUndefined) {
          undefinedVariables.push({
            name: varName,
            source,
            scope: variable.scope || 'template',
            line: this.getLineNumber(request.url, variable.index)
          });
        }
      }
    }
  }

  getLineNumber(content, index) {
    if (!content) return 1;
    return content.substring(0, index).split('\n').length;
  }
}

module.exports = VariableValidator;
