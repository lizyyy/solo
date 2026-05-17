import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { table } from 'table';
import { CheckResult, Inconsistency, EndpointAnalysis } from './types';

export class Reporter {
  private result: CheckResult;

  constructor(result: CheckResult) {
    this.result = result;
  }

  printTerminalSummary(): void {
    console.log('\n');
    console.log(chalk.bold.blue('='.repeat(70)));
    console.log(chalk.bold.blue('        REST 分页一致性检查报告'));
    console.log(chalk.bold.blue('='.repeat(70)));
    console.log('\n');

    this.printSummaryStats();
    this.printInconsistencySummary();
    this.printInconsistencyDetails();
    this.printBadEndpoints();

    console.log('\n');
    console.log(chalk.gray(`检查时间: ${new Date(this.result.timestamp).toLocaleString()}`));
    console.log(chalk.gray(`OpenAPI 文件: ${this.result.openapiFile}`));
    console.log('\n');
  }

  private printSummaryStats(): void {
    const { summary } = this.result;
    
    console.log(chalk.bold('📊 概览统计'));
    console.log(chalk.gray('-'.repeat(70)));
    
    const statsData = [
      ['总接口数', summary.totalEndpoints.toString()],
      ['分页接口数', summary.paginationEndpoints.toString()],
      ['存在问题的接口数', chalk.red(summary.inconsistentEndpoints.toString())],
      ['总问题数 (Errors)', chalk.red(summary.bySeverity.error.toString())],
      ['警告数 (Warnings)', chalk.yellow(summary.bySeverity.warning.toString())],
      ['提示数 (Info)', chalk.blue(summary.bySeverity.info.toString())]
    ];
    
    console.log(table(statsData, {
      columns: [{ width: 25 }, { width: 40 }],
      drawHorizontalLine: (index: number) => index === 0 || index === statsData.length
    }));
  }

  private printInconsistencySummary(): void {
    const errors = this.result.inconsistencies.filter(i => i.severity === 'error');
    const warnings = this.result.inconsistencies.filter(i => i.severity === 'warning');
    const infos = this.result.inconsistencies.filter(i => i.severity === 'info');

    if (errors.length === 0 && warnings.length === 0 && infos.length === 0) {
      console.log(chalk.green('✅ 所有分页接口规范一致！\n'));
      return;
    }

    console.log(chalk.bold('📝 问题类型分布'));
    console.log(chalk.gray('-'.repeat(70)));

    const typeCounts: Record<string, number> = {};
    for (const inc of this.result.inconsistencies) {
      typeCounts[inc.type] = (typeCounts[inc.type] || 0) + 1;
    }

    const typeData = Object.entries(typeCounts).map(([type, count]) => {
      const typeName = this.getTypeName(type);
      return [typeName, count.toString()];
    });

    console.log(table(typeData, {
      columns: [{ width: 30 }, { width: 35 }],
      drawHorizontalLine: (index: number) => index === 0 || index === typeData.length
    }));
  }

  private getTypeName(type: string): string {
    const names: Record<string, string> = {
      param_missing: '缺少分页参数',
      param_name: '参数命名不一致',
      response_missing: '缺少响应字段',
      response_name: '响应字段命名不一致',
      structure_issue: '结构问题'
    };
    return names[type] || type;
  }

  private printInconsistencyDetails(): void {
    const errors = this.result.inconsistencies.filter(i => i.severity === 'error');
    
    if (errors.length === 0) return;

    console.log(chalk.bold.red('❌ 严重问题详情'));
    console.log(chalk.gray('-'.repeat(70)));

    for (const inc of errors) {
      this.printInconsistency(inc);
    }
  }

  private printInconsistency(inc: Inconsistency): void {
    const location = `${inc.location.method} ${inc.location.path}`;
    const severityColor = inc.severity === 'error' ? chalk.red : 
                          inc.severity === 'warning' ? chalk.yellow : chalk.blue;
    
    console.log(`\n${severityColor('●')} ${inc.message}`);
    console.log(chalk.gray(`  位置: ${location}`));
    
    if (inc.location.paramName) {
      console.log(chalk.gray(`  参数: ${inc.location.paramName}`));
    }
    if (inc.location.fieldName) {
      console.log(chalk.gray(`  字段: ${inc.location.fieldName}`));
    }
    if (inc.expected) {
      console.log(chalk.gray(`  期望: ${inc.expected.join(', ')}`));
    }
    if (inc.actual) {
      console.log(chalk.gray(`  实际: ${inc.actual}`));
    }
    if (inc.suggestion) {
      console.log(chalk.green(`  💡 建议: ${inc.suggestion}`));
    }
  }

  private printBadEndpoints(): void {
    const badEndpoints = this.result.endpoints.filter(
      e => e.inconsistencies.some(i => i.severity === 'error')
    );

    if (badEndpoints.length === 0) return;

    console.log('\n');
    console.log(chalk.bold.red('🔴 需要修复的接口列表'));
    console.log(chalk.gray('-'.repeat(70)));

    const endpointData = badEndpoints.map(e => [
      `${e.method} ${e.path}`,
      e.inconsistencies.filter(i => i.severity === 'error').length.toString(),
      e.inconsistencies.filter(i => i.severity === 'warning').length.toString()
    ]);

    endpointData.unshift([chalk.bold('接口'), chalk.bold('错误数'), chalk.bold('警告数')]);

    console.log(table(endpointData, {
      columns: [{ width: 40 }, { width: 10 }, { width: 10 }],
      drawHorizontalLine: (index: number) => index === 0 || index === 1 || index === endpointData.length
    }));
  }

  exportJSON(outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(this.result, null, 2), 'utf-8');
    console.log(chalk.green(`✅ JSON 报告已导出: ${outputPath}`));
  }

  exportMarkdown(outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const markdown = this.generateMarkdown();
    fs.writeFileSync(outputPath, markdown, 'utf-8');
    console.log(chalk.green(`✅ Markdown 报告已导出: ${outputPath}`));
  }

  private generateMarkdown(): string {
    const lines: string[] = [];
    
    lines.push('# REST 分页一致性检查报告');
    lines.push('');
    lines.push(`**生成时间**: ${new Date(this.result.timestamp).toLocaleString()}`);
    lines.push(`**OpenAPI 文件**: \`${this.result.openapiFile}\``);
    lines.push('');

    lines.push('## 📊 概览统计');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总接口数 | ${this.result.summary.totalEndpoints} |`);
    lines.push(`| 分页接口数 | ${this.result.summary.paginationEndpoints} |`);
    lines.push(`| 存在问题的接口数 | **${this.result.summary.inconsistentEndpoints}** |`);
    lines.push(`| 严重错误数 | 🔴 ${this.result.summary.bySeverity.error} |`);
    lines.push(`| 警告数 | 🟡 ${this.result.summary.bySeverity.warning} |`);
    lines.push(`| 提示数 | 🔵 ${this.result.summary.bySeverity.info} |`);
    lines.push('');

    if (this.result.summary.totalInconsistencies === 0 && 
        this.result.summary.bySeverity.warning === 0) {
      lines.push('## ✅ 检查通过');
      lines.push('');
      lines.push('所有分页接口规范一致！');
      lines.push('');
    } else {
      lines.push('## 🔴 严重问题详情');
      lines.push('');
      
      const errors = this.result.inconsistencies.filter(i => i.severity === 'error');
      if (errors.length > 0) {
        for (const inc of errors) {
          lines.push(...this.formatInconsistencyMarkdown(inc));
        }
      } else {
        lines.push('无严重错误');
      }
      lines.push('');

      const warnings = this.result.inconsistencies.filter(i => i.severity === 'warning');
      if (warnings.length > 0) {
        lines.push('## 🟡 警告详情');
        lines.push('');
        for (const inc of warnings) {
          lines.push(...this.formatInconsistencyMarkdown(inc));
        }
        lines.push('');
      }

      const badEndpoints = this.result.endpoints.filter(
        e => e.inconsistencies.some(i => i.severity === 'error')
      );
      if (badEndpoints.length > 0) {
        lines.push('## 📋 需要修复的接口列表');
        lines.push('');
        lines.push('| 接口 | 错误数 | 警告数 | 问题描述 |');
        lines.push('|------|--------|--------|----------|');
        for (const endpoint of badEndpoints) {
          const errorCount = endpoint.inconsistencies.filter(i => i.severity === 'error').length;
          const warningCount = endpoint.inconsistencies.filter(i => i.severity === 'warning').length;
          const issues = endpoint.inconsistencies
            .filter(i => i.severity === 'error')
            .map(i => i.message)
            .join('; ');
          lines.push(`| \`${endpoint.method} ${endpoint.path}\` | ${errorCount} | ${warningCount} | ${issues} |`);
        }
        lines.push('');
      }
    }

    lines.push('## 📑 所有分页接口详情');
    lines.push('');
    lines.push('| 接口 | 分页参数 | 响应字段 | 状态 |');
    lines.push('|------|----------|----------|------|');
    for (const endpoint of this.result.endpoints.filter(e => e.isPaginationEndpoint)) {
      const params = [
        endpoint.paginationParams.page,
        endpoint.paginationParams.pageSize
      ].filter(Boolean).join(', ');
      const fields = [
        endpoint.responseFields.data,
        endpoint.responseFields.total
      ].filter(Boolean).join(', ');
      const hasError = endpoint.inconsistencies.some(i => i.severity === 'error');
      const hasWarning = endpoint.inconsistencies.some(i => i.severity === 'warning');
      const status = hasError ? '🔴 有错误' : hasWarning ? '🟡 有警告' : '✅ 正常';
      lines.push(`| \`${endpoint.method} ${endpoint.path}\` | \`${params || '-'}\` | \`${fields || '-'}\` | ${status} |`);
    }
    lines.push('');

    lines.push('## ⚙️ 检查配置');
    lines.push('');
    lines.push('### 期望的分页参数命名');
    lines.push(`- 页码: \`${this.result.config.expectedParams.page.join('`, `')}\``);
    lines.push(`- 页大小: \`${this.result.config.expectedParams.pageSize.join('`, `')}\``);
    lines.push('');
    lines.push('### 期望的响应字段命名');
    lines.push(`- 数据列表: \`${this.result.config.expectedResponseFields.data.join('`, `')}\``);
    lines.push(`- 总数: \`${this.result.config.expectedResponseFields.total.join('`, `')}\``);
    lines.push(`- 页码: \`${this.result.config.expectedResponseFields.page.join('`, `')}\``);
    lines.push(`- 页大小: \`${this.result.config.expectedResponseFields.pageSize.join('`, `')}\``);
    if (this.result.config.expectedResponseFields.totalPages) {
      lines.push(`- 总页数: \`${this.result.config.expectedResponseFields.totalPages.join('`, `')}\``);
    }
    lines.push('');

    return lines.join('\n');
  }

  private formatInconsistencyMarkdown(inc: Inconsistency): string[] {
    const lines: string[] = [];
    const location = `\`${inc.location.method} ${inc.location.path}\``;
    const severityEmoji = inc.severity === 'error' ? '🔴' : 
                          inc.severity === 'warning' ? '🟡' : '🔵';
    
    lines.push(`### ${severityEmoji} ${inc.message}`);
    lines.push('');
    lines.push(`- **位置**: ${location}`);
    if (inc.location.paramName) {
      lines.push(`- **参数**: \`${inc.location.paramName}\``);
    }
    if (inc.location.fieldName) {
      lines.push(`- **字段**: \`${inc.location.fieldName}\``);
    }
    if (inc.expected) {
      lines.push(`- **期望命名**: \`${inc.expected.join('`, `')}\``);
    }
    if (inc.actual) {
      lines.push(`- **实际命名**: \`${inc.actual}\``);
    }
    if (inc.suggestion) {
      lines.push(`- **建议**: ${inc.suggestion}`);
    }
    lines.push('');

    return lines;
  }

  hasErrors(): boolean {
    return this.result.summary.bySeverity.error > 0;
  }
}
