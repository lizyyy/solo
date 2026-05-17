import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { Parser } from 'json2csv';
import { OrphanReport, CliOptions } from './types';

export class ReportGenerator {
  private outputDir: string;
  private formats: CliOptions['format'];
  private verbose: boolean;

  constructor(outputDir: string, formats: CliOptions['format'], verbose: boolean = false) {
    this.outputDir = outputDir;
    this.formats = formats;
    this.verbose = verbose;
  }

  public async generate(report: OrphanReport): Promise<void> {
    this.ensureOutputDir();
    
    const promises: Promise<void>[] = [];

    if (this.formats.includes('json')) {
      promises.push(this.generateJson(report));
    }

    if (this.formats.includes('markdown')) {
      promises.push(this.generateMarkdown(report));
    }

    if (this.formats.includes('csv')) {
      promises.push(this.generateCsv(report));
    }

    promises.push(this.generateErrorLog(report));

    await Promise.all(promises);
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private async generateJson(report: OrphanReport): Promise<void> {
    const filePath = path.join(this.outputDir, 'orphan-report.json');
    const content = JSON.stringify(report, null, 2);
    
    fs.writeFileSync(filePath, content, 'utf-8');
    
    if (this.verbose) {
      console.log(chalk.green(`✓ JSON报告已生成: ${filePath}`));
    }
  }

  private async generateMarkdown(report: OrphanReport): Promise<void> {
    const filePath = path.join(this.outputDir, 'orphan-report.md');
    const content = this.buildMarkdownContent(report);
    
    fs.writeFileSync(filePath, content, 'utf-8');
    
    if (this.verbose) {
      console.log(chalk.green(`✓ Markdown报告已生成: ${filePath}`));
    }
  }

  private async generateCsv(report: OrphanReport): Promise<void> {
    const filePath = path.join(this.outputDir, 'orphan-report.csv');
    
    const fields = [
      'serviceId',
      'serviceName',
      'reasons',
      'repoUrl',
      'repoExists',
      'repoArchived',
      'lastCommitDate',
      'alertCount',
      'owners'
    ];

    const data = report.orphanServices.map(orphan => ({
      serviceId: orphan.serviceId,
      serviceName: orphan.serviceName,
      reasons: orphan.reasons.join('; '),
      repoUrl: orphan.repoCheck?.repoUrl || '',
      repoExists: orphan.repoCheck?.exists || false,
      repoArchived: orphan.repoCheck?.isArchived || false,
      lastCommitDate: orphan.repoCheck?.lastCommitDate || '',
      alertCount: orphan.alertReferences.length,
      owners: this.findServiceOwners(orphan.serviceName, report)
    }));

    const parser = new Parser({ fields });
    const csv = parser.parse(data);
    
    fs.writeFileSync(filePath, csv, 'utf-8');
    
    if (this.verbose) {
      console.log(chalk.green(`✓ CSV报告已生成: ${filePath}`));
    }
  }

  private async generateErrorLog(report: OrphanReport): Promise<void> {
    const filePath = path.join(this.outputDir, 'errors.log');
    
    if (report.errors.length === 0) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return;
    }

    const lines = report.errors.map(err => {
      const parts = [
        `[${err.errorType.toUpperCase()}]`,
        err.serviceName ? `服务: ${err.serviceName}` : '',
        err.sourceFile ? `文件: ${err.sourceFile}` : '',
        err.lineNumber ? `行号: ${err.lineNumber}` : '',
        `消息: ${err.message}`
      ].filter(Boolean);
      
      return parts.join(' | ');
    });

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    
    if (this.verbose) {
      console.log(chalk.yellow(`✓ 错误日志已生成: ${filePath} (${report.errors.length} 个错误)`));
    }
  }

  private buildMarkdownContent(report: OrphanReport): string {
    const lines: string[] = [];

    lines.push('# 服务孤儿检测报告');
    lines.push('');
    lines.push(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
    lines.push('');

    lines.push('## 摘要');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总服务数 | ${report.summary.total} |`);
    lines.push(`| 孤儿服务数 | ${report.summary.orphanCount} |`);
    lines.push(`| 活跃服务数 | ${report.summary.activeCount} |`);
    lines.push(`| 孤儿率 | ${report.summary.orphanRate}% |`);
    lines.push(`| 处理错误数 | ${report.summary.errorCount} |`);
    lines.push('');

    lines.push('## 孤儿服务详情');
    lines.push('');

    if (report.orphanServices.length === 0) {
      lines.push('未发现孤儿服务！');
    } else {
      for (const orphan of report.orphanServices) {
        lines.push(`### ${orphan.serviceName} (\`${orphan.serviceId}\`)`);
        lines.push('');
        lines.push('**判定原因:**');
        for (const reason of orphan.reasons) {
          lines.push(`- ${reason}`);
        }
        lines.push('');

        if (orphan.repoCheck) {
          lines.push('**仓库信息:**');
          lines.push(`- URL: ${orphan.repoCheck.repoUrl}`);
          lines.push(`- 存在: ${orphan.repoCheck.exists ? '是' : '否'}`);
          if (orphan.repoCheck.isArchived !== undefined) {
            lines.push(`- 已归档: ${orphan.repoCheck.isArchived ? '是' : '否'}`);
          }
          if (orphan.repoCheck.lastCommitDate) {
            lines.push(`- 最后提交: ${new Date(orphan.repoCheck.lastCommitDate).toLocaleString('zh-CN')}`);
          }
          lines.push('');
        }

        if (orphan.alertReferences.length > 0) {
          lines.push('**告警引用:**');
          for (const ref of orphan.alertReferences) {
            lines.push(`- ${ref.ruleId} (${path.basename(ref.sourceFile)}:${ref.lineNumber})`);
          }
          lines.push('');
        } else {
          lines.push('**告警引用:** 无');
          lines.push('');
        }

        const owners = this.findServiceOwners(orphan.serviceId, report);
        if (owners) {
          lines.push(`**负责人:** ${owners}`);
          lines.push('');
        }
      }
    }

    lines.push('## 负责人汇总');
    lines.push('');

    const ownersWithOrphans = report.owners.filter(o => o.orphanServices.length > 0);
    
    if (ownersWithOrphans.length === 0) {
      lines.push('无负责人需要处理孤儿服务。');
    } else {
      lines.push('| 负责人 | 负责服务数 | 孤儿服务数 | 孤儿服务列表 |');
      lines.push('|--------|------------|------------|--------------|');
      
      for (const owner of ownersWithOrphans) {
        lines.push(`| ${owner.name} | ${owner.services.length} | ${owner.orphanServices.length} | ${owner.orphanServices.join(', ')} |`);
      }
    }

    lines.push('');

    if (report.errors.length > 0) {
      lines.push('## 处理错误');
      lines.push('');
      lines.push('共发现以下处理错误，请检查数据文件。');
      lines.push('');
      
      for (const err of report.errors) {
        lines.push(`### ${err.errorType.toUpperCase()}`);
        if (err.serviceName) {
          lines.push(`- 服务: ${err.serviceName}`);
        }
        lines.push(`- 文件: ${err.sourceFile}`);
        if (err.lineNumber) {
          lines.push(`- 行号: ${err.lineNumber}`);
        }
        lines.push(`- 消息: ${err.message}`);
        if (err.rawData) {
          lines.push(`- 原始数据: \`${err.rawData.substring(0, 100)}\``);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private findServiceOwners(serviceName: string, report: OrphanReport): string {
    const owners = report.owners.filter(o => 
      o.services.includes(serviceName) || o.orphanServices.includes(serviceName)
    );
    return owners.map(o => o.name).join(', ');
  }

  public printSummary(report: OrphanReport): void {
    console.log('');
    console.log(chalk.cyan('='.repeat(70)));
    console.log(chalk.cyan.bold('                    服务孤儿检测报告摘要'));
    console.log(chalk.cyan('='.repeat(70)));
    console.log('');

    const summaryTable = new Table({
      head: ['指标', '数值'],
      colWidths: [40, 26],
      style: { head: ['cyan'] }
    });

    summaryTable.push(
      ['总服务数', report.summary.total.toString()],
      ['孤儿服务数', chalk.red.bold(report.summary.orphanCount.toString())],
      ['活跃服务数', chalk.green(report.summary.activeCount.toString())],
      ['孤儿率', chalk.yellow(`${report.summary.orphanRate}%`)],
      ['处理错误数', report.summary.errorCount > 0 ? chalk.red(report.summary.errorCount.toString()) : '0']
    );

    console.log(summaryTable.toString());
    console.log('');

    if (report.orphanServices.length > 0) {
      console.log(chalk.red.bold('⚠ 孤儿服务列表:'));
      console.log('');

      const orphanTable = new Table({
        head: ['服务名称', '判定原因', '负责人'],
        colWidths: [25, 30, 11],
        style: { head: ['red'] }
      });

      for (const orphan of report.orphanServices) {
        const owners = this.findServiceOwners(orphan.serviceName, report);
        orphanTable.push([
          orphan.serviceName,
          orphan.reasons.join(', ').substring(0, 28),
          owners.substring(0, 10)
        ]);
      }

      console.log(orphanTable.toString());
      console.log('');
    }

    const ownersWithOrphans = report.owners.filter(o => o.orphanServices.length > 0);
    if (ownersWithOrphans.length > 0) {
      console.log(chalk.yellow.bold('👥 需要关注的负责人:'));
      console.log('');

      const ownerTable = new Table({
        head: ['负责人', '孤儿服务数', '孤儿服务'],
        colWidths: [20, 12, 34],
        style: { head: ['yellow'] }
      });

      for (const owner of ownersWithOrphans.slice(0, 10)) {
        ownerTable.push([
          owner.name,
          chalk.red(owner.orphanServices.length.toString()),
          owner.orphanServices.join(', ').substring(0, 32)
        ]);
      }

      console.log(ownerTable.toString());
      
      if (ownersWithOrphans.length > 10) {
        console.log(chalk.gray(`  ...还有 ${ownersWithOrphans.length - 10} 位负责人，请查看完整报告`));
      }
      console.log('');
    }

    if (report.errors.length > 0) {
      console.log(chalk.red.bold('✗ 处理错误:'));
      console.log('');
      console.log(chalk.red(`  共发现 ${report.errors.length} 个错误，请查看 errors.log 获取详情`));
      console.log('');
    }

    console.log(chalk.gray(`报告文件已保存到: ${this.outputDir}`));
    console.log('');
  }
}
