const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { DIFF_TYPES } = require('./json-differ');

class ReportGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './output';
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  }

  ensureOutputDir() {
    const runDir = path.resolve(this.outputDir, `run-${this.timestamp}`);
    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }
    return runDir;
  }

  generateTerminalSummary(results, errors) {
    const lines = [];
    lines.push(chalk.bold.blue('\n╔════════════════════════════════════════════╗'));
    lines.push(chalk.bold.blue('║       JSON 配置差异分析报告                ║'));
    lines.push(chalk.bold.blue('╚════════════════════════════════════════════╝\n'));

    if (errors && errors.length > 0) {
      lines.push(chalk.bold.red(`⚠️  发现 ${errors.length} 个错误:\n`));
      for (const err of errors) {
        lines.push(`  ${chalk.yellow(err.filename)}:`);
        lines.push(`    ${chalk.red(err.error.message)}`);
        if (err.error.line !== null) {
          lines.push(`    位置: ${err.error.line}`);
        }
        lines.push('');
      }
    }

    for (const [key, result] of Object.entries(results)) {
      const summary = result.summary;
      lines.push(chalk.bold.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
      lines.push(chalk.bold(`比较: ${chalk.green(result.baseEnv)} → ${chalk.magenta(result.targetEnv)}`));
      lines.push(chalk.bold.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`));

      lines.push(`  总计差异: ${chalk.bold(summary.total)}`);
      lines.push(`  修改字段: ${chalk.yellow(summary.changed)}`);
      lines.push(`  新增字段: ${chalk.green(summary.added)}`);
      lines.push(`  删除字段: ${chalk.red(summary.removed)}`);
      lines.push(`  数组变更: ${chalk.cyan(summary.arrayChanges)}`);
      lines.push(`  敏感字段: ${chalk.magenta(summary.sensitive)}`);
      lines.push(`  默认值匹配: ${chalk.gray(summary.defaultValue)}\n`);

      const recentDiffs = result.diffs.slice(0, 10);
      for (const diff of recentDiffs) {
        lines.push(this.formatDiffTerminal(diff));
      }

      if (result.diffs.length > 10) {
        lines.push(chalk.gray(`  ... 还有 ${result.diffs.length - 10} 个差异`));
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  formatDiffTerminal(diff) {
    const prefix = this.getDiffPrefix(diff.type);
    const path = chalk.cyan(diff.path);
    let value = '';

    if (diff.type === DIFF_TYPES.CHANGED) {
      const oldVal = diff.isSensitive ? diff.oldValueMasked : JSON.stringify(diff.oldValue);
      const newVal = diff.isSensitive ? diff.newValueMasked : JSON.stringify(diff.newValue);
      value = ` ${chalk.red(oldVal)} → ${chalk.green(newVal)}`;
    } else if (diff.type === DIFF_TYPES.ADDED || diff.type === DIFF_TYPES.ARRAY_ITEM_ADDED) {
      const val = diff.isSensitive ? diff.valueMasked : JSON.stringify(diff.value);
      value = ` ${chalk.green(val)}`;
    } else if (diff.type === DIFF_TYPES.REMOVED || diff.type === DIFF_TYPES.ARRAY_ITEM_REMOVED) {
      const val = diff.isSensitive ? diff.valueMasked : JSON.stringify(diff.value);
      value = ` ${chalk.red(val)}`;
    }

    let notes = [];
    if (diff.isSensitive) notes.push(chalk.magenta('[敏感]'));
    if (diff.isDefaultValue) notes.push(chalk.gray('[默认值]'));
    if (diff.defaultValue !== undefined && !diff.isDefaultValue) {
      notes.push(chalk.gray(`[默认值: ${JSON.stringify(diff.defaultValue)}]`));
    }

    return `  ${prefix} ${path}${value} ${notes.join(' ')}`;
  }

  getDiffPrefix(type) {
    const prefixMap = {
      [DIFF_TYPES.CHANGED]: chalk.yellow('~'),
      [DIFF_TYPES.ADDED]: chalk.green('+'),
      [DIFF_TYPES.REMOVED]: chalk.red('-'),
      [DIFF_TYPES.ARRAY_ITEM_ADDED]: chalk.green('+[]'),
      [DIFF_TYPES.ARRAY_ITEM_REMOVED]: chalk.red('-[]'),
      [DIFF_TYPES.ARRAY_ORDER_CHANGED]: chalk.yellow('↕')
    };
    return prefixMap[type] || '?';
  }

  generateMachineReadable(results, errors) {
    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      },
      errors,
      comparisons: Object.entries(results).map(([key, result]) => ({
        key,
        baseEnv: result.baseEnv,
        targetEnv: result.targetEnv,
        summary: result.summary,
        diffs: result.diffs
      }))
    };
  }

  generateMarkdownReport(results, errors) {
    const lines = [];
    lines.push('# JSON 配置差异分析报告\n');
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`);

    if (errors && errors.length > 0) {
      lines.push('## ⚠️ 错误信息\n');
      for (const err of errors) {
        lines.push(`### ${err.filename}`);
        lines.push(`- **错误类型**: ${err.error.type}`);
        lines.push(`- **错误信息**: ${err.error.message}`);
        if (err.error.line !== null) {
          lines.push(`- **位置**: 字符 ${err.error.line}`);
        }
        lines.push('');
      }
    }

    for (const [key, result] of Object.entries(results)) {
      const summary = result.summary;
      lines.push(`## 比较: ${result.baseEnv} → ${result.targetEnv}\n`);

      lines.push('| 统计项 | 数量 |');
      lines.push('|--------|------|');
      lines.push(`| 总计差异 | ${summary.total} |`);
      lines.push(`| 修改字段 | ${summary.changed} |`);
      lines.push(`| 新增字段 | ${summary.added} |`);
      lines.push(`| 删除字段 | ${summary.removed} |`);
      lines.push(`| 数组变更 | ${summary.arrayChanges} |`);
      lines.push(`| 敏感字段 | ${summary.sensitive} |`);
      lines.push(`| 默认值匹配 | ${summary.defaultValue} |\n`);

      lines.push('### 详细差异\n');
      lines.push('| 类型 | 路径 | 详情 | 备注 |');
      lines.push('|------|------|------|------|');

      for (const diff of result.diffs) {
        const type = this.getDiffTypeName(diff.type);
        const details = this.formatDiffDetails(diff);
        const notes = this.formatDiffNotes(diff);
        lines.push(`| ${type} | \`${diff.path}\` | ${details} | ${notes} |`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('*此报告由 json-config-diff 工具自动生成*');

    return lines.join('\n');
  }

  getDiffTypeName(type) {
    const names = {
      [DIFF_TYPES.CHANGED]: '修改',
      [DIFF_TYPES.ADDED]: '新增',
      [DIFF_TYPES.REMOVED]: '删除',
      [DIFF_TYPES.ARRAY_ITEM_ADDED]: '数组新增',
      [DIFF_TYPES.ARRAY_ITEM_REMOVED]: '数组删除',
      [DIFF_TYPES.ARRAY_ORDER_CHANGED]: '顺序变更'
    };
    return names[type] || type;
  }

  formatDiffDetails(diff) {
    if (diff.type === DIFF_TYPES.CHANGED) {
      const oldVal = diff.isSensitive ? diff.oldValueMasked : JSON.stringify(diff.oldValue);
      const newVal = diff.isSensitive ? diff.newValueMasked : JSON.stringify(diff.newValue);
      return `\`${oldVal}\` → \`${newVal}\``;
    }
    const val = diff.isSensitive ? diff.valueMasked : JSON.stringify(diff.value);
    return `\`${val}\``;
  }

  formatDiffNotes(diff) {
    const notes = [];
    if (diff.isSensitive) notes.push('🔒 敏感');
    if (diff.isDefaultValue) notes.push('📋 默认值');
    if (diff.defaultValue !== undefined && !diff.isDefaultValue) {
      notes.push(`默认值应为: \`${JSON.stringify(diff.defaultValue)}\``);
    }
    return notes.join(', ') || '-';
  }

  writeAllReports(results, errors) {
    const runDir = this.ensureOutputDir();

    const machineData = this.generateMachineReadable(results, errors);
    fs.writeFileSync(
      path.join(runDir, 'diff-result.json'),
      JSON.stringify(machineData, null, 2)
    );

    const markdownReport = this.generateMarkdownReport(results, errors);
    fs.writeFileSync(
      path.join(runDir, 'diff-report.md'),
      markdownReport
    );

    const summary = this.generateTerminalSummary(results, errors);

    return {
      runDir,
      files: ['diff-result.json', 'diff-report.md'],
      summary
    };
  }
}

module.exports = ReportGenerator;