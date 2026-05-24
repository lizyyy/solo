const fs = require('fs');
const path = require('path');

class VariableManifestParser {
  constructor(options = {}) {
    this.caseSensitive = options.caseSensitive !== false;
  }

  parse(content, filePath = '') {
    let manifest;

    try {
      manifest = JSON.parse(content);
    } catch (e) {
      throw new Error(`变量清单JSON解析失败: ${e.message}`);
    }

    return this._normalizeManifest(manifest, filePath);
  }

  _normalizeManifest(manifest, filePath) {
    const result = {
      variables: [],
      locales: {},
      filePath
    };

    if (manifest.variables && Array.isArray(manifest.variables)) {
      result.variables = manifest.variables.map(v => this._normalizeVariable(v));
    }

    if (manifest.locales && typeof manifest.locales === 'object') {
      for (const [locale, vars] of Object.entries(manifest.locales)) {
        result.locales[locale] = Array.isArray(vars)
          ? vars.map(v => this._normalizeVariable(v))
          : [];
      }
    }

    return result;
  }

  _normalizeVariable(variable) {
    if (typeof variable === 'string') {
      return {
        name: this._normalizeName(variable),
        rawName: variable,
        required: true,
        description: '',
        type: 'string'
      };
    }

    return {
      name: this._normalizeName(variable.name || ''),
      rawName: variable.name || '',
      required: variable.required !== false,
      description: variable.description || '',
      type: variable.type || 'string',
      default: variable.default || null
    };
  }

  _normalizeName(name) {
    return this.caseSensitive ? name : name.toLowerCase();
  }

  static parseFile(filePath, options = {}) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parser = new VariableManifestParser(options);
    return parser.parse(content, filePath);
  }
}

module.exports = { VariableManifestParser };
