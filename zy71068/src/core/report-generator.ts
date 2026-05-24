import path from 'path';
import { table } from 'table';
import chalk from 'chalk';
import { AuditResult, RiskLevel, Risk } from '../types.js';
import { writeJsonFile, writeTextFile, getRelativePath } from '../utils/file-utils.js';
import { logger, riskColor } from '../utils/logger.js';

export class ReportGenerator {
  private projectDir: string;
  private outputDir: string;

  constructor(projectDir: string, outputDir: string) {
    this.projectDir = projectDir;
    this.outputDir = outputDir;
  }

  generateTerminalSummary(result: AuditResult): void {
    const { summary, risks } = result;

    logger.section('审计摘要');

    const statsData = [
      ['指标', '数值'],
      ['字体文件数', summary.totalFontFiles.toString()],
      ['字体引用数', summary.totalReferences.toString()],
      ['授权记录数', summary.totalLicenses.toString()],
      ['缺失授权', this.colorizeNumber(summary.missingLicenses, summary.missingLicenses > 0)],
      ['远程字体', this.colorizeNumber(summary.remoteFonts, summary.remoteFonts > 0)],
      ['版本冲突', this.colorizeNumber(summary.versionConflicts, summary.versionConflicts > 0)],
      ['过期授权', this.colorizeNumber(summary.expiredLicenses, summary.expiredLicenses > 0)],
    ];

    console.log(table(statsData));

    logger.section('风险统计');

    const riskData = [
      ['风险等级', '数量', ''],
      [riskColor('critical')('CRITICAL'), summary.risksByLevel.critical.toString(), this.getRiskIcon(summary.risksByLevel.critical)],
      [riskColor('high')('HIGH'), summary.risksByLevel.high.toString(), this.getRiskIcon(summary.risksByLevel.high)],
      [riskColor('medium')('MEDIUM'), summary.risksByLevel.medium.toString(), this.getRiskIcon(summary.risksByLevel.medium)],
      [riskColor('low')('LOW'), summary.risksByLevel.low.toString(), this.getRiskIcon(summary.risksByLevel.low)],
      [riskColor('info')('INFO'), summary.risksByLevel.info.toString(), this.getRiskIcon(summary.risksByLevel.info)],
    ];

    console.log(table(riskData));

    if (risks.length > 0) {
      logger.section('风险详情');
      this.printRiskTable(risks);
    }

    logger.section('输出文件');
    logger.info(`JSON 报告: ${path.join(this.outputDir, 'audit-report.json')}`);
    logger.info(`Markdown 报告: ${path.join(this.outputDir, 'audit-report.md')}`);
  }

  private colorizeNumber(value: number, isWarning: boolean): string {
    if (isWarning) {
      return chalk.yellow.bold(value.toString());
    }
    return chalk.green(value.toString());
  }

  private getRiskIcon(count: number): string {
    if (count === 0) return '✓';
    return '⚠';
  }

  private printRiskTable(risks: Risk[]): void {
    const levels: RiskLevel[] = ['critical', 'high', 'medium', 'low', 'info'];
    const sortedRisks = [...risks].sort((a, b) => levels.indexOf(a.level) - levels.indexOf(b.level));

    const riskTableData = [
      ['等级', '类别', '描述'],
      ...sortedRisks.slice(0, 20).map((r) => [
        riskColor(r.level)(r.level.toUpperCase()),
        r.category,
        r.message.length > 60 ? r.message.slice(0, 57) + '...' : r.message,
      ]),
    ];

    console.log(table(riskTableData));

    if (risks.length > 20) {
      logger.info(`... 还有 ${risks.length - 20} 条风险记录，请查看完整报告`);
    }
  }

  async generateJsonReport(result: AuditResult): Promise<string> {
    const filePath = path.join(this.outputDir, 'audit-report.json');

    const serializableResult = {
      ...result,
      metadata: {
        ...result.metadata,
        timestamp: result.metadata.timestamp.toISOString(),
      },
      fonts: {
        ...result.fonts,
        files: result.fonts.files.map((f) => ({
          ...f,
          lastModified: f.lastModified.toISOString(),
          relativePath: getRelativePath(this.projectDir, f.path),
        })),
        references: result.fonts.references.map((r) => ({
          ...r,
          relativePath: getRelativePath(this.projectDir, r.sourcePath),
        })),
        unmatchedReferences: result.fonts.unmatchedReferences.map((r) => ({
          ...r,
          relativePath: getRelativePath(this.projectDir, r.sourcePath),
        })),
      },
      licenses: {
        ...result.licenses,
        entries: result.licenses.entries.map((l) => ({
          ...l,
          validFrom: l.validFrom?.toISOString(),
          validUntil: l.validUntil?.toISOString(),
        })),
        matched: Array.from(result.licenses.matched.entries()),
      },
    };

    await writeJsonFile(filePath, serializableResult);
    return filePath;
  }

  async generateMarkdownReport(result: AuditResult): Promise<string> {
    const filePath = path.join(this.outputDir, 'audit-report.md');

    const content = this.buildMarkdownContent(result);
    await writeTextFile(filePath, content);
    return filePath;
  }

  private buildMarkdownContent(result: AuditResult): string {
    const { metadata, summary, risks, fonts, licenses } = result;

    let md = `# 字体资产授权审计报告\n\n`;
    md += `> 生成时间: ${metadata.timestamp.toLocaleString('zh-CN')}\n`;
    md += `> 工具版本: ${metadata.version}\n`;
    md += `> 项目目录: ${metadata.projectDir}\n\n`;

    md += `## 📊 审计摘要\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 字体文件数 | ${summary.totalFontFiles} |\n`;
    md += `| 字体引用数 | ${summary.totalReferences} |\n`;
    md += `| 授权记录数 | ${summary.totalLicenses} |\n`;
    md += `| 缺失授权 | ${summary.missingLicenses} |\n`;
    md += `| 远程字体 | ${summary.remoteFonts} |\n`;
    md += `| 版本冲突 | ${summary.versionConflicts} |\n`;
    md += `| 过期授权 | ${summary.expiredLicenses} |\n\n`;

    md += `## ⚠️ 风险统计\n\n`;
    md += `| 风险等级 | 数量 |\n`;
    md += `|----------|------|\n`;
    md += `| 🔴 CRITICAL | ${summary.risksByLevel.critical} |\n`;
    md += `| 🟠 HIGH | ${summary.risksByLevel.high} |\n`;
    md += `| 🟡 MEDIUM | ${summary.risksByLevel.medium} |\n`;
    md += `| 🔵 LOW | ${summary.risksByLevel.low} |\n`;
    md += `| ⚪ INFO | ${summary.risksByLevel.info} |\n\n`;

    if (risks.length > 0) {
      md += `## 🚨 风险详情\n\n`;
      const levels: RiskLevel[] = ['critical', 'high', 'medium', 'low', 'info'];
      const sortedRisks = [...risks].sort((a, b) => levels.indexOf(a.level) - levels.indexOf(b.level));

      for (const risk of sortedRisks) {
        const levelEmoji = this.getLevelEmoji(risk.level);
        md += `### ${levelEmoji} ${risk.level.toUpperCase()}: ${risk.category}\n\n`;
        md += `${risk.message}\n\n`;
        if (Object.keys(risk.details).length > 0) {
          md += `**详细信息:**\n`;
          md += '```json\n';
          md += JSON.stringify(risk.details, null, 2);
          md += '\n```\n\n';
        }
      }
    }

    md += `## 📁 字体文件清单\n\n`;
    if (fonts.files.length > 0) {
      md += `| 字体名称 | 格式 | 大小 | 版本 | 字重 | 样式 |\n`;
      md += `|----------|------|------|------|------|------|\n`;
      for (const font of fonts.files) {
        md += `| ${font.familyName} | ${font.format.toUpperCase()} | ${this.formatSize(font.size)} | ${font.version || '-'} | ${font.weight || '-'} | ${font.style || '-'} |\n`;
      }
    } else {
      md += `未发现字体文件\n`;
    }
    md += `\n`;

    md += `## 🔗 字体引用清单\n\n`;
    if (fonts.references.length > 0) {
      md += `| 字体名称 | 来源 | 类型 | 格式 | 远程 |\n`;
      md += `|----------|------|------|------|------|\n`;
      for (const ref of fonts.references) {
        md += `| ${ref.familyName} | ${ref.source} | ${ref.isRemote ? '远程' : '本地'} | ${ref.formats.join(', ') || '-'} | ${ref.isRemote ? '✅' : '❌'} |\n`;
      }
    } else {
      md += `未发现字体引用\n`;
    }
    md += `\n`;

    if (fonts.unmatchedReferences.length > 0) {
      md += `## ❓ 未匹配的引用\n\n`;
      for (const ref of fonts.unmatchedReferences) {
        md += `- \`${ref.familyName}\` in \`${getRelativePath(this.projectDir, ref.sourcePath)}\`\n`;
      }
      md += `\n`;
    }

    md += `## 📜 授权清单\n\n`;
    if (licenses.entries.length > 0) {
      md += `| 字体名称 | 授权类型 | 有效期至 | 状态 |\n`;
      md += `|----------|----------|----------|------|\n`;
      for (const license of licenses.entries) {
        const status = license.validUntil
          ? license.validUntil > new Date()
            ? '有效'
            : '已过期'
          : '永久';
        md += `| ${license.familyName} | ${license.licenseType} | ${license.validUntil?.toLocaleDateString('zh-CN') || '永久'} | ${status === '有效' ? '✅' : status === '已过期' ? '❌' : '♾️'} |\n`;
      }
    } else {
      md += `未提供授权清单\n`;
    }
    md += `\n`;

    md += `---\n\n`;
    md += `*本报告由 font-license-audit 工具自动生成*\n`;

    return md;
  }

  private getLevelEmoji(level: RiskLevel): string {
    switch (level) {
      case 'critical':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      case 'info':
        return '⚪';
      default:
        return '•';
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async generateAll(result: AuditResult): Promise<{
    json: string;
    markdown: string;
  }> {
    const [json, markdown] = await Promise.all([
      this.generateJsonReport(result),
      this.generateMarkdownReport(result),
    ]);

    return { json, markdown };
  }
}
