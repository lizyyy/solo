const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class OpenAPIParser {
  async parse(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    
    let spec;
    if (ext === '.json') {
      spec = JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      spec = yaml.load(content);
    } else {
      throw new Error(`不支持的文件格式: ${ext}`);
    }
    
    if (!spec.openapi && !spec.swagger) {
      throw new Error('不是有效的OpenAPI/Swagger文件');
    }
    
    return spec;
  }

  extractEndpoints(spec, filePath) {
    const endpoints = [];
    const basePath = spec.basePath || '';
    
    if (!spec.paths) {
      return endpoints;
    }
    
    for (const [rawPath, pathItem] of Object.entries(spec.paths)) {
      const fullPath = basePath + rawPath;
      
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method.toLowerCase())) {
          const endpoint = this._parseEndpoint(
            method.toUpperCase(),
            fullPath,
            operation,
            pathItem,
            spec,
            filePath,
            rawPath
          );
          endpoints.push(endpoint);
        }
      }
    }
    
    return endpoints;
  }

  _parseEndpoint(method, path, operation, pathItem, spec, filePath, rawPath) {
    const securityRequirements = operation.security || pathItem.security || spec.security || [];
    const roles = this._extractRolesFromSecurity(securityRequirements, spec);
    const authDescription = this._extractAuthDescription(operation, pathItem);
    
    return {
      method,
      path,
      rawPath,
      operationId: operation.operationId || '',
      summary: operation.summary || '',
      description: operation.description || '',
      tags: operation.tags || pathItem.tags || [],
      roles,
      auth: {
        required: securityRequirements.length > 0,
        description: authDescription,
        securitySchemes: this._extractSecuritySchemeNames(securityRequirements)
      },
      source: {
        file: filePath,
        method,
        path: rawPath
      }
    };
  }

  _extractRolesFromSecurity(securityRequirements, spec) {
    const roles = new Set();
    
    for (const securityReq of securityRequirements) {
      for (const [schemeName, scopes] of Object.entries(securityReq)) {
        const scheme = spec.components?.securitySchemes?.[schemeName];
        
        if (scopes && Array.isArray(scopes)) {
          for (const scope of scopes) {
            roles.add(scope);
          }
        }
        
        if (scheme?.['x-roles']) {
          if (Array.isArray(scheme['x-roles'])) {
            scheme['x-roles'].forEach(role => roles.add(role));
          } else if (typeof scheme['x-roles'] === 'string') {
            roles.add(scheme['x-roles']);
          }
        }
      }
    }
    
    return Array.from(roles);
  }

  _extractSecuritySchemeNames(securityRequirements) {
    const names = [];
    for (const securityReq of securityRequirements) {
      names.push(...Object.keys(securityReq));
    }
    return [...new Set(names)];
  }

  _extractAuthDescription(operation, pathItem) {
    const descriptions = [];
    
    if (operation['x-auth-description']) {
      descriptions.push(operation['x-auth-description']);
    }
    if (pathItem?.['x-auth-description']) {
      descriptions.push(pathItem['x-auth-description']);
    }
    
    if (operation.description) {
      const authMatch = operation.description.match(/(?:权限|角色|permission|role|auth).*$/im);
      if (authMatch) {
        descriptions.push(authMatch[0].trim());
      }
    }
    
    return descriptions.join('; ');
  }
}

module.exports = {
  OpenAPIParser
};
