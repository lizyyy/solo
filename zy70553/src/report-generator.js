const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { table } = require('table');

class ReportGenerator {
  constructor(options) {
    this.options = options || {};
    this.chalk = new chalk.Instance({ level: 3 });
  }

  generateConsoleReport(matrix) {
    let output = '';
    output += this.generateHeader();
    output += this.generateValidationSection(matrix);
    output += this.generateSummarySection(matrix);
    output += this.generateCategorySection(matrix);
    output += this.generateSdkComparisonTable(matrix);
    return output;
  }

  generateValidationSection(matrix) {
    let output = '';
    
    if ((matrix.validationIssues && matrix.validationIssues.length > 0) || 
        (matrix.malformedLines && matrix.malformedLines.length > 0)) {
      output += this.chalk.bold.red('⚠️ 校验问题\n');
      output += this.chalk.gray('─────────────────────────────────────────────────────────────\n\n');
      
      if (matrix.malformedLines && matrix.malformedLines.length > 0) {
        output += this.chalk.bold.yellow(`  ❌ 非法枚举值 (${matrix.malformedLines.length} 处):\n`);
        for (const ml of matrix.malformedLines) {
          output += this.chalk.yellow(`     行 ${ml.line}: ${ml.rawLine}\n`);
          output += this.chalk.gray(`        原因: ${ml.reason}\n`);
        }
        output += '\n';
      }
      
      if (matrix.validationIssues && matrix.validationIssues.length > 0) {
        output += this.chalk.bold.yellow(`  ⚠️ 校验问题 (${matrix.validationIssues.length} 处):\n`);
        for (const issue of matrix.validationIssues) {
          const severityColor = issue.type === 'duplicate_code' ? this.chalk.red : this.chalk.yellow;
          output += severityColor(`     行 ${issue.line}: [${issue.type}] ${issue.message}\n`);
          output += this.chalk.gray(`        原始内容: ${issue.rawLine}\n`);
        }
        output += '\n';
      }
    }
    
    return output;
  }

  generateHeader() {
    let output = '';
    output += this.chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗\n');
    output += this.chalk.bold.cyan('║') + '                    gRPC 错误码矩阵报告                         ' + this.chalk.bold.cyan('║\n');
    output += this.chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝\n\n');
    return output;
  }

  generateSummarySection(matrix) {
    let output = '';
    output += this.chalk.bold.yellow('📊 摘要信息\n');
    output += this.chalk.gray('─────────────────────────────────────────────────────────────\n');
    
    const summary = matrix.summary;
    const malformedCount = (matrix.malformedLines || []).length;
    const issueCount = (matrix.validationIssues || []).length;
    
    const summaryData = [
      [this.chalk.white('指标'), this.chalk.white('数值')],
      ['总错误码数量', summary.totalCodes.toString()],
      ['SDK语言数量', summary.languages.toString()],
      [this.chalk.green('✅ 可重试(Safe)'), summary.safeRetryCount.toString()],
      [this.chalk.red('❌ 不可重试(Never)'), summary.neverRetryCount.toString()],
      [this.chalk.yellow('⚠️ 有争议(Controversial)'), summary.controversialCount.toString()],
      [this.chalk.magenta('🔀 差异数量'), (summary.differencesCount || 0).toString()]
    ];
    
    if (malformedCount > 0 || issueCount > 0) {
      if (malformedCount > 0) {
        summaryData.push([this.chalk.red('❌ 非法行数量'), malformedCount.toString()]);
      }
      if (issueCount > 0) {
        summaryData.push([this.chalk.red('⚠️ 校验问题数量'), issueCount.toString()]);
      }
    }
    
    output += table(summaryData, {
      columns: [{ width: 25 }, { width: 10 }],
      border: {
        topBody: '─', topJoin: '┬', topLeft: '┌', topRight: '┐',
        bottomBody: '─', bottomJoin: '┴', bottomLeft: '└', bottomRight: '┘',
        bodyLeft: '│', bodyRight: '│', bodyJoin: '│',
        joinBody: '─', joinLeft: '├', joinRight: '┤', joinJoin: '┼'
      }
    });
    output += '\n';
    return output;
  }

  generateCategorySection(matrix) {
    let output = '';
    output += this.chalk.bold.yellow('📂 重试分类\n');
    output += this.chalk.gray('─────────────────────────────────────────────────────────────\n\n');

    output += this.chalk.bold.green('✅ 可重试 (Safe Retry) - 所有SDK一致同意可重试\n');
    if (matrix.categories.safeRetry.length === 0) {
      output += this.chalk.gray('  无\n');
    } else {
      for (const code of matrix.categories.safeRetry) {
        output += this.chalk.green(`  ${code.name} (${code.code})\n`);
      }
    }
    output += '\n';

    output += this.chalk.bold.red('❌ 不可重试 (Never Retry) - 所有SDK一致同意不可重试\n');
    if (matrix.categories.neverRetry.length === 0) {
      output += this.chalk.gray('  无\n');
    } else {
      for (const code of matrix.categories.neverRetry) {
        output += this.chalk.red(`  ${code.name} (${code.code})\n`);
      }
    }
    output += '\n';

    output += this.chalk.bold.yellow('⚠️ 有争议 (Controversial) - SDK之间有不同意见\n');
    if (matrix.categories.controversial.length === 0) {
      output += this.chalk.gray('  无\n');
    } else {
      for (const code of matrix.categories.controversial) {
        output += this.chalk.yellow(`  ${code.name} (${code.code}): `);
        const retryStr = code.retryValues.map(r => 
          `${r.lang}=${this.formatRetry(r.retry)}`
        ).join(', ');
        output += this.chalk.gray(retryStr) + '\n';
      }
    }
    output += '\n';
    return output;
  }

  generateSdkComparisonTable(matrix) {
    let output = '';
    const languages = Object.keys(matrix.sdkMappings);
    
    if (languages.length === 0) return output;
    
    output += this.chalk.bold.yellow('📋 SDK对比表\n');
    output += this.chalk.gray('─────────────────────────────────────────────────────────────\n\n');

    const headers = ['错误码', '名称', ...languages.map(l => this.chalk.white(l.toUpperCase()))];
    
    const tableData = [headers];

    for (const protoCode of matrix.protoCodes) {
      const row = [
        protoCode.code.toString(),
        protoCode.name
      ];

      for (const lang of languages) {
        const codeData = matrix.sdkMappings[lang].codes[protoCode.name];
        if (codeData && codeData.exists) {
          row.push(this.formatRetryColor(codeData.retry));
        } else {
          row.push(this.chalk.gray('N/A'));
        }
      }

      tableData.push(row);
    }

    output += table(tableData);
    return output;
  }

  formatRetry(retry) {
    switch (retry) {
      case 'retriable': return 'RETRY';
      case 'nonRetriable': return 'NO_RETRY';
      case 'conditional': return 'COND';
      case 'unknown': return 'UNK';
      default: return retry ? retry.toUpperCase() : 'N/A';
    }
  }

  formatRetryColor(retry) {
    switch (retry) {
      case 'retriable': return this.chalk.green('RETRY');
      case 'nonRetriable': return this.chalk.red('NO_RETRY');
      case 'conditional': return this.chalk.yellow('COND');
      case 'unknown': return this.chalk.gray('UNK');
      default: return this.chalk.gray('N/A');
    }
  }

  generateJsonReport(matrix, outputPath) {
    const jsonContent = JSON.stringify(matrix, null, 2);
    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, jsonContent, 'utf8');
    }
    return jsonContent;
  }

  generateMarkdownReport(matrix, outputPath) {
    let md = '# gRPC 错误码矩阵报告\n\n';
    md += `*生成时间: ${new Date(matrix.timestamp).toLocaleString()}*\n\n`;

    const malformedCount = (matrix.malformedLines || []).length;
    const issueCount = (matrix.validationIssues || []).length;

    md += '## 摘要\n\n';
    md += '| 指标 | 数值 |\n';
    md += '|------|------|\n';
    md += `| 总错误码数量 | ${matrix.summary.totalCodes} |\n`;
    md += `| SDK语言数量 | ${matrix.summary.languages} |\n`;
    md += `| 可重试(Safe) | ${matrix.summary.safeRetryCount} |\n`;
    md += `| 不可重试(Never) | ${matrix.summary.neverRetryCount} |\n`;
    md += `| 有争议(Controversial) | ${matrix.summary.controversialCount} |\n`;
    md += `| 差异数量 | ${matrix.summary.differencesCount || 0} |\n`;
    if (malformedCount > 0) {
      md += `| ⚠️ 非法行数量 | ${malformedCount} |\n`;
    }
    if (issueCount > 0) {
      md += `| ❌ 校验问题数量 | ${issueCount} |\n`;
    }
    md += '\n';

    if (malformedCount > 0 || issueCount > 0) {
      md += '## ⚠️ 校验问题\n\n';
      
      if (malformedCount > 0) {
        md += '### ❌ 非法枚举值\n\n';
        md += '| 行号 | 原始内容 | 原因 |\n';
        md += '|------|---------|------|\n';
        for (const ml of matrix.malformedLines) {
          md += `| ${ml.line} | \`${ml.rawLine}\` | ${ml.reason} |\n`;
        }
        md += '\n';
      }
      
      if (issueCount > 0) {
        md += '### ⚠️ 校验警告\n\n';
        md += '| 行号 | 类型 | 消息 | 原始内容 |\n';
        md += '|------|------|------|---------|\n';
        for (const issue of matrix.validationIssues) {
          md += `| ${issue.line} | ${issue.type} | ${issue.message} | \`${issue.rawLine}\` |\n`;
        }
        md += '\n';
      }
    }

    md += '## 重试分类\n\n';

    md += '### ✅ 可重试 (Safe Retry)\n\n';
    if (matrix.categories.safeRetry.length === 0) {
      md += '无\n\n';
    } else {
      for (const code of matrix.categories.safeRetry) {
        md += `- ${code.name} (${code.code})\n`;
      }
      md += '\n';
    }

    md += '### ❌ 不可重试 (Never Retry)\n\n';
    if (matrix.categories.neverRetry.length === 0) {
      md += '无\n\n';
    } else {
      for (const code of matrix.categories.neverRetry) {
        md += `- ${code.name} (${code.code})\n`;
      }
      md += '\n';
    }

    md += '### ⚠️ 有争议 (Controversial)\n\n';
    if (matrix.categories.controversial.length === 0) {
      md += '无\n\n';
    } else {
      for (const code of matrix.categories.controversial) {
        const retryStr = code.retryValues.map(r => 
          `${r.lang}=${this.formatRetry(r.retry)}`
        ).join(', ');
        md += `- ${code.name} (${code.code}): ${retryStr}\n`;
      }
      md += '\n';
    }

    if (matrix.differences && matrix.differences.length > 0) {
      md += '## 🔀 SDK差异\n\n';
      for (const diff of matrix.differences) {
        md += `### ${diff.name} (${diff.code}) - ${diff.type === 'code_mismatch' ? '错误码不匹配' : '重试策略不匹配'}\n\n`;
        for (const mapping of diff.mappings) {
          md += `- ${mapping.lang}: code=${mapping.grpcCode}, retry=${this.formatRetry(mapping.retry)}\n`;
        }
        md += '\n';
      }
    }

    md += '## SDK对比\n\n';
    const languages = Object.keys(matrix.sdkMappings);
    md += '| 错误码 | 名称 | ' + languages.map(l => l.toUpperCase()).join(' | ') + ' |\n';
    md += '|--------|------|' + languages.map(() => '------').join('|') + '|\n';

    for (const protoCode of matrix.protoCodes) {
      const values = languages.map(lang => {
        const codeData = matrix.sdkMappings[lang].codes[protoCode.name];
        if (codeData && codeData.exists) {
          return this.formatRetry(codeData.retry);
        }
        return 'N/A';
      });
      md += `| ${protoCode.code} | ${protoCode.name} | ${values.join(' | ')} |\n`;
    }

    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, md, 'utf8');
    }
    return md;
  }

  generateAllReports(matrix, outputDir) {
    const reports = {};
    reports.console = this.generateConsoleReport(matrix);
    if (outputDir) {
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      reports.jsonPath = path.join(outputDir, 'error-matrix.json');
      reports.json = this.generateJsonReport(matrix, reports.jsonPath);
      reports.markdownPath = path.join(outputDir, 'error-matrix.md');
      reports.markdown = this.generateMarkdownReport(matrix, reports.markdownPath);
    }
    return reports;
  }
}

module.exports = ReportGenerator;
