class VariableValidator {
  constructor(options = {}) {
    this.caseSensitive = options.caseSensitive !== false;
  }

  validate(templateAnalysis, manifest = null, sampleData = null, locale = null) {
    const issues = [];
    const templateVariables = templateAnalysis.variables;
    const conditionalVariables = templateAnalysis.conditionalVariables;
    const blocks = templateAnalysis.blocks || [];

    this._checkCaseInconsistencies(templateVariables, issues);
    this._checkConditionalVariables(blocks, issues);

    if (manifest) {
      this._compareWithManifest(templateVariables, manifest, locale, issues);
    }

    if (sampleData) {
      this._compareWithSampleData(templateVariables, blocks, sampleData, locale, issues);
    }

    const missingVariables = issues.filter(i => i.type === 'missing_variable');
    const extraVariables = issues.filter(i => i.type === 'extra_variable');
    const caseIssues = issues.filter(i => i.type === 'case_inconsistency');
    const conditionalIssues = issues.filter(i => i.type === 'conditional_issue');
    const defaultIssues = issues.filter(i => i.type === 'default_value_mismatch');
    const missingConditionalControls = issues.filter(i => i.type === 'missing_conditional_control');

    return {
      issues,
      summary: {
        total: issues.length,
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        missingVariables: missingVariables.length,
        extraVariables: extraVariables.length,
        caseIssues: caseIssues.length,
        conditionalIssues: conditionalIssues.length,
        defaultIssues: defaultIssues.length,
        missingConditionalControls: missingConditionalControls.length
      },
      templateVariables: templateVariables.map(v => ({
        name: v.name,
        rawName: v.rawName,
        hasDefault: v.hasDefault,
        occurrences: v.occurrences.length,
        isConditional: conditionalVariables.includes(v.name)
      }))
    };
  }

  _checkCaseInconsistencies(variables, issues) {
    variables.forEach(variable => {
      if (variable.hasCaseInconsistency && !this.caseSensitive) {
        issues.push({
          type: 'case_inconsistency',
          severity: 'warning',
          variable: variable.name,
          message: `变量 "${variable.name}" 存在大小写不一致`,
          details: {
            variations: variable.caseVariations,
            occurrences: variable.occurrences.map(o => ({
              line: o.line,
              rawName: o.rawName
            }))
          }
        });
      }
    });
  }

  _checkConditionalVariables(blocks, issues) {
    blocks.forEach(block => {
      block.variablesInCondition.forEach(varName => {
        const allVars = [
          ...block.variablesInIf,
          ...block.variablesInElse
        ];

        if (!allVars.length) {
          issues.push({
            type: 'conditional_issue',
            severity: 'warning',
            variable: varName,
            message: `条件块中的变量 "${varName}" 控制的内容为空`,
            details: {
              condition: block.condition,
              blockId: block.id
            }
          });
        }
      });
    });
  }

  _compareWithManifest(templateVariables, manifest, locale, issues) {
    const manifestVariables = this._getManifestVariables(manifest, locale);
    const manifestVarMap = new Map(manifestVariables.map(v => [this._normalizeName(v.name), v]));
    const templateVarMap = new Map(templateVariables.map(v => [this._normalizeName(v.name), v]));

    templateVariables.forEach(templateVar => {
      const normalizedName = this._normalizeName(templateVar.name);
      const manifestVar = manifestVarMap.get(normalizedName);

      if (!manifestVar) {
        issues.push({
          type: 'extra_variable',
          severity: 'warning',
          variable: templateVar.name,
          message: `模板中使用的变量 "${templateVar.rawName}" 不在变量清单中`,
          details: {
            occurrences: templateVar.occurrences.map(o => ({
              line: o.line,
              context: o.context
            }))
          }
        });
      } else if (manifestVar.required && !templateVar.hasDefault) {
        issues.push({
          type: 'missing_default',
          severity: 'warning',
          variable: templateVar.name,
          message: `必填变量 "${templateVar.rawName}" 建议设置默认值`,
          details: {
            description: manifestVar.description,
            occurrences: templateVar.occurrences.map(o => o.line)
          }
        });
      } else if (manifestVar.default && templateVar.defaultValue !== manifestVar.default) {
        issues.push({
          type: 'default_value_mismatch',
          severity: 'info',
          variable: templateVar.name,
          message: `变量 "${templateVar.rawName}" 的默认值与清单不一致`,
          details: {
            templateDefault: templateVar.defaultValue,
            manifestDefault: manifestVar.default
          }
        });
      }
    });

    manifestVariables.forEach(manifestVar => {
      const normalizedName = this._normalizeName(manifestVar.name);
      if (!templateVarMap.has(normalizedName) && manifestVar.required) {
        issues.push({
          type: 'missing_variable',
          severity: 'error',
          variable: manifestVar.name,
          message: `必填变量 "${manifestVar.rawName}" 未在模板中使用`,
          details: {
            description: manifestVar.description,
            required: manifestVar.required
          }
        });
      }
    });
  }

  _compareWithSampleData(templateVariables, blocks, sampleData, locale, issues) {
    const data = locale && sampleData.data[locale]
      ? sampleData.data[locale]
      : sampleData.data;

    const sampleVarMap = this._flattenObject(data);

    templateVariables.forEach(templateVar => {
      const normalizedName = this._normalizeName(templateVar.name);
      const hasSample = sampleVarMap.has(normalizedName);

      if (!hasSample && !templateVar.hasDefault) {
        issues.push({
          type: 'missing_sample',
          severity: 'warning',
          variable: templateVar.name,
          message: `变量 "${templateVar.rawName}" 在样例数据中缺失且无默认值`,
          details: {
            occurrences: templateVar.occurrences.map(o => o.line)
          }
        });
      }
    });

    blocks.forEach(block => {
      block.variablesInCondition.forEach(varName => {
        const normalizedName = this._normalizeName(varName);
        const hasSample = sampleVarMap.has(normalizedName);

        if (!hasSample) {
          issues.push({
            type: 'missing_conditional_control',
            severity: 'error',
            variable: varName,
            message: `条件块控制变量 "${varName}" 在样例数据中缺失，将静默走 false 分支`,
            details: {
              condition: block.condition,
              blockId: block.id
            }
          });
        }
      });
    });
  }

  _getManifestVariables(manifest, locale) {
    if (locale && manifest.locales[locale]) {
      return [...manifest.variables, ...manifest.locales[locale]];
    }
    return manifest.variables;
  }

  _normalizeName(name) {
    return this.caseSensitive ? name : name.toLowerCase();
  }

  _flattenObject(obj, prefix = '') {
    const result = new Map();

    if (!obj || typeof obj !== 'object') {
      return result;
    }

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      result.set(this._normalizeName(fullKey), value);

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = this._flattenObject(value, fullKey);
        nested.forEach((v, k) => result.set(k, v));
      }
    }

    return result;
  }
}

module.exports = { VariableValidator };
