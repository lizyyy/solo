import { OpenAPIParser } from '../parser/index.js';

export class ContractIndex {
  constructor(spec = null) {
    this.spec = spec;
    this.operations = [];
    this.schemas = {};
    this.operationIdMap = new Map();
    this.pathMethodMap = new Map();
    this.versionGroups = [];

    if (spec) {
      this.buildIndex(spec);
    }
  }

  buildIndex(spec) {
    this.spec = spec;
    this.operations = OpenAPIParser.extractOperations(spec);
    this.schemas = OpenAPIParser.extractSchemas(spec);

    this.operations.forEach((op) => {
      this.operationIdMap.set(op.operationId, op);
      
      const pathMethodKey = `${op.method}:${op.path}`;
      if (!this.pathMethodMap.has(pathMethodKey)) {
        this.pathMethodMap.set(pathMethodKey, []);
      }
      this.pathMethodMap.get(pathMethodKey).push(op);
    });

    this.versionGroups = this.detectVersionGroups();
  }

  detectVersionGroups() {
    const versionPatterns = [
      /^\/v(\d+)\//,
      /^\/api\/v(\d+)\//,
      /^\/(\d{4}-\d{2}-\d{2})\//
    ];

    const versionMap = new Map();

    this.operations.forEach((op) => {
      let version = null;
      
      for (const pattern of versionPatterns) {
        const match = op.path.match(pattern);
        if (match) {
          version = match[1];
          break;
        }
      }

      const basePath = this.getBasePathWithoutVersion(op.path, version);
      const groupKey = `${basePath}:${op.method}`;

      if (!versionMap.has(groupKey)) {
        versionMap.set(groupKey, {
          basePath,
          method: op.method,
          versions: []
        });
      }

      versionMap.get(groupKey).versions.push({
        version,
        path: op.path,
        operation: op
      });
    });

    return Array.from(versionMap.values())
      .filter((group) => group.versions.length > 1)
      .map((group) => ({
        ...group,
        versions: group.versions.sort((a, b) => {
          if (a.version && b.version) {
            return this.compareVersions(a.version, b.version);
          }
          return 0;
        })
      }));
  }

  getBasePathWithoutVersion(path, version) {
    if (!version) return path;
    
    const versionPatterns = [
      new RegExp(`^/v${version}/`),
      new RegExp(`^/api/v${version}/`),
      new RegExp(`^/${version}/`)
    ];

    for (const pattern of versionPatterns) {
      if (pattern.test(path)) {
        return path.replace(pattern, '/');
      }
    }

    return path;
  }

  compareVersions(v1, v2) {
    const isSemantic = /^\d+(\.\d+)*$/.test(v1) && /^\d+(\.\d+)*$/.test(v2);
    
    if (isSemantic) {
      const parts1 = v1.split('.').map(Number);
      const parts2 = v2.split('.').map(Number);
      
      for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 !== p2) return p1 - p2;
      }
      return 0;
    }

    return v1.localeCompare(v2);
  }

  findOperationByRequest(request) {
    const { method, url } = request;
    
    const pathname = this.extractPathname(url);
    
    let matchedOp = null;
    let matchedParams = {};

    const normalizedMethod = method.toUpperCase();

    for (const op of this.operations) {
      if (op.method !== normalizedMethod) continue;

      const match = this.matchPath(pathname, op.path);
      if (match) {
        if (!matchedOp || this.isMoreSpecificPath(op.path, matchedOp.path)) {
          matchedOp = op;
          matchedParams = match.params;
        }
      }
    }

    if (matchedOp) {
      return {
        operation: matchedOp,
        pathParams: matchedParams,
        found: true
      };
    }

    return {
      operation: null,
      pathParams: {},
      found: false,
      suggestions: this.findSuggestions(normalizedMethod, pathname)
    };
  }

  extractPathname(url) {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const parsedUrl = new URL(url);
        return parsedUrl.pathname;
      }
      return url.split('?')[0];
    } catch {
      return url.split('?')[0];
    }
  }

  matchPath(requestPath, templatePath) {
    const requestParts = requestPath.split('/').filter(Boolean);
    const templateParts = templatePath.split('/').filter(Boolean);

    if (requestParts.length !== templateParts.length) {
      return null;
    }

    const params = {};

    for (let i = 0; i < templateParts.length; i++) {
      const templatePart = templateParts[i];
      const requestPart = requestParts[i];

      if (templatePart.startsWith('{') && templatePart.endsWith('}')) {
        const paramName = templatePart.slice(1, -1);
        params[paramName] = requestPart;
      } else if (templatePart !== requestPart) {
        return null;
      }
    }

    return { params };
  }

  isMoreSpecificPath(path1, path2) {
    const parts1 = path1.split('/').filter(Boolean);
    const parts2 = path2.split('/').filter(Boolean);

    let dynamic1 = 0;
    let dynamic2 = 0;

    for (const part of parts1) {
      if (part.startsWith('{') && part.endsWith('}')) dynamic1++;
    }
    for (const part of parts2) {
      if (part.startsWith('{') && part.endsWith('}')) dynamic2++;
    }

    if (dynamic1 !== dynamic2) {
      return dynamic1 < dynamic2;
    }

    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      const isDynamic1 = parts1[i].startsWith('{') && parts1[i].endsWith('}');
      const isDynamic2 = parts2[i].startsWith('{') && parts2[i].endsWith('}');
      
      if (!isDynamic1 && isDynamic2) return true;
      if (isDynamic1 && !isDynamic2) return false;
    }

    return false;
  }

  findSuggestions(method, pathname) {
    const suggestions = [];

    for (const op of this.operations) {
      if (op.method !== method) continue;

      const opParts = op.path.split('/').filter(Boolean);
      const reqParts = pathname.split('/').filter(Boolean);

      const minLength = Math.min(opParts.length, reqParts.length);
      let matches = 0;

      for (let i = 0; i < minLength; i++) {
        if (opParts[i] === reqParts[i] || 
            (opParts[i].startsWith('{') && opParts[i].endsWith('}'))) {
          matches++;
        }
      }

      const similarity = matches / Math.max(opParts.length, reqParts.length);
      
      if (similarity > 0.5) {
        suggestions.push({
          operation: op,
          similarity
        });
      }
    }

    return suggestions
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  getOperationById(operationId) {
    return this.operationIdMap.get(operationId);
  }

  getVersionConflicts() {
    const conflicts = [];

    this.versionGroups.forEach((group) => {
      const latestVersion = group.versions[group.versions.length - 1];
      
      group.versions.forEach((version, index) => {
        if (index < group.versions.length - 1) {
          const nextVersion = group.versions[index + 1];
          
          conflicts.push({
            type: 'version_conflict',
            basePath: group.basePath,
            method: group.method,
            currentVersion: version.version,
            currentPath: version.path,
            newerVersion: nextVersion.version,
            newerPath: nextVersion.path,
            latestVersion: latestVersion.version,
            latestPath: latestVersion.path
          });
        }
      });
    });

    return conflicts;
  }

  getMissingOperationIds() {
    return this.operations
      .filter((op) => !op.pathItem[op.method.toLowerCase()]?.operationId)
      .map((op) => ({
        operationId: op.operationId,
        path: op.path,
        method: op.method,
        generated: true,
        recommendedId: this.generateRecommendedId(op)
      }));
  }

  generateRecommendedId(op) {
    const pathParts = op.path.split('/').filter(Boolean);
    const resourceParts = pathParts
      .filter((p) => !(p.startsWith('{') && p.endsWith('}')))
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1));

    return `${op.method.toLowerCase()}${resourceParts.join('')}`;
  }
}
