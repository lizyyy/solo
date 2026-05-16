const chalk = require('chalk');
const { table } = require('table');

class TerminalFormatter {
  constructor() {
    this.chalk = chalk;
  }

  format(report) {
    const output = [];

    output.push(this._formatHeader());
    output.push(this._formatStatistics(report.statistics));
    output.push(this._formatSources(report.sources));
    output.push(this._formatVariables(report.variables));
    output.push(this._formatErrors(report.errors));
    output.push(this._formatFooter(report));

    return output.join('\n\n');
  }

  _formatHeader() {
    return [
      chalk.bold.cyan('==========================================='),
      chalk.bold.cyan('        环境变量影子分析报告'),
      chalk.bold.cyan('      ENV Shadow CLI Analysis Report'),
      chalk.bold.cyan('==========================================='),
    ].join('\n');
  }

  _formatStatistics(stats) {
    const rows = [
      [chalk.bold('统计项'), chalk.bold('数值')],
      ['唯一变量总数', stats.totalVariables],
      ['总定义次数', stats.totalDefinitions],
      ['被覆盖变量数', chalk.yellow(stats.overriddenCount)],
      ['无覆盖变量数', chalk.green(stats.noOverrides)],
      ['源文件数量', stats.uniqueSources],
      ['错误数量', stats.errorCount > 0 ? chalk.red(stats.errorCount) : stats.errorCount],
    ];

    return [
      chalk.bold('=== 统计摘要 ==='),
      table(rows, {
        columns: [{ width: 20 }, { width: 30 }],
        border: {
          topBody: '-',
          topJoin: '+',
          topLeft: '+',
          topRight: '+',
          bottomBody: '-',
          bottomJoin: '+',
          bottomLeft: '+',
          bottomRight: '+',
          bodyLeft: '|',
          bodyRight: '|',
          bodyJoin: '|',
          joinBody: '-',
          joinLeft: '+',
          joinRight: '+',
          joinJoin: '+'
        }
      })
    ].join('\n');
  }

  _formatSources(sources) {
    const rows = [[chalk.bold('源文件'), chalk.bold('类型'), chalk.bold('变量数')]];

    sources.forEach(source => {
      const typeLabel = this._getSourceTypeLabel(source.type);
      rows.push([source.path, typeLabel, source.variableCount]);
    });

    return [
      chalk.bold('=== 源文件列表 ==='),
      table(rows, {
        columns: [{ width: 40 }, { width: 12 }, { width: 8 }],
        border: {
          topBody: '-',
          topJoin: '+',
          topLeft: '+',
          topRight: '+',
          bottomBody: '-',
          bottomJoin: '+',
          bottomLeft: '+',
          bottomRight: '+',
          bodyLeft: '|',
          bodyRight: '|',
          bodyJoin: '|',
          joinBody: '-',
          joinLeft: '+',
          joinRight: '+',
          joinJoin: '+'
        }
      })
    ].join('\n');
  }

  _getSourceTypeLabel(type) {
    const labels = {
      dotenv: chalk.blue('dotenv'),
      shell: chalk.green('shell'),
      compose: chalk.magenta('compose')
    };
    return labels[type] || type;
  }

  _formatVariables(variables) {
    const overriddenVars = variables.filter(v => v.isOverridden);
    const normalVars = variables.filter(v => !v.isOverridden);

    const output = [];

    if (overriddenVars.length > 0) {
      output.push(chalk.bold.yellow('=== 被覆盖的变量明细 ==='));
      overriddenVars.slice(0, 20).forEach(v => {
        output.push(this._formatOverriddenVariable(v));
      });
      if (overriddenVars.length > 20) {
        output.push(chalk.gray('  ... 还有 ' + (overriddenVars.length - 20) + ' 个被覆盖变量未显示'));
      }
      output.push('');
    }

    output.push(chalk.bold.green('=== 最终生效的所有变量 ==='));
    const tableRows = [[chalk.bold('变量名'), chalk.bold('最终值'), chalk.bold('来源'), chalk.bold('覆盖次数')]];

    variables.forEach(v => {
      tableRows.push([
        v.name,
        this._truncateValue(v.finalValue, 25),
        this._getSourceTypeLabel(v.winner.sourceType),
        v.overrideCount > 0 ? chalk.yellow(v.overrideCount) : v.overrideCount
      ]);
    });

    output.push(table(tableRows, {
      columns: [{ width: 22 }, { width: 28 }, { width: 12 }, { width: 10 }],
      border: {
        topBody: '-',
        topJoin: '+',
        topLeft: '+',
        topRight: '+',
        bottomBody: '-',
        bottomJoin: '+',
        bottomLeft: '+',
        bottomRight: '+',
        bodyLeft: '|',
        bodyRight: '|',
        bodyJoin: '|',
        joinBody: '-',
        joinLeft: '+',
        joinRight: '+',
        joinJoin: '+'
      }
    }));

    return output.join('\n');
  }

  _formatOverriddenVariable(variable) {
    const lines = [];
    lines.push('\n  ' + chalk.bold(variable.name) + ' = ' + chalk.green(variable.finalValue));
    lines.push('    最终来源: ' + chalk.cyan(variable.winner.source + ':' + (variable.winner.lineNumber || '')));

    variable.overrideChain.forEach(link => {
      const def = link.definition;
      lines.push('    -> 被覆盖: ' + chalk.red(this._truncateValue(def.value, 30)) + ' @ ' + chalk.gray(def.source + ':' + (def.lineNumber || '')));
    });

    return lines.join('\n');
  }

  _formatErrors(errors) {
    if (errors.length === 0) {
      return chalk.bold.green('=== 没有检测到解析错误 ===');
    }

    const output = [];
    output.push(chalk.bold.red('=== 解析错误明细 ==='));

    errors.slice(0, 15).forEach((error, index) => {
      output.push('\n  ' + (index + 1) + '. [' + chalk.red(error.type) + '] ' + error.message);
      if (error.source) {
        output.push('     文件: ' + error.source);
      }
      if (error.lineNumber) {
        output.push('     行号: ' + error.lineNumber);
      }
      if (error.line) {
        output.push('     内容: ' + chalk.gray(this._truncateValue(error.line, 50)));
      }
    });

    if (errors.length > 15) {
      output.push('\n  ' + chalk.gray('... 还有 ' + (errors.length - 15) + ' 个错误未显示'));
    }

    return output.join('\n');
  }

  _formatFooter(report) {
    return [
      chalk.gray('-------------------------------------------'),
      '报告生成时间: ' + report.generatedAt,
      '分析目录: ' + report.inputDirectory,
      chalk.cyan('详细报告请查看输出目录中的 JSON 和 HTML 文件')
    ].join('\n');
  }

  _truncateValue(value, maxLength) {
    const str = String(value);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }
}

module.exports = TerminalFormatter;
