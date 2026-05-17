import * as fs from 'fs';
import * as path from 'path';
import { AnalysisResult, CLIOptions, StageAggregation, TimeAttribution, BadLine } from '../types';

export class MarkdownOutput {
  write(result: AnalysisResult, options: CLIOptions): string {
    const outputPath = this.getOutputPath(options);
    this.ensureOutputDir(outputPath);
    
    const markdown = this.generateMarkdown(result);
    fs.writeFileSync(outputPath, markdown, 'utf8');
    
    return outputPath;
  }

  private getOutputPath(options: CLIOptions): string {
    if (options.outputMarkdown) {
      return options.outputMarkdown;
    }

    const inputName = path.basename(options.input, path.extname(options.input));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${inputName}-analysis-${timestamp}.md`;

    if (options.outputDir) {
      return path.join(options.outputDir, filename);
    }

    return path.join(process.cwd(), filename);
  }

  private ensureOutputDir(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private generateMarkdown(result: AnalysisResult): string {
    const lines: string[] = [];
    
    lines.push('# CI 缓存命中分析报告');
    lines.push('');
    lines.push(`> 生成时间: ${new Date(result.metadata.generatedAt).toLocaleString()}`);
    lines.push(`> 输入文件: \`${result.metadata.inputFile}\``);
    lines.push('');

    lines.push('## 📊 执行摘要');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总阶段数 | ${result.summary.totalStages} |`);
    lines.push(`| 缓存命中次数 | ${result.summary.totalCacheHits} |`);
    lines.push(`| 缓存未命中次数 | ${result.summary.totalCacheMisses} |`);
    lines.push(`| 命中率 | ${(result.summary.hitRate * 100).toFixed(2)}% |`);
    lines.push(`| 总耗时 | ${this.formatDuration(result.summary.totalDurationMs)} |`);
    lines.push(`| 缓存未命中额外耗时 | ${this.formatDuration(result.summary.cacheMissOverheadMs)} |`);
    lines.push(`| 成功解析行数 | ${result.metadata.parsedLines}/${result.metadata.totalLines} |`);
    lines.push(`| 异常行数 | ${result.metadata.badLines} |`);
    lines.push('');

    if (result.recommendations.length > 0) {
      lines.push('## 💡 优化建议');
      lines.push('');
      result.recommendations.forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec}`);
      });
      lines.push('');
    }

    lines.push('## 📋 各阶段详情');
    lines.push('');
    lines.push('| 阶段 | 命中 | 未命中 | 命中率 | 总耗时 | 平均耗时 |');
    lines.push('|------|------|--------|--------|--------|----------|');
    
    for (const stage of result.stages) {
      const totalChecks = stage.hitCount + stage.missCount;
      const hitRate = totalChecks > 0 ? (stage.hitCount / totalChecks * 100).toFixed(2) : 'N/A';
      
      lines.push(`| ${stage.name} | ${stage.hitCount} | ${stage.missCount} | ${hitRate}% | ${this.formatDuration(stage.totalDurationMs)} | ${this.formatDuration(stage.avgDurationMs)} |`);
    }
    lines.push('');

    lines.push('## ⏱️  耗时归因分析');
    lines.push('');
    lines.push('| 阶段 | 总耗时 | 缓存未命中额外耗时 | 占总时间比例 |');
    lines.push('|------|--------|--------------------|--------------|');
    
    for (const timeAttr of result.timeAttribution) {
      lines.push(`| ${timeAttr.stage} | ${this.formatDuration(timeAttr.totalTimeMs)} | ${this.formatDuration(timeAttr.cacheMissOverheadMs)} | ${timeAttr.percentageOfTotal}% |`);
    }
    lines.push('');

    const changedKeys = result.cacheKeyChanges.filter(c => c.isChanged);
    if (changedKeys.length > 0) {
      lines.push('## 🔑 缓存键变化');
      lines.push('');
      
      for (const change of changedKeys) {
        lines.push(`### ${change.stage}`);
        lines.push('');
        lines.push(`- **当前键**: \`${change.key}\``);
        lines.push(`- **之前键**: \`${change.previousKey}\``);
        if (change.changedParts) {
          lines.push(`- **变化部分**: ${change.changedParts.join(', ')}`);
        }
        lines.push('');
      }
    }

    if (result.badLines.length > 0) {
      lines.push('## ⚠️  异常日志行');
      lines.push('');
      lines.push('| 行号 | 原因 | 原始内容 |');
      lines.push('|------|------|----------|');
      
      for (const badLine of result.badLines) {
        const rawContent = badLine.raw.length > 100 
          ? badLine.raw.substring(0, 100) + '...' 
          : badLine.raw;
        lines.push(`| ${badLine.lineNumber} | ${badLine.reason} | \`${rawContent}\` |`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('*此报告由 CI Cache Analyzer 自动生成*');

    return lines.join('\n');
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

export function writeMarkdownOutput(result: AnalysisResult, options: CLIOptions): string {
  const output = new MarkdownOutput();
  return output.write(result, options);
}
