import { table } from 'table';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import {
  ImpactReport,
  FileAnalysis,
  RiskLevel,
  GroupedAnalysis
} from '../types';

const RISK_COLORS: Record<RiskLevel, (text: string) => string> = {
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.green
};

const RISK_ICONS: Record<RiskLevel, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢'
};

export class ReportGenerator {
  private report: ImpactReport;

  constructor(report: ImpactReport) {
    this.report = report;
  }

  generateTerminalTable(): string {
    const output: string[] = [];
    
    output.push(this.generateHeader());
    output.push('');
    output.push(this.generateSummaryTable());
    output.push('');
    
    if (this.report.summary.criticalFiles > 0) {
      output.push(this.generateRiskSection('critical'));
      output.push('');
    }
    
    if (this.report.summary.highRiskFiles > 0) {
      output.push(this.generateRiskSection('high'));
      output.push('');
    }
    
    if (this.report.summary.mediumRiskFiles > 0) {
      output.push(this.generateRiskSection('medium'));
      output.push('');
    }
    
    output.push(this.generateCommandsSection());
    output.push('');
    
    if (this.report.allConfirmations.length > 0) {
      output.push(this.generateConfirmationsSection());
      output.push('');
    }
    
    output.push(this.generateModulesSection());
    output.push('');
    
    output.push(this.generateOwnersSection());
    
    return output.join('\n');
  }

  private generateHeader(): string {
    const lines: string[] = [];
    
    lines.push(chalk.bold.underline(`📋 Release Scope Report - ${this.report.projectName}`));
    lines.push(`生成时间: ${new Date(this.report.generatedAt).toLocaleString('zh-CN')}`);
    
    const scope = this.report.scope;
    if (scope.fromRef && scope.toRef) {
      lines.push(`对比范围: ${scope.fromRef} → ${scope.toRef}`);
    } else if (scope.fromRef) {
      lines.push(`对比范围: ${scope.fromRef} 到当前 HEAD`);
    } else if (scope.isWorkingDir) {
      lines.push(`对比范围: 当前工作区（未提交改动）`);
    } else {
      lines.push(`对比范围: 示例数据`);
    }
    
    return lines.join('\n');
  }

  private generateSummaryTable(): string {
    const data = [
      [
        chalk.bold('📊 统计项'),
        chalk.bold('数值')
      ],
      ['总改动文件', String(this.report.summary.totalFiles)],
      ['🔴 Critical', RISK_COLORS.critical(String(this.report.summary.criticalFiles))],
      ['🟠 High', RISK_COLORS.high(String(this.report.summary.highRiskFiles))],
      ['🟡 Medium', RISK_COLORS.medium(String(this.report.summary.mediumRiskFiles))],
      ['🟢 Low', RISK_COLORS.low(String(this.report.summary.lowRiskFiles))],
      ['代码行数 (新增/删除)', `${this.report.summary.totalInsertions}+ / ${this.report.summary.totalDeletions}-`]
    ];

    return table(data, {
      header: {
        alignment: 'center',
        content: chalk.bold('📁 改动统计')
      }
    });
  }

  private generateRiskSection(riskLevel: RiskLevel): string {
    const files = this.report.grouped.byRiskLevel.get(riskLevel) || [];
    if (files.length === 0) return '';

    const color = RISK_COLORS[riskLevel];
    const icon = RISK_ICONS[riskLevel];
    
    const title = `${icon} ${riskLevel.toUpperCase()} 风险文件 (${files.length} 个)`;
    
    const data = [
      [
        chalk.bold('文件'),
        chalk.bold('模块'),
        chalk.bold('负责人'),
        chalk.bold('改动类型'),
        chalk.bold('匹配规则')
      ]
    ];

    for (const file of files.slice(0, 20)) {
      const moduleName = file.module || '未匹配';
      const owners = file.owners.length > 0 ? file.owners.join(', ') : '-';
      const changeType = this.formatChangeType(file.change.changeType);
      const matchedRules = file.matchedRules.map(r => r.rule.name).join(', ') || '-';
      
      let filePath = file.change.filePath;
      if (filePath.length > 40) {
        filePath = '...' + filePath.slice(-37);
      }

      data.push([
        color(filePath),
        moduleName,
        owners,
        changeType,
        matchedRules.length > 30 ? matchedRules.slice(0, 27) + '...' : matchedRules
      ]);
    }

    if (files.length > 20) {
      data.push([
        chalk.gray(`... 还有 ${files.length - 20} 个文件，请查看完整报告`),
        '', '', '', ''
      ]);
    }

    return table(data, {
      header: {
        alignment: 'center',
        content: color(title)
      }
    });
  }

  private formatChangeType(changeType: string): string {
    const typeMap: Record<string, string> = {
      added: '+ 新增',
      modified: '✏️ 修改',
      deleted: '- 删除',
      renamed: '🔄 重命名',
      copied: '📋 复制'
    };
    return typeMap[changeType] || changeType;
  }

  private generateCommandsSection(): string {
    const commands = this.report.allCheckCommands;
    
    if (commands.length === 0) {
      return chalk.gray('⚠️  没有建议执行的检查命令');
    }

    const lines: string[] = [];
    lines.push(chalk.bold('🛠️  建议执行的检查命令（按优先级排序）'));
    lines.push('');
    
    for (let i = 0; i < commands.length; i++) {
      lines.push(`  ${i + 1}. ${chalk.cyan(commands[i])}`);
    }
    
    return lines.join('\n');
  }

  private generateConfirmationsSection(): string {
    const confirmations = this.report.allConfirmations;
    
    const lines: string[] = [];
    lines.push(chalk.bold.red('⚠️  需要人工确认的事项'));
    lines.push('');
    
    for (let i = 0; i < confirmations.length; i++) {
      lines.push(`  [ ] ${chalk.yellow(confirmations[i])}`);
    }
    
    return lines.join('\n');
  }

  private generateModulesSection(): string {
    const modules = this.report.grouped.byModule;
    
    if (modules.size === 0) {
      return chalk.gray('⚠️  没有文件匹配到任何模块');
    }

    const data = [
      [
        chalk.bold('模块'),
        chalk.bold('文件数'),
        chalk.bold('负责人'),
        chalk.bold('风险分布')
      ]
    ];

    for (const [moduleName, files] of modules.entries()) {
      const owners = files[0]?.owners.join(', ') || '-';
      const riskDist = this.calculateRiskDistribution(files);
      
      data.push([
        chalk.bold(moduleName),
        String(files.length),
        owners,
        riskDist
      ]);
    }

    return table(data, {
      header: {
        alignment: 'center',
        content: chalk.bold('📦 按模块分组')
      }
    });
  }

  private calculateRiskDistribution(files: FileAnalysis[]): string {
    const counts: Record<RiskLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const file of files) {
      counts[file.riskLevel]++;
    }

    const parts: string[] = [];
    if (counts.critical > 0) parts.push(`🔴${counts.critical}`);
    if (counts.high > 0) parts.push(`🟠${counts.high}`);
    if (counts.medium > 0) parts.push(`🟡${counts.medium}`);
    if (counts.low > 0) parts.push(`🟢${counts.low}`);

    return parts.join(' ') || '-';
  }

  private generateOwnersSection(): string {
    const owners = this.report.grouped.byOwner;
    
    if (owners.size === 0) {
      return chalk.gray('⚠️  没有指定负责人');
    }

    const data = [
      [
        chalk.bold('负责人'),
        chalk.bold('文件数'),
        chalk.bold('涉及模块')
      ]
    ];

    for (const [owner, files] of owners.entries()) {
      const modules = new Set<string>();
      for (const file of files) {
        if (file.module) modules.add(file.module);
      }

      data.push([
        chalk.bold(owner),
        String(files.length),
        Array.from(modules).join(', ') || '-'
      ]);
    }

    return table(data, {
      header: {
        alignment: 'center',
        content: chalk.bold('👥 按负责人分组')
      }
    });
  }

  generateJSON(pretty: boolean = true): string {
    const reportForJSON = {
      ...this.report,
      grouped: {
        byModule: Object.fromEntries(this.report.grouped.byModule.entries()),
        byOwner: Object.fromEntries(this.report.grouped.byOwner.entries()),
        byRiskLevel: Object.fromEntries(this.report.grouped.byRiskLevel.entries())
      }
    };
    
    return pretty 
      ? JSON.stringify(reportForJSON, null, 2) 
      : JSON.stringify(reportForJSON);
  }

  generateMarkdown(): string {
    const lines: string[] = [];
    
    lines.push(`# 📋 Release Scope Report: ${this.report.projectName}`);
    lines.push('');
    lines.push(`> 生成时间: ${new Date(this.report.generatedAt).toLocaleString('zh-CN')}`);
    lines.push('');
    
    const scope = this.report.scope;
    lines.push('## 📌 对比范围');
    lines.push('');
    if (scope.fromRef && scope.toRef) {
      lines.push(`- **Commit 范围**: \`${scope.fromRef}\` → \`${scope.toRef}\``);
    } else if (scope.fromRef) {
      lines.push(`- **Commit 范围**: \`${scope.fromRef}\` → HEAD`);
    } else if (scope.isWorkingDir) {
      lines.push(`- **范围**: 当前工作区（未提交改动）`);
    } else {
      lines.push(`- **范围**: 示例数据`);
    }
    lines.push('');

    lines.push('## 📊 改动统计');
    lines.push('');
    lines.push('| 风险级别 | 文件数 |');
    lines.push('|---------|-------|');
    lines.push(`| 🔴 Critical | ${this.report.summary.criticalFiles} |`);
    lines.push(`| 🟠 High | ${this.report.summary.highRiskFiles} |`);
    lines.push(`| 🟡 Medium | ${this.report.summary.mediumRiskFiles} |`);
    lines.push(`| 🟢 Low | ${this.report.summary.lowRiskFiles} |`);
    lines.push(`| **总计** | **${this.report.summary.totalFiles}** |`);
    lines.push('');
    lines.push(`- **代码行数**: +${this.report.summary.totalInsertions} / -${this.report.summary.totalDeletions}`);
    lines.push('');

    const riskLevels: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
    
    for (const riskLevel of riskLevels) {
      const files = this.report.grouped.byRiskLevel.get(riskLevel);
      if (!files || files.length === 0) continue;
      
      const icon = RISK_ICONS[riskLevel];
      lines.push(`## ${icon} ${riskLevel.toUpperCase()} 风险文件`);
      lines.push('');
      
      for (const file of files) {
        lines.push(`### \`${file.change.filePath}\``);
        lines.push('');
        lines.push(`- **改动类型**: ${this.formatChangeTypeForMarkdown(file.change.changeType)}`);
        lines.push(`- **所属模块**: ${file.module || '未匹配'}`);
        lines.push(`- **负责人**: ${file.owners.length > 0 ? file.owners.join(', ') : '未指定'}`);
        lines.push(`- **风险评分**: ${file.score}/100`);
        
        if (file.matchedRules.length > 0) {
          lines.push(`- **匹配规则**: ${file.matchedRules.map(r => r.rule.name).join(', ')}`);
        }
        
        if (file.checkCommands.length > 0) {
          lines.push(`- **建议检查命令**:`);
          for (const cmd of file.checkCommands.slice(0, 5)) {
            lines.push(`  - \`${cmd}\``);
          }
          if (file.checkCommands.length > 5) {
            lines.push(`  - ... 还有 ${file.checkCommands.length - 5} 个`);
          }
        }
        
        lines.push('');
      }
    }

    lines.push('## 🛠️  建议执行的检查命令');
    lines.push('');
    lines.push('按优先级排序（Required > Recommended > Optional）：');
    lines.push('');
    lines.push('```bash');
    for (const cmd of this.report.allCheckCommands) {
      lines.push(`# ${cmd}`);
    }
    lines.push('```');
    lines.push('');

    if (this.report.allConfirmations.length > 0) {
      lines.push('## ⚠️  需要人工确认的事项');
      lines.push('');
      for (const confirmation of this.report.allConfirmations) {
        lines.push(`- [ ] ${confirmation}`);
      }
      lines.push('');
    }

    lines.push('## 📦 模块分布');
    lines.push('');
    lines.push('| 模块 | 文件数 | 负责人 |');
    lines.push('|-----|-------|-------|');
    
    for (const [moduleName, files] of this.report.grouped.byModule.entries()) {
      const owners = files[0]?.owners.join(', ') || '-';
      lines.push(`| ${moduleName} | ${files.length} | ${owners} |`);
    }
    lines.push('');

    lines.push('## 👥 负责人汇总');
    lines.push('');
    lines.push('| 负责人 | 文件数 |');
    lines.push('|-------|-------|');
    
    for (const [owner, files] of this.report.grouped.byOwner.entries()) {
      lines.push(`| ${owner} | ${files.length} |`);
    }
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('*此报告由 release-scope 工具自动生成*');
    
    return lines.join('\n');
  }

  private formatChangeTypeForMarkdown(changeType: string): string {
    const typeMap: Record<string, string> = {
      added: '新增 (A)',
      modified: '修改 (M)',
      deleted: '删除 (D)',
      renamed: '重命名 (R)',
      copied: '复制 (C)'
    };
    return typeMap[changeType] || changeType;
  }

  async exportToFile(filePath: string, format: 'json' | 'markdown'): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    
    let content: string;
    if (format === 'json') {
      content = this.generateJSON(true);
    } else {
      content = this.generateMarkdown();
    }
    
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }
}
