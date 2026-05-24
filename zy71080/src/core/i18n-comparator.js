class I18nComparator {
  constructor(options = {}) {
    this.caseSensitive = options.caseSensitive !== false;
  }

  compare(templateAnalyses) {
    const issues = [];
    const localeVariables = new Map();

    templateAnalyses.forEach(analysis => {
      const varNames = analysis.variables.map(v => this._normalizeName(v.name));
      localeVariables.set(analysis.locale, {
        variables: new Set(varNames),
        rawVariables: analysis.variables
      });
    });

    const locales = Array.from(localeVariables.keys());

    if (locales.length < 2) {
      return {
        issues: [],
        summary: { total: 0, errors: 0, warnings: 0 },
        localeVariables: Object.fromEntries(
          Array.from(localeVariables.entries()).map(([locale, data]) => [
            locale,
            Array.from(data.variables)
          ])
        )
      };
    }

    const baseLocale = locales[0];
    const baseVars = localeVariables.get(baseLocale).variables;

    for (let i = 1; i < locales.length; i++) {
      const locale = locales[i];
      const localeVars = localeVariables.get(locale).variables;

      this._findMissingVariables(baseVars, localeVars, baseLocale, locale, issues);
      this._findExtraVariables(baseVars, localeVars, baseLocale, locale, issues);
    }

    this._checkVariableNameConsistency(templateAnalyses, issues);

    return {
      issues,
      summary: {
        total: issues.length,
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length
      },
      localeVariables: Object.fromEntries(
        Array.from(localeVariables.entries()).map(([locale, data]) => [
          locale,
          Array.from(data.variables)
        ])
      )
    };
  }

  _findMissingVariables(baseVars, localeVars, baseLocale, locale, issues) {
    baseVars.forEach(varName => {
      if (!localeVars.has(varName)) {
        issues.push({
          type: 'i18n_missing_variable',
          severity: 'error',
          variable: varName,
          message: `变量 "${varName}" 在 ${locale} 版本中缺失`,
          details: {
            baseLocale,
            missingLocale: locale,
            variable: varName
          }
        });
      }
    });
  }

  _findExtraVariables(baseVars, localeVars, baseLocale, locale, issues) {
    localeVars.forEach(varName => {
      if (!baseVars.has(varName)) {
        issues.push({
          type: 'i18n_extra_variable',
          severity: 'warning',
          variable: varName,
          message: `变量 "${varName}" 在 ${locale} 版本中存在但 ${baseLocale} 版本中没有`,
          details: {
            extraLocale: locale,
            baseLocale,
            variable: varName
          }
        });
      }
    });
  }

  _checkVariableNameConsistency(templateAnalyses, issues) {
    const allVariableNames = new Map();

    templateAnalyses.forEach(analysis => {
      analysis.variables.forEach(v => {
        const normalized = this._normalizeName(v.name);
        if (!allVariableNames.has(normalized)) {
          allVariableNames.set(normalized, new Set());
        }
        allVariableNames.get(normalized).add(v.rawName);
      });
    });

    allVariableNames.forEach((rawNames, normalized) => {
      if (rawNames.size > 1 && !this.caseSensitive) {
        issues.push({
          type: 'i18n_case_inconsistency',
          severity: 'warning',
          variable: normalized,
          message: `变量 "${normalized}" 在各语言版本中命名不一致`,
          details: {
            variations: Array.from(rawNames),
            locales: templateAnalyses.map(a => a.locale)
          }
        });
      }
    });
  }

  _normalizeName(name) {
    return this.caseSensitive ? name : name.toLowerCase();
  }
}

module.exports = { I18nComparator };
