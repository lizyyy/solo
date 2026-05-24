const chalk = require('chalk');

class TerminalReporter {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.color = options.color !== false;
  }

  generate(report) {
    const lines = [];

    lines.push(this._generateHeader());
    lines.push(this._generateSummary(report.summary));
    lines.push('');

    if (report.templateResults && report.templateResults.length > 0) {
      lines.push(this._generateTemplateResults(report.templateResults));
    }

    if (report.i18nComparison && report.i18nComparison.issues.length > 0) {
      lines.push(this._generateI18nIssues(report.i18nComparison));
    }

    if (report.renderedSamples && report.renderedSamples.length > 0) {
      lines.push(this._generateRenderSummary(report.renderedSamples));
    }

    lines.push('');
    lines.push(this._generateExitCodeInfo(report.exitCode));

    return lines.join('\n');
  }

  _generateHeader() {
    return chalk.bold.cyan('\n╔══════════════════════════════════════════════╗\n║         邮件模板变量预检报告                  ║\n╚══════════════════════════════════════════════╝\n');
  }

  _generateSummary(summary) {
    const lines = [];
    lines.push(chalk.bold('📊 检查摘要'));
    lines.push('');

    const statusIcon = summary.errors > 0
      ? chalk.red('❌')
      : summary.warnings > 0
        ? chalk.yellow('⚠️')
        : chalk.green('✅');

    const statusText = summary.errors > 0
      ? chalk.red('发现错误')
      : summary.warnings > 0
        ? chalk.yellow('存在警告')
        : chalk.green('全部通过');

    lines.push(`  状态: ${statusIcon} ${statusText}`);
    lines.push(`  扫描模板: ${summary.templatesScanned} 个`);
    lines.push(`  发现变量: ${summary.totalVariables} 个`);

    if (summary.templatesScanned > 1) {
      lines.push(`  语言版本: ${summary.localesCount} 个`);
    }

    lines.push('');
    lines.push(`  ${chalk.red('错误:')} ${summary.errors} 个`);
    lines.push(`  ${chalk.yellow('警告:')} ${summary.warnings} 个`);
    lines.push(`  ${chalk.blue('信息:')} ${summary.info || 0} 个`);

    return lines.join('\n');
  }

  _generateTemplateResults(templateResults) {
    const lines = [];
    lines.push(chalk.bold('\n📄 模板检查详情'));

    templateResults.forEach(result => {
      const locale = result.locale ? ` [${result.locale}]` : '';
      const status = result.validation.summary.errors > 0
        ? chalk.red('❌')
        : result.validation.summary.warnings > 0
          ? chalk.yellow('⚠️')
          : chalk.green('✅');

      lines.push(`\n  ${status} ${result.templatePath}${locale}`);

      if (this.verbose) {
        lines.push(`    变量数: ${result.validation.templateVariables.length}`);
      }

      if (result.validation.issues.length > 0) {
        lines.push('');
        result.validation.issues.forEach(issue => {
          lines.push(this._formatIssue(issue, '    '));
        });
      }
    });

    return lines.join('\n');
  }

  _generateI18nIssues(i18nComparison) {
    const lines = [];
    lines.push(chalk.bold('\n🌐 多语言一致性检查'));

    if (i18nComparison.issues.length === 0) {
      lines.push(`  ${chalk.green('✅')} 所有语言版本变量一致`);
    } else {
      lines.push('');
      i18nComparison.issues.forEach(issue => {
        lines.push(this._formatIssue(issue, '  '));
      });
    }

    return lines.join('\n');
  }

  _generateRenderSummary(renderedSamples) {
    const lines = [];
    lines.push(chalk.bold('\n🎨 样例渲染'));

    renderedSamples.forEach(sample => {
      const locale = sample.locale ? ` [${sample.locale}]` : '';
      const status = sample.renderResult.hasErrors
        ? chalk.red('❌')
        : sample.renderResult.hasWarnings
          ? chalk.yellow('⚠️')
          : chalk.green('✅');

      lines.push(`\n  ${status} ${sample.templatePath}${locale}`);

      if (sample.renderResult.errors.length > 0) {
        sample.renderResult.errors.forEach(err => {
          lines.push(`    ${chalk.red('错误:')} ${err.message}`);
        });
      }

      if (sample.renderResult.warnings.length > 0) {
        sample.renderResult.warnings.forEach(warn => {
          lines.push(`    ${chalk.yellow('警告:')} ${warn.message}`);
        });
      }
    });

    return lines.join('\n');
  }

  _formatIssue(issue, indent = '') {
    const severityColors = {
      error: chalk.red,
      warning: chalk.yellow,
      info: chalk.blue
    };

    const color = severityColors[issue.severity] || chalk.gray;
    const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';

    let line = `${indent}${icon} ${color(issue.message)}`;

    if (this.verbose && issue.details) {
      if (issue.details.occurrences) {
        const lines = issue.details.occurrences
          .slice(0, 3)
          .map(o => o.line ? `第${o.line}行` : '')
          .filter(Boolean)
          .join(', ');
        if (lines) {
          line += `\n${indent}   位置: ${lines}`;
        }
      }
      if (issue.details.variations) {
        line += `\n${indent}   变体: ${issue.details.variations.join(', ')}`;
      }
    }

    return line;
  }

  _generateExitCodeInfo(exitCode) {
    const { exitCodeDescriptions } = require('../constants/exit-codes');
    return chalk.gray(`退出码: ${exitCode} (${exitCodeDescriptions[exitCode] || '未知'})`);
  }
}

module.exports = { TerminalReporter };
