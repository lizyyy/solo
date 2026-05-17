const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function printSummary(stats) {
  const { summary } = stats;
  
  console.log('\n' + chalk.bold.blue('='.repeat(60)));
  console.log(chalk.bold.blue('           数据库表注释检查报告'));
  console.log(chalk.bold.blue('='.repeat(60)) + '\n');
  
  console.log(chalk.bold('📊 概览统计:'));
  console.log(`  总表数: ${summary.totalTables}`);
  console.log(`  总字段数: ${summary.totalColumns}`);
  console.log(`  解析异常行数: ${summary.badLines}`);
  console.log('');
  
  if (summary.tablesWithMissingComment > 0 || summary.columnsWithMissingComment > 0) {
    console.log(chalk.bold.yellow('⚠️  缺失注释:'));
    console.log(`  表注释缺失: ${chalk.yellow.bold(summary.tablesWithMissingComment)} 个`);
    console.log(`  字段注释缺失: ${chalk.yellow.bold(summary.columnsWithMissingComment)} 个`);
    console.log('');
  }
  
  if (summary.conflictingTableComments > 0 || summary.conflictingColumnComments > 0) {
    console.log(chalk.bold.red('❌ 注释矛盾:'));
    console.log(`  表注释矛盾: ${chalk.red.bold(summary.conflictingTableComments)} 组`);
    console.log(`  字段注释矛盾: ${chalk.red.bold(summary.conflictingColumnComments)} 组`);
    console.log('');
  }
  
  if (summary.duplicateTableComments > 0 || summary.duplicateColumnComments > 0) {
    console.log(chalk.bold.cyan('🔄 重复注释:'));
    console.log(`  表重复注释: ${chalk.cyan.bold(summary.duplicateTableComments)} 组`);
    console.log(`  字段重复注释: ${chalk.cyan.bold(summary.duplicateColumnComments)} 组`);
    console.log('');
  }
  
  if (stats.missingComments.tables.length > 0) {
    console.log(chalk.bold.yellow('\n📋 表注释缺失详情:'));
    for (const item of stats.missingComments.tables) {
      console.log(`  • ${chalk.yellow(item.table)} - ${item.filePath}:${item.line}`);
    }
  }
  
  if (stats.missingComments.columns.length > 0) {
    console.log(chalk.bold.yellow('\n📋 字段注释缺失详情:'));
    for (const item of stats.missingComments.columns.slice(0, 20)) {
      console.log(`  • ${chalk.yellow(item.table + '.' + item.column)} - ${item.filePath}:${item.line}`);
    }
    if (stats.missingComments.columns.length > 20) {
      console.log(`  ... 还有 ${stats.missingComments.columns.length - 20} 个`);
    }
  }
  
  if (stats.conflictingComments.tables.length > 0) {
    console.log(chalk.bold.red('\n⚔️  表注释矛盾详情:'));
    for (const item of stats.conflictingComments.tables) {
      console.log(`  • 表: ${chalk.red.bold(item.table)}`);
      for (const c of item.comments) {
        console.log(`    - "${c.comment}" (${c.filePath}:${c.line})`);
      }
    }
  }
  
  if (stats.conflictingComments.columns.length > 0) {
    console.log(chalk.bold.red('\n⚔️  字段注释矛盾详情:'));
    for (const item of stats.conflictingComments.columns) {
      console.log(`  • 字段: ${chalk.red.bold(item.column)}`);
      for (const c of item.comments) {
        console.log(`    - "${c.comment}" (${c.filePath}:${c.line})`);
      }
    }
  }
  
  if (stats.badLines.length > 0) {
    console.log(chalk.bold.magenta('\n⚠️  解析异常行:'));
    for (const item of stats.badLines.slice(0, 10)) {
      console.log(`  • ${item.filePath}:${item.line}`);
      console.log(`    原因: ${item.reason}`);
      if (item.content) {
        console.log(`    内容: ${item.content.trim().substring(0, 80)}`);
      }
    }
    if (stats.badLines.length > 10) {
      console.log(`  ... 还有 ${stats.badLines.length - 10} 行异常`);
    }
  }
  
  console.log('\n' + chalk.bold.blue('='.repeat(60)));
  
  if (summary.hasIssues) {
    console.log(chalk.bold.red('❌ 发现问题，请查看详细报告并修复。'));
  } else {
    console.log(chalk.bold.green('✅ 所有检查通过！'));
  }
  console.log('');
}

function exportJSON(stats, outputPath) {
  const jsonContent = JSON.stringify(stats, null, 2);
  fs.writeFileSync(outputPath, jsonContent, 'utf8');
  console.log(chalk.green(`✓ JSON报告已导出: ${outputPath}`));
}

function exportMarkdown(stats, outputPath) {
  let md = '# 数据库表注释检查报告\n\n';
  md += `生成时间: ${new Date().toLocaleString()}\n\n`;
  
  md += '## 📊 概览统计\n\n';
  md += '| 指标 | 数值 |\n';
  md += '|------|------|\n';
  md += `| 总表数 | ${stats.summary.totalTables} |\n`;
  md += `| 总字段数 | ${stats.summary.totalColumns} |\n`;
  md += `| 表注释缺失 | ${stats.summary.tablesWithMissingComment} |\n`;
  md += `| 字段注释缺失 | ${stats.summary.columnsWithMissingComment} |\n`;
  md += `| 表注释矛盾 | ${stats.summary.conflictingTableComments} |\n`;
  md += `| 字段注释矛盾 | ${stats.summary.conflictingColumnComments} |\n`;
  md += `| 解析异常行数 | ${stats.summary.badLines} |\n\n`;
  
  if (stats.missingComments.tables.length > 0) {
    md += '## ⚠️ 表注释缺失\n\n';
    md += '| 表名 | 文件 | 行号 |\n';
    md += '|------|------|------|\n';
    for (const item of stats.missingComments.tables) {
      md += `| ${item.table} | ${item.filePath} | ${item.line} |\n`;
    }
    md += '\n';
  }
  
  if (stats.missingComments.columns.length > 0) {
    md += '## ⚠️ 字段注释缺失\n\n';
    md += '| 表名.字段名 | 文件 | 行号 |\n';
    md += '|-------------|------|------|\n';
    for (const item of stats.missingComments.columns) {
      md += `| ${item.table}.${item.column} | ${item.filePath} | ${item.line} |\n`;
    }
    md += '\n';
  }
  
  if (stats.conflictingComments.tables.length > 0) {
    md += '## ❌ 表注释矛盾\n\n';
    for (const item of stats.conflictingComments.tables) {
      md += `### ${item.table}\n\n`;
      md += '| 注释 | 文件 | 行号 |\n';
      md += '|------|------|------|\n';
      for (const c of item.comments) {
        md += `| ${c.comment} | ${c.filePath} | ${c.line} |\n`;
      }
      md += '\n';
    }
  }
  
  if (stats.conflictingComments.columns.length > 0) {
    md += '## ❌ 字段注释矛盾\n\n';
    for (const item of stats.conflictingComments.columns) {
      md += `### ${item.column}\n\n`;
      md += '| 注释 | 文件 | 行号 |\n';
      md += '|------|------|------|\n';
      for (const c of item.comments) {
        md += `| ${c.comment} | ${c.filePath} | ${c.line} |\n`;
      }
      md += '\n';
    }
  }
  
  if (stats.duplicateComments.tables.length > 0) {
    md += '## 🔄 表重复注释\n\n';
    for (const item of stats.duplicateComments.tables) {
      md += `### 注释: "${item.comment}"\n\n`;
      md += '| 表名 | 文件 |\n';
      md += '|------|------|\n';
      for (const t of item.tables) {
        md += `| ${t.table} | ${t.filePath} |\n`;
      }
      md += '\n';
    }
  }
  
  if (stats.duplicateComments.columns.length > 0) {
    md += '## 🔄 字段重复注释\n\n';
    for (const item of stats.duplicateComments.columns) {
      md += `### 注释: "${item.comment}"\n\n`;
      md += '| 字段 | 文件 |\n';
      md += '|------|------|\n';
      for (const c of item.columns) {
        md += `| ${c.column} | ${c.filePath} |\n`;
      }
      md += '\n';
    }
  }
  
  if (stats.badLines.length > 0) {
    md += '## ⚠️ 解析异常行\n\n';
    md += '| 文件 | 行号 | 原因 | 内容 |\n';
    md += '|------|------|------|------|\n';
    for (const item of stats.badLines) {
      md += `| ${item.filePath} | ${item.line} | ${item.reason} | ${item.content ? item.content.trim().substring(0, 100) : ''} |\n`;
    }
    md += '\n';
  }
  
  md += '---\n\n';
  md += '*此报告由数据库表注释检查CLI工具自动生成*\n';
  
  fs.writeFileSync(outputPath, md, 'utf8');
  console.log(chalk.green(`✓ Markdown报告已导出: ${outputPath}`));
}

module.exports = {
  printSummary,
  exportJSON,
  exportMarkdown
};
