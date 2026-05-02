const fs = require('fs');
const yaml = require('js-yaml');

class RuleValidator {
  constructor(rulesPath) {
    this.rulesPath = rulesPath;
    this.rules = this.loadRules();
  }

  loadRules() {
    if (!fs.existsSync(this.rulesPath)) {
      throw new Error('Rules file not found: ' + this.rulesPath);
    }

    const content = fs.readFileSync(this.rulesPath, 'utf-8');
    const parsed = yaml.load(content);

    return this.normalizeRules(parsed);
  }

  normalizeRules(parsed) {
    if (Array.isArray(parsed)) {
      return { validations: parsed };
    }
    return parsed;
  }

  getRulesForVersion(version) {
    const rules = this.rules.validations || this.rules;
    return rules.filter(rule => {
      if (rule.version) {
        return rule.version === version || rule.version === '*';
      }
      return true;
    });
  }

  validateField(fieldPath, value, rules) {
    const errors = [];
    const fieldName = fieldPath.join('.');

    for (const rule of rules) {
      if (rule.required && (value === undefined || value === null)) {
        errors.push({ field: fieldName, rule: 'required', message: 'Field ' + fieldName + ' is required' });
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rule.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rule.type) {
          errors.push({ field: fieldName, rule: 'type', message: 'Field ' + fieldName + ' expected type ' + rule.type + ', got ' + actualType });
        }
      }

      if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
        errors.push({ field: fieldName, rule: 'min', message: 'Field ' + fieldName + ' must be >= ' + rule.min });
      }

      if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
        errors.push({ field: fieldName, rule: 'max', message: 'Field ' + fieldName + ' must be <= ' + rule.max });
      }

      if (rule.minLength !== undefined && typeof value === 'string' && value.length < rule.minLength) {
        errors.push({ field: fieldName, rule: 'minLength', message: 'Field ' + fieldName + ' length must be >= ' + rule.minLength });
      }

      if (rule.maxLength !== undefined && typeof value === 'string' && value.length > rule.maxLength) {
        errors.push({ field: fieldName, rule: 'maxLength', message: 'Field ' + fieldName + ' length must be <= ' + rule.maxLength });
      }

      if (rule.pattern && typeof value === 'string') {
        const regex = new RegExp(rule.pattern);
        if (!regex.test(value)) {
          errors.push({ field: fieldName, rule: 'pattern', message: 'Field ' + fieldName + ' does not match pattern ' + rule.pattern });
        }
      }

      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({ field: fieldName, rule: 'enum', message: 'Field ' + fieldName + ' must be one of ' + rule.enum.join(', ') });
      }

      if (rule.custom) {
        try {
          const customFn = new Function('value', 'field', rule.custom);
          if (!customFn(value, fieldName)) {
            errors.push({ field: fieldName, rule: 'custom', message: 'Field ' + fieldName + ' failed custom validation' });
          }
        } catch (e) {
          errors.push({ field: fieldName, rule: 'custom', message: 'Custom validation error: ' + e.message });
        }
      }
    }

    return errors;
  }

  flattenObject(obj, prefix = []) {
    const result = [];

    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const fieldPath = [...prefix, key];

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result.push(...this.flattenObject(value, fieldPath));
      } else {
        result.push({ path: fieldPath, value });
      }
    }

    return result;
  }

  validate(data, version) {
    const validations = this.getRulesForVersion(version);
    const errors = [];

    if (validations.length === 0) {
      return { valid: true, errors: [], version };
    }

    const flattened = this.flattenObject(data);

    for (const { path, value } of flattened) {
      const fieldName = path.join('.');

      for (const validation of validations) {
        if (!validation.field) continue;

        const ruleField = validation.field;
        let matches = false;

        if (ruleField === fieldName) {
          matches = true;
        } else if (ruleField.endsWith('.*')) {
          const prefix = ruleField.slice(0, -2);
          matches = fieldName.startsWith(prefix);
        }

        if (matches && validation.rules) {
          const fieldErrors = this.validateField(path, value, validation.rules);
          errors.push(...fieldErrors);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      version,
      validatedAt: new Date().toISOString()
    };
  }

  validateMigrationStep(before, after, version, migrationRules) {
    const stepRules = migrationRules || this.getRulesForVersion(version);
    const diff = this.computeDiff(before, after);
    const errors = [];

    for (const change of diff) {
      const applicableRules = stepRules.filter(r => {
        if (!r.field) return true;
        return change.path.startsWith(r.field) || r.field === '*';
      });

      for (const rule of applicableRules) {
        if (rule.immutable && change.type === 'modified') {
          errors.push({
            field: change.path,
            rule: 'immutable',
            message: 'Immutable field ' + change.path + ' was modified at version ' + version
          });
        }

        if (rule.additiveOnly && change.type === 'modified' && change.oldValue !== undefined && change.newValue === undefined) {
          errors.push({
            field: change.path,
            rule: 'additiveOnly',
            message: 'Field ' + change.path + ' was removed but only additive changes are allowed at version ' + version
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      diff,
      version
    };
  }

  computeDiff(before, after, path) {
    const diff = [];
    const beforeKeys = before ? Object.keys(before) : [];
    const afterKeys = after ? Object.keys(after) : [];
    const allKeys = new Set([...beforeKeys, ...afterKeys]);

    for (const key of allKeys) {
      const currentPath = path ? path + '.' + key : key;
      const beforeValue = before ? before[key] : undefined;
      const afterValue = after ? after[key] : undefined;

      if (beforeValue === undefined && afterValue !== undefined) {
        diff.push({ type: 'added', path: currentPath, newValue: afterValue });
      } else if (beforeValue !== undefined && afterValue === undefined) {
        diff.push({ type: 'removed', path: currentPath, oldValue: beforeValue });
      } else if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        if (typeof beforeValue === 'object' && typeof afterValue === 'object' && beforeValue !== null && afterValue !== null) {
          diff.push(...this.computeDiff(beforeValue, afterValue, currentPath));
        } else {
          diff.push({ type: 'modified', path: currentPath, oldValue: beforeValue, newValue: afterValue });
        }
      }
    }

    return diff;
  }
}

module.exports = RuleValidator;
