const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { table } = require('table');
const { groupIssuesBySeverity, getSeverityOrder, getSeverityLabel } = require('./rules');

function ensureOutputDir(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function generateReport(options) {
  const {
    schemaPath,
    migrationsDir,
    schemaData,
    migrationsData,
    orderingIssues,
    executionResults,
    schemaBefore,
    schemaAfter,
    schemaChanges,
    ruleIssues,
    outputDir,
    timestamp
  } = options;

  const allIssues = [...orderingIssues, ...ruleIssues];
  const groupedIssues = groupIssuesBySeverity(allIssues);

  const summary = {
    timestamp: timestamp || new Date().toISOString(),
    schemaPath,
    migrationsDir,
    migrationCount: migrationsData.files ? migrationsData.files.length : 0,
    executionSuccess: executionResults.success,
    issues: {
      total: allIssues.length,
      critical: groupedIssues.critical.length,
      error: groupedIssues.error.length,
      high: groupedIssues.high.length,
      warning: groupedIssues.warning.length,
      low: groupedIssues.low.length,
      info: groupedIssues.info.length
    },
    schemaChanges: schemaChanges.hasChanges ? {
      addedTables: schemaChanges.addedTables,
      removedTables: schemaChanges.removedTables,
      modifiedTables: Object.keys(schemaChanges.modifiedTables),
      unchangedTables: schemaChanges.unchangedTables
    } : null
  };

  return {
    summary,
    allIssues,
    groupedIssues,
    schemaBefore,
    schemaAfter,
    schemaChanges,
    executionResults,
    migrationsData
  };
}

function writeJSONReport(report, outputPath) {
  const outputDir = path.dirname(outputPath);
  ensureOutputDir(outputDir);

  const jsonContent = JSON.stringify({
    summary: report.summary,
    issues: report.allIssues,
    schemaChanges: report.schemaChanges
  }, null, 2);

  fs.writeFileSync(outputPath, jsonContent, 'utf-8');
  return outputPath;
}

function writeMarkdownReport(report, outputPath) {
  const outputDir = path.dirname(outputPath);
  ensureOutputDir(outputDir);

  let md = '# SQLite 迁移体检报告\n\n';

  md += '## 执行摘要\n\n';
  md += `| 项目 | 值 |\n|------|-----|\n`;
  md += `| 检查时间 | ${report.summary.timestamp} |\n`;
  md += `| Schema 文件 | \`${report.summary.schemaPath}\` |\n`;
  md += `| Migrations 目录 | \`${report.summary.migrationsDir}\` |\n`;
  md += `| 迁移文件数量 | ${report.summary.migrationCount} |\n`;
  md += `| 执行状态 | ${report.summary.executionSuccess ? '✅ 通过' : '❌ 失败'} |\n`;
  md += `| 问题总数 | ${report.summary.issues.total} |\n\n`;

  md += '## 问题统计\n\n';
  md += `| 严重级别 | 数量 |\n|----------|------|\n`;
  const severityOrder = getSeverityOrder();
  for (const severity of severityOrder) {
    const count = report.summary.issues[severity];
    const label = getSeverityLabel(severity);
    if (count > 0 || severity === 'critical' || severity === 'error') {
      md += `| ${label} | ${count} |\n`;
    }
  }
  md += '\n';

  const hasBlockingIssues = 
    report.groupedIssues.critical.length > 0 || 
    report.groupedIssues.error.length > 0;

  if (hasBlockingIssues) {
    md += '## ⚠️ 需要立即关注的问题\n\n';

    for (const severity of ['critical', 'error']) {
      const issues = report.groupedIssues[severity];
      if (issues.length === 0) continue;

      const label = getSeverityLabel(severity);
      const icon = severity === 'critical' ? '🔴' : '🟠';
      md += `### ${icon} ${label} (${issues.length})\n\n`;

      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        md += `#### ${i + 1}. ${issue.message}\n\n`;
        if (issue.migration) {
          md += `- **文件**: \`${issue.migration}\`\n`;
        }
        if (issue.statement) {
          md += `- **SQL**: \`\`\`sql\n${issue.statement}\n\`\`\`\n`;
        }
        if (issue.error) {
          md += `- **错误**: ${issue.error}\n`;
        }
        md += `- **建议**: ${issue.suggestion}\n\n`;
      }
    }
  }

  const hasWarningIssues = 
    report.groupedIssues.high.length > 0 || 
    report.groupedIssues.warning.length > 0 ||
    report.groupedIssues.low.length > 0;

  if (hasWarningIssues) {
    md += '## 📋 其他问题\n\n';

    for (const severity of ['high', 'warning', 'low']) {
      const issues = report.groupedIssues[severity];
      if (issues.length === 0) continue;

      const label = getSeverityLabel(severity);
      const icon = severity === 'high' ? '🟡' : severity === 'warning' ? '🟢' : '⚪';
      md += `### ${icon} ${label} (${issues.length})\n\n`;

      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        md += `#### ${i + 1}. ${issue.message}\n\n`;
        if (issue.migration) {
          md += `- **文件**: \`${issue.migration}\`\n`;
        }
        if (issue.statement) {
          md += `- **SQL**: \`\`\`sql\n${issue.statement}\n\`\`\`\n`;
        }
        md += `- **建议**: ${issue.suggestion}\n\n`;
      }
    }
  }

  if (report.groupedIssues.info.length > 0) {
    md += '## ℹ️ 信息性提示\n\n';
    for (let i = 0; i < report.groupedIssues.info.length; i++) {
      const issue = report.groupedIssues.info[i];
      md += `### ${i + 1}. ${issue.message}\n\n`;
      if (issue.migration) {
        md += `- **文件**: \`${issue.migration}\`\n`;
      }
      md += `- **建议**: ${issue.suggestion}\n\n`;
    }
  }

  if (report.schemaChanges && report.schemaChanges.hasChanges) {
    md += '## 🔄 Schema 变化摘要\n\n';

    if (report.schemaChanges.addedTables.length > 0) {
      md += `### 新增表 (${report.schemaChanges.addedTables.length})\n\n`;
      for (const table of report.schemaChanges.addedTables) {
        md += `- \`${table}\`\n`;
      }
      md += '\n';
    }

    if (report.schemaChanges.removedTables.length > 0) {
      md += `### 删除表 (${report.schemaChanges.removedTables.length})\n\n`;
      for (const table of report.schemaChanges.removedTables) {
        md += `- ⚠️ \`${table}\`\n`;
      }
      md += '\n';
    }

    const modifiedTableNames = Object.keys(report.schemaChanges.modifiedTables);
    if (modifiedTableNames.length > 0) {
      md += `### 修改表 (${modifiedTableNames.length})\n\n`;
      for (const table of modifiedTableNames) {
        const changes = report.schemaChanges.modifiedTables[table];
        md += `#### \`${table}\`\n\n`;

        if (changes.addedColumns && changes.addedColumns.length > 0) {
          md += `- 新增列: ${changes.addedColumns.map(c => `\`${c.name}\``).join(', ')}\n`;
        }
        if (changes.removedColumns && changes.removedColumns.length > 0) {
          md += `- 删除列: ${changes.removedColumns.map(c => `\`${c.name}\``).join(', ')}\n`;
        }
        if (changes.modifiedColumns && Object.keys(changes.modifiedColumns).length > 0) {
          md += `- 修改列: ${Object.keys(changes.modifiedColumns).map(c => `\`${c}\``).join(', ')}\n`;
        }
        if (changes.addedIndexes && changes.addedIndexes.length > 0) {
          md += `- 新增索引: ${changes.addedIndexes.map(i => `\`${i.name}\``).join(', ')}\n`;
        }
        if (changes.removedIndexes && changes.removedIndexes.length > 0) {
          md += `- 删除索引: ${changes.removedIndexes.map(i => `\`${i.name}\``).join(', ')}\n`;
        }
        md += '\n';
      }
    }

    if (report.schemaChanges.unchangedTables.length > 0) {
      md += `### 未变化表 (${report.schemaChanges.unchangedTables.length})\n\n`;
      md += report.schemaChanges.unchangedTables.map(t => `\`${t}\``).join(', ');
      md += '\n\n';
    }
  } else {
    md += '## 🔄 Schema 变化\n\n';
    md += '迁移前后 Schema 无变化。\n\n';
  }

  md += '## 📁 迁移文件列表\n\n';
  if (report.migrationsData && report.migrationsData.orderedFiles) {
    md += `| 编号 | 文件名 | 语句数 |\n|------|--------|--------|\n`;
    for (const file of report.migrationsData.orderedFiles) {
      md += `| ${file.number} | \`${file.filename}\` | ${file.statements.length} |\n`;
    }
  }
  md += '\n';

  fs.writeFileSync(outputPath, md, 'utf-8');
  return outputPath;
}

function printConsoleSummary(report) {
  console.log('\n' + chalk.bold('='.repeat(60)));
  console.log(chalk.bold('           SQLite 迁移体检结果'));
  console.log(chalk.bold('='.repeat(60)) + '\n');

  const summary = report.summary;
  const issues = summary.issues;

  console.log(chalk.underline('执行摘要:'));
  console.log(`  Schema: ${summary.schemaPath}`);
  console.log(`  Migrations: ${summary.migrationsDir} (${summary.migrationCount} 个文件)`);
  console.log(`  执行状态: ${summary.executionSuccess ? chalk.green('✅ 通过') : chalk.red('❌ 失败')}`);
  console.log();

  console.log(chalk.underline('问题统计:'));
  
  const hasCritical = issues.critical > 0;
  const hasError = issues.error > 0;
  const hasHigh = issues.high > 0;
  const hasWarning = issues.warning > 0;

  if (hasCritical) console.log(chalk.red(`  🔴 严重: ${issues.critical}`));
  if (hasError) console.log(chalk.magenta(`  🟠 错误: ${issues.error}`));
  if (hasHigh) console.log(chalk.yellow(`  🟡 高风险: ${issues.high}`));
  if (hasWarning) console.log(chalk.blue(`  🟢 警告: ${issues.warning}`));
  if (issues.low > 0) console.log(chalk.gray(`  ⚪ 低风险: ${issues.low}`));
  if (issues.info > 0) console.log(chalk.gray(`  ℹ️ 信息: ${issues.info}`));
  
  console.log();

  if (report.groupedIssues.critical.length > 0 || report.groupedIssues.error.length > 0) {
    console.log(chalk.red(chalk.bold('⚠️ 发现需要立即关注的问题！')));
    console.log();

    for (const severity of ['critical', 'error']) {
      const items = report.groupedIssues[severity];
      if (items.length === 0) continue;

      const label = getSeverityLabel(severity);
      const color = severity === 'critical' ? chalk.red : chalk.magenta;
      
      console.log(color.bold(`${label} (${items.length}):`));
      
      for (const issue of items.slice(0, 3)) {
        console.log(color(`  • ${issue.message}`));
        if (issue.migration) {
          console.log(color(`    文件: ${issue.migration}`));
        }
        if (issue.error) {
          console.log(color(`    错误: ${issue.error}`));
        }
      }
      
      if (items.length > 3) {
        console.log(color(`  ... 还有 ${items.length - 3} 个问题`));
      }
      console.log();
    }
  }

  if (summary.issues.total === 0 && summary.executionSuccess) {
    console.log(chalk.green(chalk.bold('✅ 所有检查通过！未发现问题。')));
    console.log();
  }

  console.log(chalk.gray('详细报告请查看输出目录中的 JSON 和 Markdown 文件。'));
  console.log();
}

module.exports = {
  generateReport,
  writeJSONReport,
  writeMarkdownReport,
  printConsoleSummary,
  ensureOutputDir
};
