const fs = require('fs');

class RetainerParser {
  constructor(filePath) {
    this.filePath = filePath;
  }

  parse() {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    const data = JSON.parse(content);
    
    return this.analyzeRetainerPaths(data);
  }

  analyzeRetainerPaths(data) {
    const result = {
      meta: {
        generatedAt: data.generatedAt || new Date().toISOString(),
        totalPaths: 0
      },
      paths: [],
      groupedPaths: {},
      suspiciousPaths: [],
      keyRoots: [],
      commonRetainers: [],
      statistics: {}
    };

    if (data.paths) {
      result.paths = data.paths;
      result.meta.totalPaths = data.paths.length;
    } else if (data.retainers) {
      result.paths = data.retainers;
      result.meta.totalPaths = data.retainers.length;
    } else if (Array.isArray(data)) {
      result.paths = data;
      result.meta.totalPaths = data.length;
    }

    result.groupedPaths = this.groupByType(result.paths);
    result.suspiciousPaths = this.findSuspiciousPaths(result.paths);
    result.keyRoots = this.identifyKeyRoots(result.paths);
    result.commonRetainers = this.findCommonRetainers(result.paths);
    result.statistics = this.calculateStatistics(result);

    return result;
  }

  groupByType(paths) {
    const groups = {
      byRootType: {},
      byObjectType: {},
      byPathLength: {}
    };

    for (const path of paths) {
      const rootType = this.getRootType(path);
      const objectType = this.getObjectType(path);
      const pathLength = this.getPathLength(path);

      if (!groups.byRootType[rootType]) {
        groups.byRootType[rootType] = { count: 0, paths: [] };
      }
      groups.byRootType[rootType].count++;
      groups.byRootType[rootType].paths.push(path);

      if (objectType) {
        if (!groups.byObjectType[objectType]) {
          groups.byObjectType[objectType] = { count: 0, paths: [] };
        }
        groups.byObjectType[objectType].count++;
        groups.byObjectType[objectType].paths.push(path);
      }

      const lengthKey = `${pathLength}`;
      if (!groups.byPathLength[lengthKey]) {
        groups.byPathLength[lengthKey] = { count: 0, paths: [] };
      }
      groups.byPathLength[lengthKey].count++;
      groups.byPathLength[lengthKey].paths.push(path);
    }

    return groups;
  }

  getRootType(path) {
    if (path.rootType) return path.rootType;
    if (path.root) {
      if (typeof path.root === 'string') return path.root;
      if (path.root.type) return path.root.type;
      if (path.root.name) return path.root.name;
    }
    if (path.nodes && path.nodes.length > 0) {
      const firstNode = path.nodes[0];
      if (firstNode.type) return firstNode.type;
      if (firstNode.name) return firstNode.name;
    }
    return 'unknown';
  }

  getObjectType(path) {
    if (path.objectType) return path.objectType;
    if (path.object) {
      if (typeof path.object === 'string') return path.object;
      if (path.object.type) return path.object.type;
      if (path.object.name) return path.object.name;
    }
    if (path.nodes && path.nodes.length > 0) {
      const lastNode = path.nodes[path.nodes.length - 1];
      if (lastNode.type) return lastNode.type;
      if (lastNode.name) return lastNode.name;
    }
    return null;
  }

  getPathLength(path) {
    if (path.length !== undefined) return path.length;
    if (path.nodes) return path.nodes.length;
    if (path.steps) return path.steps.length;
    return 1;
  }

  findSuspiciousPaths(paths) {
    const suspicious = [];
    const suspiciousPatterns = [
      {
        pattern: /closure|Closure|anonymous|function/i,
        name: 'Closure 引用',
        description: '闭包可能持有对外部变量的引用',
        severity: 'warning'
      },
      {
        pattern: /EventListener|eventListener|onClick|onChange|addEventListener/i,
        name: '事件监听器',
        description: '事件监听器未正确移除可能导致内存泄漏',
        severity: 'critical'
      },
      {
        pattern: /Timeout|Interval|setTimeout|setInterval/i,
        name: '定时器引用',
        description: '定时器未清理可能导致持续引用',
        severity: 'warning'
      },
      {
        pattern: /Promise|promise/i,
        name: 'Promise 引用',
        description: '未完成的 Promise 可能持有引用',
        severity: 'warning'
      },
      {
        pattern: /WeakRef|weakRef|FinalizationRegistry/i,
        name: 'WeakRef/FinalizationRegistry 引用',
        description: 'WeakRef 和 FinalizationRegistry 的使用需要特别关注',
        severity: 'warning'
      },
      {
        pattern: /ArrayBuffer|Buffer|Uint8Array|Int32Array/i,
        name: 'Buffer/ArrayBuffer 引用',
        description: '大量的 Buffer 对象可能导致原生内存泄漏',
        severity: 'warning'
      },
      {
        pattern: /global|window|globalThis/i,
        name: '全局对象引用',
        description: '全局对象上的引用不会被释放',
        severity: 'critical'
      },
      {
        pattern: /cache|Cache|storage|Storage/i,
        name: '缓存/存储引用',
        description: '缓存可能无限增长',
        severity: 'warning'
      },
      {
        pattern: /pool|Pool|objectPool/i,
        name: '对象池引用',
        description: '对象池可能配置不当导致内存浪费',
        severity: 'warning'
      }
    ];

    for (const path of paths) {
      const pathString = this.pathToString(path);
      const matchedPatterns = [];

      for (const pattern of suspiciousPatterns) {
        if (pattern.pattern.test(pathString)) {
          matchedPatterns.push({
            name: pattern.name,
            description: pattern.description,
            severity: pattern.severity
          });
        }
      }

      if (matchedPatterns.length > 0) {
        suspicious.push({
          path: path,
          pathString: pathString,
          matchedPatterns: matchedPatterns,
          highestSeverity: matchedPatterns.reduce((max, p) => 
            this.severityToNumber(p.severity) > this.severityToNumber(max) ? p.severity : max
          , 'info')
        });
      }
    }

    return suspicious.sort((a, b) => 
      this.severityToNumber(b.highestSeverity) - this.severityToNumber(a.highestSeverity)
    );
  }

  pathToString(path) {
    if (typeof path === 'string') return path;
    if (path.nodes) {
      return path.nodes.map(n => n.type || n.name || '').join(' -> ');
    }
    if (path.steps) {
      return path.steps.map(s => s.type || s.name || s.property || '').join(' -> ');
    }
    return JSON.stringify(path);
  }

  severityToNumber(severity) {
    const map = { 'critical': 3, 'warning': 2, 'info': 1 };
    return map[severity] || 0;
  }

  identifyKeyRoots(paths) {
    const rootCounts = {};
    const commonRootTypes = [
      'system / (Global handles)',
      '(Global properties)',
      '(DOM bindings)',
      '(Detached DOM tree)',
      '(Code)',
      '(Scripts)',
      '(strings)',
      '(array)',
      '(object)',
      '(closure)',
      '(regexp)'
    ];

    for (const path of paths) {
      const rootType = this.getRootType(path);
      if (!rootCounts[rootType]) {
        rootCounts[rootType] = 0;
      }
      rootCounts[rootType]++;
    }

    const roots = Object.entries(rootCounts).map(([type, count]) => ({
      type,
      count,
      isCommon: commonRootTypes.some(ct => 
        type.toLowerCase().includes(ct.toLowerCase().replace(/[()]/g, ''))
      )
    })).sort((a, b) => b.count - a.count);

    return roots;
  }

  findCommonRetainers(paths) {
    const retainerCounts = {};

    for (const path of paths) {
      const retainers = this.extractRetainers(path);
      for (const retainer of retainers) {
        const key = `${retainer.type || ''}:${retainer.property || ''}:${retainer.name || ''}`;
        if (!retainerCounts[key]) {
          retainerCounts[key] = { retainer, count: 0 };
        }
        retainerCounts[key].count++;
      }
    }

    return Object.values(retainerCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  extractRetainers(path) {
    const retainers = [];
    
    if (path.nodes) {
      for (let i = 0; i < path.nodes.length - 1; i++) {
        retainers.push({
          type: path.nodes[i].type,
          name: path.nodes[i].name,
          property: path.nodes[i].property,
          node: path.nodes[i]
        });
      }
    }
    
    if (path.steps) {
      for (const step of path.steps) {
        retainers.push({
          type: step.type,
          name: step.name,
          property: step.property,
          step
        });
      }
    }

    return retainers;
  }

  calculateStatistics(result) {
    const stats = {
      totalPaths: result.meta.totalPaths,
      suspiciousPaths: result.suspiciousPaths.length,
      criticalPaths: result.suspiciousPaths.filter(p => p.highestSeverity === 'critical').length,
      warningPaths: result.suspiciousPaths.filter(p => p.highestSeverity === 'warning').length,
      byRootType: {},
      byObjectType: {},
      avgPathLength: 0
    };

    if (result.groupedPaths.byRootType) {
      for (const [type, data] of Object.entries(result.groupedPaths.byRootType)) {
        stats.byRootType[type] = data.count;
      }
    }

    if (result.groupedPaths.byObjectType) {
      for (const [type, data] of Object.entries(result.groupedPaths.byObjectType)) {
        stats.byObjectType[type] = data.count;
      }
    }

    if (result.paths.length > 0) {
      const totalLength = result.paths.reduce((sum, path) => sum + this.getPathLength(path), 0);
      stats.avgPathLength = totalLength / result.paths.length;
    }

    return stats;
  }
}

module.exports = RetainerParser;
