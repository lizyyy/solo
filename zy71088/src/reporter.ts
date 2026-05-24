import * as fs from 'fs';
import * as path from 'path';
import chalk = require('chalk');
import { AnalysisResult, ReportConfig, RiskLevel } from './types';
import { RISK_LEVEL_WEIGHTS } from './constants';

const RISK_COLORS: Record<RiskLevel, chalk.Chalk> = {
  safe: chalk.green,
  low: chalk.blue,
  medium: chalk.yellow,
  high: chalk.red,
  critical: chalk.bgRed.white,
};

const RISK_ICONS: Record<RiskLevel, string> = {
  safe: '✓',
  low: 'ℹ',
  medium: '⚠',
  high: '✗',
  critical: '☠',
};

export function generateTerminalSummary(result: AnalysisResult, verbose: boolean = false): string {
  const { summary, flags } = result;
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('════════════════════════════════════════════════════════════'));
  lines.push(chalk.bold.cyan('              Feature Flag 死码分析报告'));
  lines.push(chalk.bold.cyan('════════════════════════════════════════════════════════════'));
  lines.push('');

  lines.push(chalk.bold('📊 扫描摘要:'));
  lines.push(`  ${chalk.gray('扫描文件:')} ${chalk.white(summary.filesScanned)} 个`);
  lines.push(`  ${chalk.gray('扫描 Flag:')} ${chalk.white(summary.flagsScanned)} 个`);
  lines.push(`  ${chalk.gray('匹配次数:')} ${chalk.white(summary.totalMatches)} 次`);
  lines.push(`  ${chalk.gray('扫描耗时:')} ${chalk.white(summary.scanDuration)}ms`);
  lines.push('');

  lines.push(chalk.bold('🎯 分析结果:'));
  lines.push(`  ${chalk.green('可安全删除:')} ${chalk.bold.green(summary.flagsCanRemove)} 个`);
  lines.push(`  ${chalk.red('高风险 Flag:')} ${chalk.bold.red(summary.flagsWithRisk)} 个`);
  lines.push('');

  lines.push(chalk.bold('🚩 Flag 风险分布:'));
  const riskCounts: Record<RiskLevel, number> = { safe: 0, low: 0, medium: 0, high: 0, critical: 0 };
  flags.forEach(f => riskCounts[f.riskLevel]++);
  
  (Object.keys(riskCounts) as RiskLevel[]).forEach(level => {
    const count = riskCounts[level];
    if (count > 0 || verbose) {
      const color = RISK_COLORS[level];
      lines.push(`  ${RISK_ICONS[level]} ${color(level.toUpperCase().padEnd(8))}: ${color(count.toString())} 个`);
    }
  });
  lines.push('');

  if (verbose) {
    lines.push(chalk.bold('📋 Flag 详细列表:'));
    flags.forEach(analysis => {
      const color = RISK_COLORS[analysis.riskLevel];
      const statusIcon = analysis.canRemove ? '🗑️' : '🔒';
      lines.push('');
      lines.push(`  ${statusIcon} ${chalk.bold(analysis.flag.name)}`);
      lines.push(`     风险等级: ${color(analysis.riskLevel)}`);
      lines.push(`     出现次数: ${analysis.totalOccurrences} 次 (${analysis.fileCount} 个文件)`);
      lines.push(`     默认值: ${analysis.flag.defaultValue ? 'true' : 'false'}`);
      lines.push(`     实验状态: ${analysis.flag.status}`);
      if (analysis.flag.owner) {
        lines.push(`     负责人: ${analysis.flag.owner}`);
      }
      if (analysis.riskReasons.length > 0) {
        lines.push(`     风险原因:`);
        analysis.riskReasons.forEach(reason => {
          lines.push(`       • ${reason}`);
        });
      }
      lines.push(`     建议: ${chalk.italic(analysis.recommendation)}`);
    });
    lines.push('');
  }

  if (!verbose) {
    const highRiskFlags = flags.filter(f => f.riskLevel === 'high' || f.riskLevel === 'critical');
    if (highRiskFlags.length > 0) {
      lines.push(chalk.bold.red('⚠️  高风险 Flag 列表:'));
      highRiskFlags.forEach(f => {
        const color = RISK_COLORS[f.riskLevel];
        lines.push(`  ${RISK_ICONS[f.riskLevel]} ${color(f.flag.name)} - ${f.riskReasons[0] || ''}`);
      });
      lines.push('');
    }

    const safeFlags = flags.filter(f => f.canRemove && f.totalOccurrences > 0).slice(0, 5);
    if (safeFlags.length > 0) {
      lines.push(chalk.bold.green('✅ 建议优先删除的 Flag:'));
      safeFlags.forEach(f => {
        lines.push(`  • ${f.flag.name} (${f.totalOccurrences} 处)`);
      });
      if (safeFlags.length < summary.flagsCanRemove) {
        lines.push(`  ... 还有 ${summary.flagsCanRemove - safeFlags.length} 个可删除的 Flag`);
      }
      lines.push('');
    }
  }

  if (result.errors.length > 0) {
    lines.push(chalk.bold.yellow(`⚠️  扫描过程中遇到 ${result.errors.length} 个错误:`));
    result.errors.slice(0, 5).forEach(err => {
      lines.push(`  • ${err}`);
    });
    if (result.errors.length > 5) {
      lines.push(`  ... 还有 ${result.errors.length - 5} 个错误`);
    }
    lines.push('');
  }

  lines.push(chalk.gray(`使用 -v 或 --verbose 查看完整报告`));
  lines.push(chalk.gray(`报告文件已生成到: ${result.metadata.options.outputDir}`));
  lines.push('');

  return lines.join('\n');
}

export function generateJsonReport(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}

export function generateMarkdownReport(result: AnalysisResult): string {
  const { summary, flags, files } = result;
  const lines: string[] = [];

  lines.push('# Feature Flag 死码分析报告');
  lines.push('');
  lines.push(`> 生成时间: ${new Date(result.metadata.scanDate).toLocaleString()}`);
  lines.push(`> 工具版本: ${result.metadata.version}`);
  lines.push(`> 源码目录: ${result.metadata.options.sourceDir}`);
  lines.push('');

  lines.push('## 📊 扫描摘要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 扫描文件数 | ${summary.filesScanned} |`);
  lines.push(`| 扫描 Flag 数 | ${summary.flagsScanned} |`);
  lines.push(`| 总匹配次数 | ${summary.totalMatches} |`);
  lines.push(`| 可安全删除 | ${summary.flagsCanRemove} |`);
  lines.push(`| 高风险 Flag | ${summary.flagsWithRisk} |`);
  lines.push(`| 扫描耗时 | ${summary.scanDuration}ms |`);
  lines.push('');

  lines.push('## 🎯 风险分布');
  lines.push('');
  const riskCounts: Record<RiskLevel, number> = { safe: 0, low: 0, medium: 0, high: 0, critical: 0 };
  flags.forEach(f => riskCounts[f.riskLevel]++);
  
  (Object.keys(riskCounts) as RiskLevel[]).forEach(level => {
    const count = riskCounts[level];
    const icon = RISK_ICONS[level];
    lines.push(`- **${level.toUpperCase()}** ${icon}: ${count} 个`);
  });
  lines.push('');

  lines.push('## 📋 Flag 详细分析');
  lines.push('');

  flags.forEach(analysis => {
    const statusBadge = analysis.canRemove ? '🟢 可删除' : '🔴 暂不删除';
    const riskBadge = `[${analysis.riskLevel.toUpperCase()}]`;
    
    lines.push(`### ${analysis.flag.name} ${statusBadge}`);
    lines.push('');
    lines.push(`| 属性 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 风险等级 | \`${riskBadge}\` |`);
    lines.push(`| 出现次数 | ${analysis.totalOccurrences} 次 |`);
    lines.push(`| 涉及文件 | ${analysis.fileCount} 个 |`);
    lines.push(`| 默认值 | \`${analysis.flag.defaultValue}\` |`);
    lines.push(`| 实验状态 | \`${analysis.flag.status}\` |`);
    if (analysis.flag.owner) {
      lines.push(`| 负责人 | ${analysis.flag.owner} |`);
    }
    if (analysis.flag.completedAt) {
      lines.push(`| 完成时间 | ${analysis.flag.completedAt} |`);
    }
    lines.push('');

    if (analysis.flag.description) {
      lines.push(`> ${analysis.flag.description}`);
      lines.push('');
    }

    if (analysis.riskReasons.length > 0) {
      lines.push('#### ⚠️ 风险原因');
      lines.push('');
      analysis.riskReasons.forEach(reason => {
        lines.push(`- ${reason}`);
      });
      lines.push('');
    }

    lines.push('#### 💡 清理建议');
    lines.push('');
    lines.push(`> ${analysis.recommendation}`);
    lines.push('');

    if (analysis.totalOccurrences > 0) {
      lines.push('#### 📍 代码位置');
      lines.push('');
      
      const fileGroups = new Map<string, typeof analysis.matches>();
      analysis.matches.forEach(m => {
        const existing = fileGroups.get(m.filePath) || [];
        existing.push(m);
        fileGroups.set(m.filePath, existing);
      });

      fileGroups.forEach((matches, filePath) => {
        const relativePath = path.relative(result.metadata.options.sourceDir, filePath);
        lines.push(`- **${relativePath}**`);
        matches.slice(0, 3).forEach(m => {
          const matchType = m.isNegated ? '❌ 否定' : '✅ 肯定';
          lines.push(`  - 第 ${m.lineNumber} 行 (${matchType})`);
        });
        if (matches.length > 3) {
          lines.push(`  - ... 还有 ${matches.length - 3} 处`);
        }
      });
      lines.push('');
    }

    if (analysis.flag.notes) {
      lines.push('#### 📝 备注');
      lines.push('');
      lines.push(analysis.flag.notes);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  });

  lines.push('## 📁 受影响文件');
  lines.push('');
  
  if (files.length > 0) {
    lines.push('| 文件 | 语言 | 匹配次数 |');
    lines.push('|------|------|----------|');
    files.slice(0, 20).forEach(f => {
      const relativePath = path.relative(result.metadata.options.sourceDir, f.path);
      lines.push(`| ${relativePath} | ${f.language} | ${f.matchCount} |`);
    });
    if (files.length > 20) {
      lines.push(`| ... 还有 ${files.length - 20} 个文件 | | |`);
    }
  } else {
    lines.push('暂无匹配的文件');
  }
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('## ⚠️ 扫描错误');
    lines.push('');
    result.errors.forEach(err => {
      lines.push(`- ${err}`);
    });
    lines.push('');
  }

  lines.push('## 📌 风险等级说明');
  lines.push('');
  lines.push('- **SAFE** (安全): 可以直接删除，无风险');
  lines.push('- **LOW** (低): 建议删除，改动量小');
  lines.push('- **MEDIUM** (中): 谨慎操作，需要代码审查');
  lines.push('- **HIGH** (高): 高风险操作，建议确认实验状态');
  lines.push('- **CRITICAL** (极高): 极高风险！需要手动分析确认');
  lines.push('');

  return lines.join('\n');
}

export async function writeReports(
  result: AnalysisResult,
  config: ReportConfig
): Promise<{ jsonPath?: string; markdownPath?: string }> {
  const output: { jsonPath?: string; markdownPath?: string } = {};
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = config.baseName || `flag-cleaner-report-${timestamp}`;

  if (config.json) {
    const jsonPath = path.join(config.outputDir, `${baseName}.json`);
    fs.writeFileSync(jsonPath, generateJsonReport(result), 'utf-8');
    output.jsonPath = jsonPath;
  }

  if (config.markdown) {
    const mdPath = path.join(config.outputDir, `${baseName}.md`);
    fs.writeFileSync(mdPath, generateMarkdownReport(result), 'utf-8');
    output.markdownPath = mdPath;
  }

  return output;
}
