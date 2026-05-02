const tinycolor = require('tinycolor2');
const _ = require('lodash');

class TokenAnalyzer {
  constructor() {
    this.allTokens = {};
    this.resolvedTokens = {};
    this.aliasGraph = {};
    this.cycles = [];
  }

  analyze(tokens) {
    this.allTokens = {};
    this.resolvedTokens = {};
    this.aliasGraph = {};
    this.cycles = [];

    this.flattenTokens(tokens, '');
    this.buildAliasGraph();
    this.detectCycles();
    this.resolveAllAliases();

    return {
      allTokens: this.allTokens,
      resolvedTokens: this.resolvedTokens,
      aliasGraph: this.aliasGraph,
      cycles: this.cycles
    };
  }

  flattenTokens(obj, prefix) {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && value.$value !== undefined) {
        this.allTokens[fullPath] = {
          value: value.$value,
          type: value.$type || this.inferType(value.$value),
          description: value.$description || '',
          extensions: value.$extensions || {}
        };
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.flattenTokens(value, fullPath);
      } else {
        this.allTokens[fullPath] = {
          value: value,
          type: this.inferType(value),
          description: '',
          extensions: {}
        };
      }
    }
  }

  inferType(value) {
    if (typeof value === 'string') {
      if (value.startsWith('{') && value.endsWith('}')) {
        return 'alias';
      }
      if (tinycolor(value).isValid()) {
        return 'color';
      }
      if (/\d+(px|rem|em|vh|vw|%)$/.test(value)) {
        return 'dimension';
      }
    }
    if (typeof value === 'number') {
      return 'number';
    }
    return 'string';
  }

  buildAliasGraph() {
    for (const [tokenPath, token] of Object.entries(this.allTokens)) {
      this.aliasGraph[tokenPath] = [];
      
      if (token.type === 'alias') {
        const referencedToken = this.parseAlias(token.value);
        if (referencedToken) {
          this.aliasGraph[tokenPath].push(referencedToken);
        }
      }
      
      const aliasesInValue = this.extractAliasesFromValue(token.value);
      for (const alias of aliasesInValue) {
        if (!this.aliasGraph[tokenPath].includes(alias)) {
          this.aliasGraph[tokenPath].push(alias);
        }
      }
    }
  }

  parseAlias(value) {
    if (typeof value === 'string') {
      const match = value.match(/^\{([^}]+)\}$/);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  extractAliasesFromValue(value) {
    const aliases = [];
    if (typeof value === 'string') {
      const regex = /\{([^}]+)\}/g;
      let match;
      while ((match = regex.exec(value)) !== null) {
        aliases.push(match[1]);
      }
    }
    return aliases;
  }

  detectCycles() {
    const visited = new Set();
    const recStack = new Set();
    const path = [];

    const dfs = (node) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = this.aliasGraph[node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          const cycleIndex = path.indexOf(neighbor);
          const cycle = path.slice(cycleIndex);
          this.cycles.push({
            tokens: cycle,
            message: `循环别名检测: ${cycle.join(' → ')}`
          });
        }
      }

      recStack.delete(node);
      path.pop();
    };

    for (const node of Object.keys(this.aliasGraph)) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }
  }

  resolveAllAliases() {
    for (const tokenPath of Object.keys(this.allTokens)) {
      this.resolvedTokens[tokenPath] = this.resolveToken(tokenPath);
    }
  }

  resolveToken(tokenPath, visited = new Set()) {
    const token = this.allTokens[tokenPath];
    if (!token) {
      return { value: undefined, resolved: false, error: 'Token not found' };
    }

    if (visited.has(tokenPath)) {
      return { 
        value: token.value, 
        resolved: false, 
        error: 'Circular reference detected',
        isCycle: true 
      };
    }

    const newValue = visited;
    newValue.add(tokenPath);

    let resolvedValue = token.value;
    let hasUnresolved = false;
    let resolutionPath = [tokenPath];

    if (token.type === 'alias') {
      const referencedPath = this.parseAlias(token.value);
      if (referencedPath) {
        const resolved = this.resolveToken(referencedPath, newValue);
        if (resolved.resolved) {
          resolvedValue = resolved.value;
          resolutionPath = [...resolutionPath, ...resolved.resolutionPath];
        } else {
          hasUnresolved = true;
        }
      }
    } else if (typeof token.value === 'string') {
      const aliases = this.extractAliasesFromValue(token.value);
      for (const alias of aliases) {
        const resolved = this.resolveToken(alias, newValue);
        if (resolved.resolved && resolved.value !== undefined) {
          resolvedValue = resolvedValue.replace(`{${alias}}`, String(resolved.value));
          resolutionPath = [...resolutionPath, ...resolved.resolutionPath];
        } else {
          hasUnresolved = true;
        }
      }
    }

    const convertedValue = this.convertValue(resolvedValue, token.type);

    return {
      originalValue: token.value,
      value: convertedValue,
      resolved: !hasUnresolved,
      type: token.type,
      convertedType: this.inferType(convertedValue),
      resolutionPath: [...new Set(resolutionPath)],
      token: token
    };
  }

  convertValue(value, type) {
    if (value === undefined || value === null) {
      return value;
    }

    if (type === 'color' || tinycolor(value).isValid()) {
      const color = tinycolor(value);
      if (color.isValid()) {
        return {
          hex: color.toHexString(),
          rgb: color.toRgbString(),
          hsl: color.toHslString(),
          rgba: color.toRgb(),
          hsla: color.toHsl()
        };
      }
    }

    if (type === 'dimension' || typeof value === 'string') {
      const unitMatch = value.match(/^([\d.]+)(px|rem|em|vh|vw|%)$/);
      if (unitMatch) {
        const numericValue = parseFloat(unitMatch[1]);
        const unit = unitMatch[2];
        
        return {
          value: numericValue,
          unit: unit,
          original: value,
          px: unit === 'px' ? numericValue : null,
          rem: unit === 'rem' ? numericValue : null
        };
      }
    }

    if (type === 'number' || typeof value === 'number') {
      return Number(value);
    }

    return value;
  }

  static calculateContrast(color1, color2) {
    const c1 = tinycolor(color1);
    const c2 = tinycolor(color2);
    
    if (!c1.isValid() || !c2.isValid()) {
      return null;
    }

    const getLuminance = (color) => {
      const rgb = color.toRgb();
      const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(c1);
    const l2 = getLuminance(c2);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  static getContrastRisk(ratio) {
    if (ratio === null || ratio === undefined) {
      return null;
    }
    
    if (ratio < 3) {
      return 'high';
    } else if (ratio < 4.5) {
      return 'medium';
    }
    return 'low';
  }
}

module.exports = TokenAnalyzer;