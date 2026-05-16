import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { table } from 'table';
import { DetectionResult, FixSuggestion, ParseError } from './types';

export class Reporter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = path.resolve(outputDir);
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  printSummary(result: DetectionResult, suggestions: FixSuggestion[], verbose: boolean): void {
    console.log('\n' + chalk.bold.blue('='.repeat(60)));
    console.log(chalk.bold.blue('  Docker Compose 端口冲突检测报告'));
    console.log(chalk.bold.blue('='.repeat(60)) + '\n');

    this.printScanInfo(result);
    this.printPortConflicts(result.portConflicts, verbose);
    this.printServiceNameConflicts(result.serviceNameConflicts);
    this.printParseErrors(result.parseErrors);
    this.printSuggestions(suggestions);
    this.printResultSummary(result);
  }

  private printScanInfo(result: DetectionResult): void {
    console.log(chalk.bold('📊 扫描信息'));
    console.log(`  Compose 文件: ${result.composeFiles.length} 个`);
    console.log(`  服务总数: ${result.totalServices} 个`);
    console.log(`  端口映射: ${result.totalPorts} 个`);
    console.log(`  扫描时间: ${new Date(result.scanTime).toLocaleString()}\n`);
  }

  private printPortConflicts(conflicts: DetectionResult['portConflicts'], verbose: boolean): void {
    if (conflicts.length === 0) {
      console.log(chalk.bold.green('✅ 未发现端口冲突\n'));
      return;
    }

    console.log(chalk.bold.red(`⚠️  发现 ${conflicts.length} 个端口冲突\n`));

    const severityColors: Record<string, any> = {
      high: chalk.bgRed.white,
      medium: chalk.bgYellow.black,
      low: chalk.bgBlue.white
    };

    const severityLabels: Record<string, string> = {
      high: '高',
      medium: '中',
      low: '低'
    };

    for (const conflict of conflicts) {
      const severityLabel = severityLabels[conflict.severity];
      const colorFn = severityColors[conflict.severity];

      console.log(`  ${colorFn(` ${severityLabel} `)} 端口 ${chalk.bold(conflict.port)}${conflict.hostIp ? ` (绑定 ${conflict.hostIp})` : ''}`);
      
      const tableData = [
        [chalk.gray('服务名'), chalk.gray('容器端口'), chalk.gray('文件位置')]
      ];

      for (const service of conflict.services) {
        const fileLocation = service.line 
          ? `${service.file}:${service.line}`
          : service.file;
        tableData.push([
          service.name,
          String(service.containerPort) + (service.protocol ? `/${service.protocol}` : ''),
          fileLocation
        ]);
      }

      console.log(table(tableData, {
        columns: { width: [20, 12, 40] },
        drawHorizontalLine: (index: number) => index === 0 || index === 1 || index === tableData.length
      }));
    }
  }

  private printServiceNameConflicts(conflicts: DetectionResult['serviceNameConflicts']): void {
    if (conflicts.length === 0) {
      console.log(chalk.bold.green('✅ 未发现服务名冲突\n'));
      return;
    }

    console.log(chalk.bold.yellow(`⚠️  发现 ${conflicts.length} 个服务名冲突\n`));

    for (const conflict of conflicts) {
      console.log(`  服务名: ${chalk.bold(conflict.name)}`);
      
      const tableData = [
        [chalk.gray('文件位置')]
      ];

      for (const service of conflict.services) {
        const fileLocation = service.line 
          ? `${service.file}:${service.line}`
          : service.file;
        tableData.push([fileLocation]);
      }

      console.log(table(tableData, {
        columns: { width: [60] },
        drawHorizontalLine: (index: number) => index === 0 || index === 1 || index === tableData.length
      }));
    }
  }

  private printParseErrors(errors: ParseError[]): void {
    if (errors.length === 0) return;

    const errorCount = errors.filter(e => e.severity === 'error').length;
    const warningCount = errors.filter(e => e.severity === 'warning').length;

    console.log(chalk.bold(`📝 解析问题 (${errorCount} 个错误, ${warningCount} 个警告)\n`));

    for (const error of errors) {
      const colorFn = error.severity === 'error' ? chalk.red : chalk.yellow;
      const location = error.line ? `${error.file}:${error.line}` : error.file;
      console.log(`  ${colorFn(error.severity.toUpperCase())} ${location}`);
      console.log(`    ${error.message}\n`);
    }
  }

  private printSuggestions(suggestions: FixSuggestion[]): void {
    if (suggestions.length === 0) return;

    console.log(chalk.bold('💡 修复建议\n'));

    for (const suggestion of suggestions) {
      const typeIcon = suggestion.conflictType === 'port' ? '🔌' : '🏷️';
      console.log(`  ${typeIcon} [#${suggestion.priority}] ${suggestion.description}`);
      console.log(`     ${chalk.green('→')} ${suggestion.action}`);
      console.log(`     ${chalk.gray('涉及文件:')} ${suggestion.affectedFiles.join(', ')}\n`);
    }
  }

  private printResultSummary(result: DetectionResult): void {
    const hasIssues = result.portConflicts.length > 0 || result.serviceNameConflicts.length > 0;
    const hasErrors = result.parseErrors.some(e => e.severity === 'error');

    if (hasErrors) {
      console.log(chalk.bold.red('❌ 扫描完成，但遇到解析错误，请检查输入文件'));
    } else if (hasIssues) {
      console.log(chalk.bold.yellow('⚠️  扫描完成，发现需要修复的问题'));
    } else {
      console.log(chalk.bold.green('✅ 扫描完成，未发现冲突！'));
    }
    console.log();
  }

  writeJsonReport(result: DetectionResult, suggestions: FixSuggestion[]): string {
    const report = {
      ...result,
      suggestions,
      summary: {
        portConflictCount: result.portConflicts.length,
        serviceNameConflictCount: result.serviceNameConflicts.length,
        errorCount: result.parseErrors.filter(e => e.severity === 'error').length,
        warningCount: result.parseErrors.filter(e => e.severity === 'warning').length
      }
    };

    const filePath = path.join(this.outputDir, 'port-conflicts.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
    return filePath;
  }

  writeMarkdownReport(result: DetectionResult, suggestions: FixSuggestion[]): string {
    let md = '# Docker Compose 端口冲突检测报告\n\n';
    md += `> 生成时间: ${new Date(result.scanTime).toLocaleString()}\n\n`;

    md += '## 📊 扫描概览\n\n';
    md += '| 指标 | 数值 |\n';
    md += '|------|------|\n';
    md += `| Compose 文件 | ${result.composeFiles.length} |\n`;
    md += `| 服务总数 | ${result.totalServices} |\n`;
    md += `| 端口映射 | ${result.totalPorts} |\n`;
    md += `| 端口冲突 | ${result.portConflicts.length} |\n`;
    md += `| 服务名冲突 | ${result.serviceNameConflicts.length} |\n\n`;

    md += '## 🔌 端口冲突详情\n\n';
    if (result.portConflicts.length === 0) {
      md += '✅ 未发现端口冲突\n\n';
    } else {
      for (const conflict of result.portConflicts) {
        md += `### 端口 ${conflict.port} ${conflict.hostIp ? `(${conflict.hostIp})` : ''} [${conflict.severity.toUpperCase()}]\n\n`;
        md += '| 服务名 | 容器端口 | 文件位置 |\n';
        md += '|--------|----------|----------|\n';
        
        for (const service of conflict.services) {
          const location = service.line 
            ? `${service.file}:${service.line}`
            : service.file;
          const port = service.containerPort + (service.protocol ? `/${service.protocol}` : '');
          md += `| ${service.name} | ${port} | \`${location}\` |\n`;
        }
        md += '\n';
      }
    }

    md += '## 🏷️ 服务名冲突详情\n\n';
    if (result.serviceNameConflicts.length === 0) {
      md += '✅ 未发现服务名冲突\n\n';
    } else {
      for (const conflict of result.serviceNameConflicts) {
        md += `### 服务名: ${conflict.name}\n\n`;
        md += '| 文件位置 |\n';
        md += '|----------|\n';
        
        for (const service of conflict.services) {
          const location = service.line 
            ? `${service.file}:${service.line}`
            : service.file;
          md += `| \`${location}\` |\n`;
        }
        md += '\n';
      }
    }

    md += '## 💡 修复建议\n\n';
    if (suggestions.length === 0) {
      md += '无需修复\n\n';
    } else {
      for (const suggestion of suggestions) {
        md += `### [#${suggestion.priority}] ${suggestion.description}\n\n`;
        md += `- **操作**: ${suggestion.action}\n`;
        md += `- **涉及文件**: ${suggestion.affectedFiles.map(f => `\`${f}\``).join(', ')}\n\n`;
      }
    }

    md += '## 📁 扫描的文件\n\n';
    for (const file of result.composeFiles) {
      md += `- \`${file}\`\n`;
    }
    md += '\n';

    const filePath = path.join(this.outputDir, 'port-conflicts-report.md');
    fs.writeFileSync(filePath, md, 'utf8');
    return filePath;
  }

  writeHtmlReport(result: DetectionResult, suggestions: FixSuggestion[]): string {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Docker Compose 端口冲突检测报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }
        h2 { color: #1e40af; margin-top: 30px; margin-bottom: 15px; }
        h3 { color: #374151; margin-top: 20px; margin-bottom: 10px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; margin-left: 10px; }
        .high { background: #dc2626; color: white; }
        .medium { background: #f59e0b; color: white; }
        .low { background: #3b82f6; color: white; }
        .success { background: #10b981; color: white; }
        .warning { background: #f59e0b; color: white; }
        .error { background: #dc2626; color: white; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f3f4f6; font-weight: 600; }
        tr:hover { background: #f9fafb; }
        code { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: 'Monaco', monospace; }
        .summary-card { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .card { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; }
        .card-value { font-size: 2em; font-weight: bold; color: #2563eb; }
        .card-label { color: #6b7280; font-size: 0.9em; }
        .suggestion { background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #10b981; }
        .suggestion-action { margin-top: 10px; font-weight: 500; }
        .file-list { background: #f8fafc; padding: 15px; border-radius: 8px; }
        .file-item { padding: 5px 0; font-family: 'Monaco', monospace; }
        .meta { color: #6b7280; font-size: 0.9em; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>🐳 Docker Compose 端口冲突检测报告</h1>
    <div class="meta">生成时间: ${new Date(result.scanTime).toLocaleString()}</div>

    <h2>📊 扫描概览</h2>
    <div class="summary-card">
        <div class="card">
            <div class="card-value">${result.composeFiles.length}</div>
            <div class="card-label">Compose 文件</div>
        </div>
        <div class="card">
            <div class="card-value">${result.totalServices}</div>
            <div class="card-label">服务总数</div>
        </div>
        <div class="card">
            <div class="card-value">${result.totalPorts}</div>
            <div class="card-label">端口映射</div>
        </div>
        <div class="card">
            <div class="card-value ${result.portConflicts.length > 0 ? '' : 'text-green'}">${result.portConflicts.length}</div>
            <div class="card-label">端口冲突</div>
        </div>
        <div class="card">
            <div class="card-value">${result.serviceNameConflicts.length}</div>
            <div class="card-label">服务名冲突</div>
        </div>
    </div>

    <h2>🔌 端口冲突详情</h2>
    ${result.portConflicts.length === 0 ? 
        '<p><span class="badge success">✅</span> 未发现端口冲突</p>' :
        result.portConflicts.map(conflict => `
        <h3>端口 ${conflict.port} ${conflict.hostIp ? `(${conflict.hostIp})` : ''} <span class="badge ${conflict.severity}">${conflict.severity.toUpperCase()}</span></h3>
        <table>
            <thead>
                <tr><th>服务名</th><th>容器端口</th><th>文件位置</th></tr>
            </thead>
            <tbody>
                ${conflict.services.map(service => `
                <tr>
                    <td><strong>${service.name}</strong></td>
                    <td>${service.containerPort}${service.protocol ? `/${service.protocol}` : ''}</td>
                    <td><code>${service.file}${service.line ? `:${service.line}` : ''}</code></td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        `).join('')
    }

    <h2>🏷️ 服务名冲突详情</h2>
    ${result.serviceNameConflicts.length === 0 ? 
        '<p><span class="badge success">✅</span> 未发现服务名冲突</p>' :
        result.serviceNameConflicts.map(conflict => `
        <h3>服务名: <code>${conflict.name}</code></h3>
        <table>
            <thead>
                <tr><th>文件位置</th></tr>
            </thead>
            <tbody>
                ${conflict.services.map(service => `
                <tr>
                    <td><code>${service.file}${service.line ? `:${service.line}` : ''}</code></td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        `).join('')
    }

    <h2>💡 修复建议</h2>
    ${suggestions.length === 0 ? 
        '<p>无需修复</p>' :
        suggestions.map(suggestion => `
        <div class="suggestion">
            <strong>[#${suggestion.priority}]</strong> ${suggestion.description}
            <div class="suggestion-action">→ ${suggestion.action}</div>
            <div style="margin-top: 8px; color: #6b7280; font-size: 0.9em;">
                涉及文件: ${suggestion.affectedFiles.map(f => `<code>${f}</code>`).join(', ')}
            </div>
        </div>
        `).join('')
    }

    <h2>📁 扫描的文件</h2>
    <div class="file-list">
        ${result.composeFiles.map(file => `<div class="file-item">📄 ${file}</div>`).join('')}
    </div>
</body>
</html>`;

    const filePath = path.join(this.outputDir, 'port-conflicts-report.html');
    fs.writeFileSync(filePath, html, 'utf8');
    return filePath;
  }
}