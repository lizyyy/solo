import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { table } from 'table';
import { CheckResult } from './types';

export class Reporter {
  private result: CheckResult;
  private outputDir: string;

  constructor(result: CheckResult, outputDir?: string) {
    this.result = result;
    this.outputDir = outputDir || process.cwd();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  public printConsoleSummary(): void {
    console.log('\n');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║           REST API 错误体一致性检查报告                        ║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('\n');

    console.log(chalk.bold('📋 检查元数据'));
    console.log(chalk.gray('────────────────────────────────────────'));
    console.log(`  输入文件: ${chalk.cyan(this.result.metadata.inputFile)}`);
    console.log(`  检查时间: ${chalk.cyan(new Date(this.result.metadata.checkedAt).toLocaleString())}`);
    console.log(`  接口总数: ${chalk.cyan(this.result.metadata.totalEndpoints)}`);
    console.log(`  错误响应数: ${chalk.cyan(this.result.metadata.totalErrorResponses)}`);
    console.log('');

    console.log(chalk.bold('📊 问题摘要'));
    console.log(chalk.gray('────────────────────────────────────────'));
    const summaryData = [
      [chalk.red('错误'), chalk.yellow('警告'), chalk.blue('信息'), chalk.bold('总计')],
      [
        chalk.red(this.result.summary.errors),
        chalk.yellow(this.result.summary.warnings),
        chalk.blue(this.result.summary.infos),
        chalk.bold(this.result.summary.totalIssues),
      ],
    ];
    console.log(table(summaryData, {
      header: {
        content: '问题统计',
        alignment: 'center',
      },
    }));

    if (this.result.statusCodeGroups.length > 0) {
      console.log(chalk.bold('🔍 状态码分组分析'));
      console.log(chalk.gray('────────────────────────────────────────'));
      
      const groupData = [
        [chalk.bold('状态码'), chalk.bold('分类'), chalk.bold('响应数'), chalk.bold('通用字段')],
        ...this.result.statusCodeGroups.map(group => [
          group.statusCode,
          group.category,
          group.responses.length.toString(),
          group.commonFields.length > 0 ? group.commonFields.join(', ') : chalk.gray('(无)'),
        ]),
      ];
      console.log(table(groupData));
    }

    if (this.result.issues.length > 0) {
      console.log(chalk.bold('❌ 问题详情'));
      console.log(chalk.gray('────────────────────────────────────────'));
      
      for (const issue of this.result.issues) {
        const severityColor = issue.severity === 'error' ? chalk.red : 
                              issue.severity === 'warning' ? chalk.yellow : chalk.blue;
        
        console.log(`\n  ${severityColor(`[${issue.severity.toUpperCase()}]`)} ${issue.message}`);
        console.log(`     位置: ${chalk.magenta(`${issue.location.method} ${issue.location.path}`)} ${chalk.gray(`[${issue.location.statusCode}]`)}`);
        if (issue.details.suggestion) {
          console.log(`     建议: ${chalk.gray(issue.details.suggestion)}`);
        }
        if (issue.details.expected) {
          console.log(`     期望字段: ${chalk.green(issue.details.expected.join(', '))}`);
        }
        if (issue.details.actual && issue.details.actual.length > 0) {
          console.log(`     实际字段: ${chalk.dim(issue.details.actual.join(', '))}`);
        }
      }
    }

    if (this.result.recommendations.length > 0) {
      console.log('\n');
      console.log(chalk.bold('💡 改进建议'));
      console.log(chalk.gray('────────────────────────────────────────'));
      for (let i = 0; i < this.result.recommendations.length; i++) {
        console.log(`  ${i + 1}. ${this.result.recommendations[i]}`);
      }
    }

    console.log('\n');
    if (this.result.summary.errors > 0) {
      console.log(chalk.red.bold(`❌ 检查失败: 发现 ${this.result.summary.errors} 个错误`));
    } else if (this.result.summary.warnings > 0) {
      console.log(chalk.yellow.bold(`⚠️  检查完成: 发现 ${this.result.summary.warnings} 个警告`));
    } else {
      console.log(chalk.green.bold('✅ 检查通过: 所有错误响应体一致!'));
    }
    console.log('\n');
  }

  public writeJsonOutput(outputPath?: string): string {
    this.ensureOutputDir();
    const filePath = outputPath || path.join(this.outputDir, 'error-consistency-report.json');
    
    const jsonContent = JSON.stringify(this.result, null, 2);
    fs.writeFileSync(filePath, jsonContent, 'utf-8');
    
    console.log(chalk.green(`✅ 机器可读报告已写入: ${filePath}`));
    return filePath;
  }

  public writeMarkdownOutput(outputPath?: string): string {
    this.ensureOutputDir();
    const filePath = outputPath || path.join(this.outputDir, 'error-consistency-report.md');
    
    const markdown = this.generateMarkdown();
    fs.writeFileSync(filePath, markdown, 'utf-8');
    
    console.log(chalk.green(`✅ Markdown 报告已写入: ${filePath}`));
    return filePath;
  }

  private generateMarkdown(): string {
    let md = '# REST API 错误体一致性检查报告\n\n';
    
    md += '## 检查元数据\n\n';
    md += '| 项目 | 值 |\n';
    md += '|------|-----|\n';
    md += `| 输入文件 | \`${this.result.metadata.inputFile}\` |\n`;
    md += `| 检查时间 | ${new Date(this.result.metadata.checkedAt).toLocaleString()} |\n`;
    md += `| 接口总数 | ${this.result.metadata.totalEndpoints} |\n`;
    md += `| 错误响应数 | ${this.result.metadata.totalErrorResponses} |\n\n`;

    md += '## 问题摘要\n\n';
    md += '| 严重程度 | 数量 |\n';
    md += '|----------|------|\n';
    md += `| 🔴 错误 | ${this.result.summary.errors} |\n`;
    md += `| 🟡 警告 | ${this.result.summary.warnings} |\n`;
    md += `| 🔵 信息 | ${this.result.summary.infos} |\n`;
    md += `| **总计** | **${this.result.summary.totalIssues}** |\n\n`;

    if (this.result.statusCodeGroups.length > 0) {
      md += '## 状态码分组分析\n\n';
      md += '| 状态码 | 分类 | 响应数 | 通用字段 |\n';
      md += '|--------|------|--------|----------|\n';
      for (const group of this.result.statusCodeGroups) {
        md += `| ${group.statusCode} | ${group.category} | ${group.responses.length} | ${group.commonFields.length > 0 ? group.commonFields.join(', ') : '(无)'} |\n`;
      }
      md += '\n';
    }

    if (this.result.issues.length > 0) {
      md += '## 问题详情\n\n';
      
      const errors = this.result.issues.filter(i => i.severity === 'error');
      const warnings = this.result.issues.filter(i => i.severity === 'warning');
      const infos = this.result.issues.filter(i => i.severity === 'info');

      if (errors.length > 0) {
        md += '### 🔴 错误\n\n';
        for (const issue of errors) {
          md += `#### ${issue.message}\n\n`;
          md += `- **位置**: \`${issue.location.method} ${issue.location.path}\` [${issue.location.statusCode}]\n`;
          if (issue.details.suggestion) {
            md += `- **建议**: ${issue.details.suggestion}\n`;
          }
          if (issue.details.expected) {
            md += `- **期望字段**: ${issue.details.expected.join(', ')}\n`;
          }
          if (issue.details.actual && issue.details.actual.length > 0) {
            md += `- **实际字段**: ${issue.details.actual.join(', ')}\n`;
          }
          md += '\n';
        }
      }

      if (warnings.length > 0) {
        md += '### 🟡 警告\n\n';
        for (const issue of warnings) {
          md += `#### ${issue.message}\n\n`;
          md += `- **位置**: \`${issue.location.method} ${issue.location.path}\` [${issue.location.statusCode}]\n`;
          if (issue.details.suggestion) {
            md += `- **建议**: ${issue.details.suggestion}\n`;
          }
          md += '\n';
        }
      }
    }

    if (this.result.recommendations.length > 0) {
      md += '## 💡 改进建议\n\n';
      for (let i = 0; i < this.result.recommendations.length; i++) {
        md += `${i + 1}. ${this.result.recommendations[i]}\n`;
      }
      md += '\n';
    }

    md += '---\n\n';
    md += `*报告生成于: ${new Date().toLocaleString()}*\n`;

    return md;
  }

  public generateAllReports(jsonPath?: string, markdownPath?: string): void {
    this.printConsoleSummary();
    console.log('');
    this.writeJsonOutput(jsonPath);
    this.writeMarkdownOutput(markdownPath);
  }
}
