const _ = require('lodash');
const { DIFF_TYPES } = require('./json-differ');

class DiffProcessor {
  constructor(options = {}) {
    this.sensitivePatterns = this.parsePatterns(options.sensitivePatterns || []);
    this.defaultValues = options.defaultValues || {};
    this.maskChar = options.maskChar || '*';
    this.maskLength = options.maskLength || 8;
  }

  parsePatterns(patterns) {
    return patterns.map(p => {
      if (p instanceof RegExp) return p;
      if (typeof p === 'string') {
        return new RegExp(p.replace(/\*/g, '.*'), 'i');
      }
      return p;
    });
  }

  isSensitivePath(path) {
    return this.sensitivePatterns.some(pattern => pattern.test(path));
  }

  maskSensitive(value) {
    if (value === null || value === undefined) return value;
    const str = String(value);
    if (str.length <= 2) {
      return this.maskChar.repeat(this.maskLength);
    }
    const showFirst = Math.ceil(str.length * 0.2);
    const showLast = Math.floor(str.length * 0.2);
    return str.slice(0, showFirst) + this.maskChar.repeat(this.maskLength) + str.slice(-showLast);
  }

  getDefaultValue(path) {
    for (const [pattern, value] of Object.entries(this.defaultValues)) {
      if (path === pattern || path.match(new RegExp(`^${pattern.replace(/\*/g, '.*')}$`))) {
        return value;
      }
    }
    return undefined;
  }

  processDiffs(diffs) {
    return diffs.map(diff => this.processDiff(diff));
  }

  processDiff(diff) {
    const result = { ...diff };
    const path = diff.path;

    if (this.isSensitivePath(path)) {
      result.isSensitive = true;
      if (diff.oldValue !== undefined) {
        result.oldValueMasked = this.maskSensitive(diff.oldValue);
        result.oldValueRaw = diff.oldValue;
      }
      if (diff.newValue !== undefined) {
        result.newValueMasked = this.maskSensitive(diff.newValue);
        result.newValueRaw = diff.newValue;
      }
      if (diff.value !== undefined) {
        result.valueMasked = this.maskSensitive(diff.value);
        result.valueRaw = diff.value;
      }
    }

    const defaultValue = this.getDefaultValue(path);
    if (defaultValue !== undefined) {
      result.defaultValue = defaultValue;
      result.isDefaultValue = _.isEqual(
        diff.newValue !== undefined ? diff.newValue : diff.value,
        defaultValue
      );
    }

    return result;
  }

  maskConfigValues(config, path = '') {
    if (_.isArray(config)) {
      return config.map((item, index) =>
        this.maskConfigValues(item, `${path}[${index}]`)
      );
    }

    if (_.isObject(config)) {
      const result = {};
      for (const [key, value] of Object.entries(config)) {
        const currentPath = path ? `${path}.${key}` : key;
        result[key] = this.maskConfigValues(value, currentPath);
      }
      return result;
    }

    if (this.isSensitivePath(path)) {
      return this.maskSensitive(config);
    }

    return config;
  }

  processMultiEnvDiff(multiDiffResults) {
    const results = {};
    for (const [key, diffResult] of Object.entries(multiDiffResults)) {
      results[key] = {
        ...diffResult,
        diffs: this.processDiffs(diffResult.diffs)
      };
    }
    return results;
  }

  summarizeDiffs(diffs) {
    const summary = {
      total: diffs.length,
      byType: {},
      sensitive: 0,
      defaultValue: 0,
      changed: 0,
      added: 0,
      removed: 0,
      arrayChanges: 0
    };

    for (const diff of diffs) {
      const type = diff.type;
      summary.byType[type] = (summary.byType[type] || 0) + 1;

      if (diff.isSensitive) summary.sensitive++;
      if (diff.isDefaultValue) summary.defaultValue++;

      if (type === DIFF_TYPES.CHANGED) summary.changed++;
      if (type === DIFF_TYPES.ADDED) summary.added++;
      if (type === DIFF_TYPES.REMOVED) summary.removed++;
      if (type.startsWith('array_')) summary.arrayChanges++;
    }

    return summary;
  }
}

module.exports = DiffProcessor;