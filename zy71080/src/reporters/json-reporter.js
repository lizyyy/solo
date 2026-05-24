const fs = require('fs');
const path = require('path');

class JsonReporter {
  generate(report) {
    return JSON.stringify(this._normalizeReport(report), null, 2);
  }

  writeToFile(report, filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, this.generate(report), 'utf-8');
  }

  _normalizeReport(report) {
    return {
      meta: {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        tool: 'email-template-lint'
      },
      summary: report.summary,
      exitCode: report.exitCode,
      templateResults: (report.templateResults || []).map(r => ({
        templatePath: r.templatePath,
        locale: r.locale,
        analysis: {
          variables: r.analysis.variables,
          conditionalVariables: r.analysis.conditionalVariables,
          blocks: r.analysis.blocks
        },
        validation: {
          summary: r.validation.summary,
          issues: r.validation.issues
        }
      })),
      i18nComparison: report.i18nComparison ? {
        summary: report.i18nComparison.summary,
        issues: report.i18nComparison.issues,
        localeVariables: report.i18nComparison.localeVariables
      } : null,
      renderedSamples: (report.renderedSamples || []).map(s => ({
        templatePath: s.templatePath,
        locale: s.locale,
        renderResult: {
          hasErrors: s.renderResult.hasErrors,
          hasWarnings: s.renderResult.hasWarnings,
          errors: s.renderResult.errors,
          warnings: s.renderResult.warnings
        },
        previewPath: s.previewPath
      }))
    };
  }
}

module.exports = { JsonReporter };
