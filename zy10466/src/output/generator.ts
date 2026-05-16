import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';
import * as chalk from 'chalk';
import * as Table from 'cli-table3';
import * as dayjs from 'dayjs';
import { SimulationResult, CliOptions } from '../types';

export class OutputGenerator {
  private options: CliOptions;

  constructor(options: CliOptions) {
    this.options = options;
  }

  generateAll(result: SimulationResult): void {
    if (this.options.format === 'summary' || this.options.format === 'all') {
      this.printTerminalSummary(result);
    }

    if (this.options.format === 'csv' || this.options.format === 'all') {
      this.generateCsvOutput(result);
    }

    if (this.options.format === 'markdown' || this.options.format === 'all') {
      this.generateMarkdownReport(result);
    }

    if (result.badRows.length > 0) {
      this.generateBadRowsReport(result);
    }
  }

  private printTerminalSummary(result: SimulationResult): void {
    console.log(chalk.cyan('📊 预演摘要'));
    console.log(chalk.gray(`预演日期: ${dayjs(result.simulationDate).format('YYYY-MM-DD HH:mm:ss')}`));
    console.log();

    const summaryTable = new Table({
      head: [
        chalk.white('指标'),
        chalk.white('数值'),
        chalk.white('说明'),
      ],
      colWidths: [25, 15, 30],
    });

    summaryTable.push(
      [
        '总对象数',
        result.summary.totalObjects.toLocaleString(),
        'CSV 中解析出的对象总数',
      ],
      [
        '匹配规则的对象',
        chalk.yellow(result.summary.matchedObjects.toLocaleString()),
        `占比 ${((result.summary.matchedObjects / result.summary.totalObjects) * 100).toFixed(1)}%`,
      ],
      [
        '将被删除的对象',
        chalk.red(result.summary.objectsToDelete.toLocaleString()),
        `占比 ${((result.summary.objectsToDelete / result.summary.totalObjects) * 100).toFixed(1)}%`,
      ],
      [
        '总存储空间',
        this.formatSize(result.summary.totalSize),
        '所有对象的大小总和',
      ],
      [
        '将释放的空间',
        chalk.red(this.formatSize(result.summary.sizeToDelete)),
        `占比 ${((result.summary.sizeToDelete / result.summary.totalSize) * 100).toFixed(1)}%`,
      ],
      [
        '解析错误行数',
        result.summary.badRows > 0 ? chalk.red(result.summary.badRows.toString()) : '0',
        '已记录到 bad-rows.csv',
      ]
    );

    console.log(summaryTable.toString());
    console.log();

    if (this.options.verbose && result.matches.filter(m => m.willBeDeleted).length > 0) {
      console.log(chalk.cyan('🗑️  将被删除的对象 (前20个):'));
      const deleteTable = new Table({
        head: [
          chalk.white('对象键'),
          chalk.white('大小'),
          chalk.white('最后修改'),
          chalk.white('触发规则'),
          chalk.white('执行日期'),
        ],
        colWidths: [30, 12, 15, 15, 15],
      });

      result.matches
        .filter(m => m.willBeDeleted)
        .slice(0, 20)
        .forEach(match => {
          deleteTable.push([
            match.object.key.length > 27 ? match.object.key.slice(0, 27) + '...' : match.object.key,
            this.formatSize(match.object.size),
            dayjs(match.object.lastModified).format('YYYY-MM-DD'),
            match.matchedRules[0]?.rule.id || '-',
            dayjs(match.earliestActionDate).format('YYYY-MM-DD'),
          ]);
        });

      console.log(deleteTable.toString());
      console.log();
    }

    console.log(chalk.cyan('📋 规则统计:'));
    const ruleCounts = new Map<string, number>();
    result.matches.forEach(match => {
      match.matchedRules.forEach(r => {
        ruleCounts.set(r.rule.id, (ruleCounts.get(r.rule.id) || 0) + 1);
      });
    });

    const rulesTable = new Table({
      head: [
        chalk.white('规则 ID'),
        chalk.white('状态'),
        chalk.white('匹配对象数'),
      ],
    });

    result.rules.forEach(rule => {
      rulesTable.push([
        rule.id,
        rule.status === 'Enabled' ? chalk.green('启用') : chalk.gray('禁用'),
        (ruleCounts.get(rule.id) || 0).toString(),
      ]);
    });

    console.log(rulesTable.toString());
  }

  private generateCsvOutput(result: SimulationResult): void {
    const csvPath = path.join(this.options.output, 'simulation-result.csv');
    
    const rows = result.matches.map(match => ({
      key: match.object.key,
      size: match.object.size,
      sizeFormatted: this.formatSize(match.object.size),
      lastModified: dayjs(match.object.lastModified).format('YYYY-MM-DD HH:mm:ss'),
      isLatest: match.object.isLatest,
      versionId: match.object.versionId || '',
      storageClass: match.object.storageClass,
      matchedRules: match.matchedRules.map(r => r.rule.id).join(';'),
      willBeDeleted: match.willBeDeleted,
      earliestActionDate: match.earliestActionDate 
        ? dayjs(match.earliestActionDate).format('YYYY-MM-DD') 
        : '',
      sourceFile: match.object.source.file,
      sourceLine: match.object.source.line,
    }));

    const csv = stringify(rows, {
      header: true,
      quoted_string: true,
    });

    fs.writeFileSync(csvPath, csv, 'utf-8');

    if (!this.options.quiet) {
      console.log(chalk.gray(`✓ CSV 结果已保存: ${csvPath}`));
    }
  }

  private generateMarkdownReport(result: SimulationResult): void {
    const reportPath = path.join(this.options.output, 'simulation-report.md');

    const content = `# 对象存储生命周期预演报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 预演时间 | ${dayjs(result.simulationDate).format('YYYY-MM-DD HH:mm:ss')} |
| 规则文件 | ${this.options.rules} |
| 输入路径 | ${this.options.input} |

## 执行摘要

| 指标 | 数值 | 说明 |
|------|------|------|
| 总对象数 | ${result.summary.totalObjects.toLocaleString()} | CSV 中解析出的对象总数 |
| 匹配规则的对象 | ${result.summary.matchedObjects.toLocaleString()} | 占比 ${((result.summary.matchedObjects / result.summary.totalObjects) * 100).toFixed(1)}% |
| 将被删除的对象 | ${result.summary.objectsToDelete.toLocaleString()} | 占比 ${((result.summary.objectsToDelete / result.summary.totalObjects) * 100).toFixed(1)}% |
| 总存储空间 | ${this.formatSize(result.summary.totalSize)} | 所有对象的大小总和 |
| 将释放的空间 | ${this.formatSize(result.summary.sizeToDelete)} | 占比 ${((result.summary.sizeToDelete / result.summary.totalSize) * 100).toFixed(1)}% |
| 解析错误行数 | ${result.summary.badRows} | 详情请查看 bad-rows.csv |

## 生命周期规则

| 规则 ID | 状态 | 前缀 | 过期天数 | 匹配对象数 |
|---------|------|------|----------|------------|
${result.rules.map(rule => `| ${rule.id} | ${rule.status} | ${rule.filter?.prefix || '-'} | ${rule.expiration?.days || '-'} | ${result.matches.filter(m => m.matchedRules.some(r => r.rule.id === rule.id)).length} |`).join('\n')}

## 将被删除的对象

${result.summary.objectsToDelete === 0 
  ? '> 没有对象会被删除。'
  : `共 ${result.summary.objectsToDelete} 个对象将被删除，以下是前 50 个：

| 对象键 | 大小 | 最后修改 | 触发规则 | 执行日期 |
|--------|------|----------|----------|----------|
${result.matches
  .filter(m => m.willBeDeleted)
  .slice(0, 50)
  .map(m => `| ${m.object.key} | ${this.formatSize(m.object.size)} | ${dayjs(m.object.lastModified).format('YYYY-MM-DD')} | ${m.matchedRules[0]?.rule.id || '-'} | ${m.earliestActionDate ? dayjs(m.earliestActionDate).format('YYYY-MM-DD') : '-'} |`)
  .join('\n')}
`}

## 注意事项

1. 本报告仅为预演结果，实际删除操作请以云服务商控制台为准
2. 请仔细核对将被删除的对象列表，避免误删重要数据
3. 如有解析错误，请查看 bad-rows.csv 文件了解详情

---

报告生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}
`;

    fs.writeFileSync(reportPath, content, 'utf-8');

    if (!this.options.quiet) {
      console.log(chalk.gray(`✓ Markdown 报告已保存: ${reportPath}`));
    }
  }

  private generateBadRowsReport(result: SimulationResult): void {
    const csvPath = path.join(this.options.output, 'bad-rows.csv');

    const rows = result.badRows.map(row => ({
      file: row.file,
      line: row.line,
      error: row.error,
      rawContent: row.raw,
    }));

    const csv = stringify(rows, {
      header: true,
      quoted_string: true,
    });

    fs.writeFileSync(csvPath, csv, 'utf-8');

    if (!this.options.quiet) {
      console.log(chalk.yellow(`⚠ 发现 ${result.badRows.length} 行解析错误，详情: ${csvPath}`));
    }
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
