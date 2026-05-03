import * as fs from 'fs-extra';
import * as path from 'path';
import {
  ReportData,
  ReportFormat,
  ScanResult,
  ExecutionResult,
  UndoResult,
  Manifest
} from '../types';

export class ReportGenerator {
  async generate(
    data: ReportData,
    format: ReportFormat,
    outputPath?: string
  ): Promise<string> {
    let content: string;

    switch (format) {
      case 'json':
        content = this.generateJSON(data);
        break;
      case 'markdown':
        content = this.generateMarkdown(data);
        break;
      case 'html':
        content = this.generateHTML(data);
        break;
      default:
        throw new Error(`不支持的报告格式: ${format}`);
    }

    if (outputPath) {
      const dir = path.dirname(outputPath);
      await fs.ensureDir(dir);
      await fs.writeFile(outputPath, content, 'utf-8');
    }

    return content;
  }

  private generateJSON(data: ReportData): string {
    return JSON.stringify(data, null, 2);
  }

  private generateMarkdown(data: ReportData): string {
    const lines: string[] = [];

    lines.push(`# 文件归档报告`);
    lines.push('');
    lines.push(`> 生成时间: ${new Date(data.timestamp).toLocaleString()}`);
    lines.push(`> 报告类型: ${this.getTypeLabel(data.type)}`);
    lines.push('');

    if (data.manifest) {
      lines.push(...this.generateManifestSection(data.manifest));
    }

    if (data.scanResult) {
      lines.push(...this.generateScanResultSection(data.scanResult));
    }

    if (data.executionResult) {
      lines.push(...this.generateExecutionResultSection(data.executionResult));
    }

    if (data.undoResult) {
      lines.push(...this.generateUndoResultSection(data.undoResult));
    }

    return lines.join('\n');
  }

  private generateHTML(data: ReportData): string {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文件归档报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; margin-bottom: 20px; }
    h2 { color: #202124; margin: 25px 0 15px; padding-left: 10px; border-left: 4px solid #1a73e8; }
    .meta-info { background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; }
    .meta-info p { margin: 5px 0; color: #5f6368; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
    .stat-card.success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .stat-card.warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .stat-card.danger { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
    .stat-card .label { font-size: 14px; opacity: 0.9; margin-bottom: 5px; }
    .stat-card .value { font-size: 32px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    table th, table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e0e0e0; }
    table th { background: #f5f5f5; font-weight: 600; color: #333; }
    table tr:hover { background: #fafafa; }
    .code-block { background: #282c34; color: #abb2bf; padding: 15px; border-radius: 6px; overflow-x: auto; font-family: 'Fira Code', monospace; font-size: 13px; }
    .success { color: #11998e; }
    .warning { color: #f5a623; }
    .error { color: #eb3349; }
    .section { margin: 30px 0; }
    ul { margin: 10px 0; padding-left: 25px; }
    li { margin: 5px 0; }
  </style>
</head>
<body>
  <h1>📁 文件归档报告</h1>
  
  <div class="meta-info">
    <p><strong>生成时间:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
    <p><strong>报告类型:</strong> ${this.getTypeLabel(data.type)}</p>
    ${data.manifest ? `<p><strong>Manifest ID:</strong> ${data.manifest.id}</p>` : ''}
  </div>

  ${this.generateHTMLContent(data)}

</body>
</html>`;

    return html.trim();
  }

  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      scan: '扫描预演',
      execution: '执行结果',
      undo: '撤销结果'
    };
    return labels[type] || type;
  }

  private generateManifestSection(manifest: Manifest): string[] {
    const lines: string[] = [];

    lines.push('## Manifest 信息');
    lines.push('');
    lines.push(`- **ID:** ${manifest.id}`);
    lines.push(`- **时间:** ${manifest.timestamp}`);
    lines.push(`- **源目录:** ${manifest.sourceDirectory}`);
    lines.push(`- **操作类型:** ${manifest.operationType === 'move' ? '移动' : '复制'}`);
    lines.push(`- **总文件数:** ${manifest.totalFiles}`);
    lines.push('');

    return lines;
  }

  private generateScanResultSection(scanResult: ScanResult): string[] {
    const lines: string[] = [];

    lines.push('## 扫描结果');
    lines.push('');
    lines.push(`- **总文件数:** ${scanResult.totalFiles}`);
    lines.push(`- **已匹配:** ${scanResult.matchedFiles.length}`);
    lines.push(`- **无匹配:** ${scanResult.unmatchedFiles.length}`);
    lines.push(`- **潜在重复:** ${scanResult.duplicateFiles.length} 组`);
    lines.push(`- **潜在冲突:** ${scanResult.potentialConflicts.length}`);
    lines.push('');

    if (scanResult.matchedFiles.length > 0) {
      lines.push('### 已匹配文件');
      lines.push('');
      lines.push('| 文件名 | 规则 | 目标路径 |');
      lines.push('|--------|------|----------|');
      
      for (const file of scanResult.matchedFiles.slice(0, 50)) {
        lines.push(`| ${file.name} | ${file.ruleName} | ${file.destinationPath} |`);
      }
      
      if (scanResult.matchedFiles.length > 50) {
        lines.push(`| ... 还有 ${scanResult.matchedFiles.length - 50} 个文件 | | |`);
      }
      lines.push('');
    }

    if (scanResult.unmatchedFiles.length > 0) {
      lines.push('### 无匹配规则的文件');
      lines.push('');
      lines.push('| 文件名 | 大小 | 修改时间 |');
      lines.push('|--------|------|----------|');
      
      for (const file of scanResult.unmatchedFiles.slice(0, 50)) {
        lines.push(`| ${file.name} | ${this.formatSize(file.size)} | ${file.modifiedAt.toLocaleString()} |`);
      }
      
      if (scanResult.unmatchedFiles.length > 50) {
        lines.push(`| ... 还有 ${scanResult.unmatchedFiles.length - 50} 个文件 | | |`);
      }
      lines.push('');
    }

    if (scanResult.duplicateFiles.length > 0) {
      lines.push('### 潜在重复文件');
      lines.push('');
      
      for (const group of scanResult.duplicateFiles) {
        lines.push(`#### 分组 (哈希: ${group.hash.substring(0, 20)}...)`);
        lines.push('');
        for (const file of group.files) {
          lines.push(`- \`${file}\``);
        }
        lines.push('');
      }
    }

    return lines;
  }

  private generateExecutionResultSection(result: ExecutionResult): string[] {
    const lines: string[] = [];

    lines.push('## 执行结果');
    lines.push('');
    lines.push(`- **成功:** ${result.successfulOperations}`);
    lines.push(`- **失败:** ${result.failedOperations}`);
    lines.push(`- **跳过:** ${result.skippedOperations}`);
    lines.push('');

    if (result.errors.length > 0) {
      lines.push('### 错误详情');
      lines.push('');
      for (const error of result.errors) {
        lines.push(`- \`${error}\``);
      }
      lines.push('');
    }

    if (result.manifest) {
      lines.push('### 操作记录');
      lines.push('');
      lines.push('| 状态 | 原路径 | 新路径 | 规则 |');
      lines.push('|------|--------|--------|------|');
      
      for (const entry of result.manifest.entries.slice(0, 50)) {
        const statusEmoji = entry.status === 'success' ? '✅' : 
                          entry.status === 'skipped' ? '⏭️' : '❌';
        lines.push(`| ${statusEmoji} | \`${entry.originalPath}\` | \`${entry.newPath}\` | ${entry.ruleName} |`);
      }
      
      if (result.manifest.entries.length > 50) {
        lines.push(`| ... 还有 ${result.manifest.entries.length - 50} 条记录 | | | |`);
      }
      lines.push('');
    }

    return lines;
  }

  private generateUndoResultSection(result: UndoResult): string[] {
    const lines: string[] = [];

    lines.push('## 撤销结果');
    lines.push('');
    lines.push(`- **Manifest ID:** ${result.manifestId}`);
    lines.push(`- **总记录数:** ${result.totalEntries}`);
    lines.push(`- **成功恢复:** ${result.successfulRestores}`);
    lines.push(`- **失败:** ${result.failedRestores}`);
    lines.push(`- **跳过:** ${result.skippedRestores}`);
    lines.push('');

    if (result.restoredFiles.length > 0) {
      lines.push('### 已恢复文件');
      lines.push('');
      lines.push('| 原路径 | 当前路径 |');
      lines.push('|--------|----------|');
      
      for (const file of result.restoredFiles.slice(0, 50)) {
        lines.push(`| \`${file.original}\` | \`${file.current}\` |`);
      }
      
      if (result.restoredFiles.length > 50) {
        lines.push(`| ... 还有 ${result.restoredFiles.length - 50} 个文件 | |`);
      }
      lines.push('');
    }

    if (result.errors.length > 0) {
      lines.push('### 错误详情');
      lines.push('');
      for (const error of result.errors) {
        lines.push(`- \`${error}\``);
      }
      lines.push('');
    }

    return lines;
  }

  private generateHTMLContent(data: ReportData): string {
    const parts: string[] = [];

    let stats: { label: string; value: number; class: string }[] = [];

    if (data.scanResult) {
      stats = [
        { label: '总文件数', value: data.scanResult.totalFiles, class: '' },
        { label: '已匹配', value: data.scanResult.matchedFiles.length, class: 'success' },
        { label: '无匹配', value: data.scanResult.unmatchedFiles.length, class: 'warning' },
        { label: '重复文件', value: data.scanResult.duplicateFiles.length, class: 'warning' }
      ];
    }

    if (data.executionResult) {
      stats = [
        { label: '成功', value: data.executionResult.successfulOperations, class: 'success' },
        { label: '失败', value: data.executionResult.failedOperations, class: 'danger' },
        { label: '跳过', value: data.executionResult.skippedOperations, class: 'warning' }
      ];
    }

    if (data.undoResult) {
      stats = [
        { label: '总记录', value: data.undoResult.totalEntries, class: '' },
        { label: '成功恢复', value: data.undoResult.successfulRestores, class: 'success' },
        { label: '失败', value: data.undoResult.failedRestores, class: 'danger' },
        { label: '跳过', value: data.undoResult.skippedRestores, class: 'warning' }
      ];
    }

    if (stats.length > 0) {
      parts.push('<div class="stats">');
      for (const stat of stats) {
        parts.push(`
          <div class="stat-card${stat.class ? ' ' + stat.class : ''}">
            <div class="label">${stat.label}</div>
            <div class="value">${stat.value}</div>
          </div>
        `);
      }
      parts.push('</div>');
    }

    if (data.scanResult && data.scanResult.matchedFiles.length > 0) {
      parts.push('<div class="section">');
      parts.push('<h2>📋 已匹配文件</h2>');
      parts.push('<table>');
      parts.push('<thead><tr><th>文件名</th><th>规则</th><th>目标路径</th></tr></thead>');
      parts.push('<tbody>');
      
      for (const file of data.scanResult.matchedFiles.slice(0, 20)) {
        parts.push(`<tr><td>${file.name}</td><td><code>${file.ruleName}</code></td><td><code>${file.destinationPath}</code></td></tr>`);
      }
      
      if (data.scanResult.matchedFiles.length > 20) {
        parts.push(`<tr><td colspan="3">... 还有 ${data.scanResult.matchedFiles.length - 20} 个文件</td></tr>`);
      }
      
      parts.push('</tbody></table>');
      parts.push('</div>');
    }

    if (data.scanResult && data.scanResult.unmatchedFiles.length > 0) {
      parts.push('<div class="section">');
      parts.push('<h2>⚠️ 无匹配规则的文件</h2>');
      parts.push('<table>');
      parts.push('<thead><tr><th>文件名</th><th>大小</th><th>修改时间</th></tr></thead>');
      parts.push('<tbody>');
      
      for (const file of data.scanResult.unmatchedFiles.slice(0, 20)) {
        parts.push(`<tr><td>${file.name}</td><td>${this.formatSize(file.size)}</td><td>${file.modifiedAt.toLocaleString()}</td></tr>`);
      }
      
      if (data.scanResult.unmatchedFiles.length > 20) {
        parts.push(`<tr><td colspan="3">... 还有 ${data.scanResult.unmatchedFiles.length - 20} 个文件</td></tr>`);
      }
      
      parts.push('</tbody></table>');
      parts.push('</div>');
    }

    if (data.executionResult && data.executionResult.errors.length > 0) {
      parts.push('<div class="section">');
      parts.push('<h2>❌ 错误信息</h2>');
      parts.push('<ul>');
      for (const error of data.executionResult.errors) {
        parts.push(`<li class="error">${error}</li>`);
      }
      parts.push('</ul>');
      parts.push('</div>');
    }

    if (data.undoResult && data.undoResult.restoredFiles.length > 0) {
      parts.push('<div class="section">');
      parts.push('<h2>✅ 已恢复文件</h2>');
      parts.push('<table>');
      parts.push('<thead><tr><th>原路径</th><th>当前路径</th></tr></thead>');
      parts.push('<tbody>');
      
      for (const file of data.undoResult.restoredFiles.slice(0, 20)) {
        parts.push(`<tr><td><code>${file.original}</code></td><td><code>${file.current}</code></td></tr>`);
      }
      
      if (data.undoResult.restoredFiles.length > 20) {
        parts.push(`<tr><td colspan="2">... 还有 ${data.undoResult.restoredFiles.length - 20} 个文件</td></tr>`);
      }
      
      parts.push('</tbody></table>');
      parts.push('</div>');
    }

    return parts.join('\n');
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
