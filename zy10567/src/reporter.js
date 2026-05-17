import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export function generateTerminalSummary(result, options = {}) {
  const { noShell = false, onlyConflicts = false } = options;
  const lines = [];

  lines.push(chalk.bold.blue('='.repeat(80)));
  lines.push(chalk.bold.blue('Docker Compose 环境变量合并报告'));
  lines.push(chalk.bold.blue('='.repeat(80)));
  lines.push('');

  lines.push(chalk.bold(`📊 扫描摘要`));
  lines.push(`   服务数量: ${Object.keys(result.services || {}).length}`);
  lines.push(`   总变量数: ${Object.keys(result.finalVariables || {}).length}`);
  lines.push(`   冲突数量: ${(result.conflicts || []).length}`);
  lines.push(`   错误数量: ${(result.errors || []).length}`);
  lines.push(`   警告数量: ${(result.warnings || []).length}`);
  lines.push('');

  if (result.errors && result.errors.length > 0) {
    lines.push(chalk.bold.red('❌ 错误'));
    for (const err of result.errors) {
      const loc = err.lineNumber ? ` (行 ${err.lineNumber})` : (err.line ? ` (行 ${err.line})` : '');
      lines.push(`   ${chalk.red('✗')} ${err.message}${loc}`);
      if (err.file) {
        lines.push(`     ${chalk.gray(err.file)}`);
      }
    }
    lines.push('');
  }

  if (result.warnings && result.warnings.length > 0) {
    lines.push(chalk.bold.yellow('⚠️  警告'));
    for (const warn of result.warnings) {
      const loc = warn.lineNumber ? ` (行 ${warn.lineNumber})` : '';
      lines.push(`   ${chalk.yellow('!')} ${warn.message}${loc}`);
      if (warn.file) {
        lines.push(`     ${chalk.gray(warn.file)}`);
      }
    }
    lines.push('');
  }

  if (result.conflicts && result.conflicts.length > 0) {
    lines.push(chalk.bold.magenta('🔀 变量冲突 (优先级高的覆盖低的)'));
    for (const conflict of result.conflicts) {
      lines.push(`   ${chalk.bold(conflict.key)}`);
      lines.push(`     ✅ ${conflict.winner.sourceName}: ${chalk.green(conflict.winner.value || '(空)')}`);
      for (const overridden of conflict.overridden) {
        const loc = overridden.lineNumber ? ` (行 ${overridden.lineNumber})` : '';
        lines.push(`     ❌ ${overridden.sourceName}: ${chalk.red(overridden.value || '(空)')}${loc}`);
      }
    }
    lines.push('');
  }

  lines.push(chalk.bold.green('🎯 最终环境变量'));
  let sortedVars = Object.entries(result.finalVariables || {})
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (noShell) {
    sortedVars = sortedVars.filter(([_, info]) => info.winner.source !== 'shell');
  }

  if (onlyConflicts) {
    const conflictKeys = new Set(result.conflicts.map(c => c.key));
    sortedVars = sortedVars.filter(([key]) => conflictKeys.has(key));
  }

  for (const [key, info] of sortedVars) {
    const sourceInfo = info.winner.sourceFile 
      ? `${info.winner.sourceName} @ ${path.basename(info.winner.sourceFile)}`
      : info.winner.sourceName;
    lines.push(`   ${chalk.cyan(key)} = ${chalk.green(info.finalValue || '(空)')}`);
    lines.push(`     ${chalk.gray(`来源: ${sourceInfo}`)}`);
  }

  lines.push('');
  lines.push(chalk.bold.blue('='.repeat(80)));
  lines.push(chalk.blue(`优先级: Shell > CLI参数 > .env文件 > compose文件`));
  lines.push(chalk.bold.blue('='.repeat(80)));

  return lines.join('\n');
}

export function generateJsonReport(result) {
  return JSON.stringify(result, null, 2);
}

export function generateMarkdownReport(result) {
  const lines = [];
  const timestamp = new Date().toISOString();

  lines.push('# Docker Compose 环境变量合并报告');
  lines.push('');
  lines.push(`生成时间: ${timestamp}`);
  lines.push('');

  lines.push('## 📊 扫描摘要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 服务数量 | ${Object.keys(result.services || {}).length} |`);
  lines.push(`| 总变量数 | ${Object.keys(result.finalVariables || {}).length} |`);
  lines.push(`| 冲突数量 | ${(result.conflicts || []).length} |`);
  lines.push(`| 错误数量 | ${(result.errors || []).length} |`);
  lines.push(`| 警告数量 | ${(result.warnings || []).length} |`);
  lines.push('');

  if (result.errors && result.errors.length > 0) {
    lines.push('## ❌ 错误');
    lines.push('');
    for (const err of result.errors) {
      const loc = err.lineNumber ? ` (行 ${err.lineNumber})` : '';
      lines.push(`- **${err.type}**: ${err.message}${loc}`);
      if (err.file) {
        lines.push(`  - 文件: \`${err.file}\``);
      }
    }
    lines.push('');
  }

  if (result.warnings && result.warnings.length > 0) {
    lines.push('## ⚠️  警告');
    lines.push('');
    for (const warn of result.warnings) {
      const loc = warn.lineNumber ? ` (行 ${warn.lineNumber})` : '';
      lines.push(`- **${warn.type}**: ${warn.message}${loc}`);
      if (warn.file) {
        lines.push(`  - 文件: \`${warn.file}\``);
      }
    }
    lines.push('');
  }

  if (result.conflicts && result.conflicts.length > 0) {
    lines.push('## 🔀 变量冲突');
    lines.push('');
    lines.push('优先级高的来源会覆盖优先级低的来源。');
    lines.push('');
    for (const conflict of result.conflicts) {
      lines.push(`### ${conflict.key}`);
      lines.push('');
      lines.push('| 状态 | 来源 | 值 | 位置 |');
      lines.push('|------|------|----|------|');
      lines.push(`| ✅ 生效 | ${conflict.winner.sourceName} | \`${conflict.winner.value || '(空)'}\` | - |`);
      for (const overridden of conflict.overridden) {
        const loc = overridden.sourceFile 
          ? `${path.basename(overridden.sourceFile)}:${overridden.lineNumber || '-'}`
          : '-';
        lines.push(`| ❌ 被覆盖 | ${overridden.sourceName} | \`${overridden.value || '(空)'}\` | ${loc} |`);
      }
      lines.push('');
    }
  }

  lines.push('## 🎯 最终环境变量');
  lines.push('');
  lines.push('| 变量名 | 最终值 | 来源 | 位置 |');
  lines.push('|--------|--------|------|------|');

  const sortedVars = Object.entries(result.finalVariables || {})
    .sort((a, b) => a[0].localeCompare(b[0]));

  for (const [key, info] of sortedVars) {
    const loc = info.winner.sourceFile 
      ? `${path.basename(info.winner.sourceFile)}:${info.winner.lineNumber || '-'}`
      : '-';
    lines.push(`| \`${key}\` | \`${info.finalValue || '(空)'}\` | ${info.winner.sourceName} | ${loc} |`);
  }

  lines.push('');
  lines.push('## 优先级说明');
  lines.push('');
  lines.push('1. **Shell环境变量** - 最高优先级');
  lines.push('2. **CLI参数 (-e)**');
  lines.push('3. **.env文件**');
  lines.push('4. **compose文件** - 最低优先级');

  return lines.join('\n');
}

export async function writeReports(result, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  const jsonPath = path.join(outputDir, `env-merge-report-${timestamp}.json`);
  await fs.writeFile(jsonPath, generateJsonReport(result), 'utf8');

  const mdPath = path.join(outputDir, `env-merge-report-${timestamp}.md`);
  await fs.writeFile(mdPath, generateMarkdownReport(result), 'utf8');

  return {
    json: jsonPath,
    markdown: mdPath
  };
}
