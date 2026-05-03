import * as fs from 'fs';
import * as path from 'path';
import { ScanResult, ExportOptions, SubtitleFile, ValidationIssue } from './types';
import { SubtitleParser } from './subtitle-parser';

export class Exporter {
  private parser: SubtitleParser;

  constructor() {
    this.parser = new SubtitleParser();
  }

  printTerminalSummary(scanResult: ScanResult): void {
    const { totalFiles, validFiles, invalidFiles, issues, languageCoverage } = scanResult;
    
    console.log('\n' + '='.repeat(60));
    console.log('           字幕交付工具 - 扫描报告摘要');
    console.log('='.repeat(60) + '\n');

    console.log('📊 统计概览');
    console.log('─'.repeat(40));
    console.log(`  总文件数: ${totalFiles}`);
    console.log(`  ✅ 通过校验: ${validFiles}`);
    console.log(`  ❌ 存在错误: ${invalidFiles}`);
    console.log('');

    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    const infos = issues.filter(i => i.severity === 'info');

    console.log('⚠️  问题统计');
    console.log('─'.repeat(40));
    console.log(`  🔴 错误 (Error): ${errors.length}`);
    console.log(`  🟡 警告 (Warning): ${warnings.length}`);
    console.log(`  🔵 提示 (Info): ${infos.length}`);
    console.log('');

    const categories = ['timing', 'text', 'forbidden-word', 'naming', 'language-coverage', 'format'] as const;
    const categoryNames: Record<string, string> = {
      timing: '⏱️  时间轴',
      text: '📝 文本内容',
      'forbidden-word': '🚫 禁用词',
      naming: '📁 文件命名',
      'language-coverage': '🌍 语言覆盖',
      format: '📄 格式解析'
    };

    console.log('📂 问题分类');
    console.log('─'.repeat(40));
    for (const cat of categories) {
      const count = issues.filter(i => i.category === cat).length;
      if (count > 0) {
        console.log(`  ${categoryNames[cat]}: ${count}`);
      }
    }
    console.log('');

    console.log('🌍 语言覆盖检查');
    console.log('─'.repeat(40));
    const completeCoverage = languageCoverage.filter(l => l.complete).length;
    const incompleteCoverage = languageCoverage.filter(l => !l.complete).length;
    
    console.log(`  ✅ 覆盖完整: ${completeCoverage}`);
    console.log(`  ❌ 缺少语言: ${incompleteCoverage}`);
    
    for (const cov of languageCoverage) {
      if (!cov.complete) {
        console.log(`     - [${cov.platform}] 第${cov.episode}集: 缺少 ${cov.missing.join(', ')}`);
      }
    }
    console.log('');

    if (errors.length > 0) {
      console.log('🔴 关键错误列表 (前10项)');
      console.log('─'.repeat(60));
      for (const issue of errors.slice(0, 10)) {
        const timeStr = issue.startTime !== undefined 
          ? ` [${this.parser.msToTime(issue.startTime)}]` 
          : '';
        console.log(`\n  📄 ${issue.file}${timeStr}`);
        console.log(`     └─ ${issue.message}`);
        if (issue.suggestion) {
          console.log(`     💡 建议: ${issue.suggestion}`);
        }
      }
      if (errors.length > 10) {
        console.log(`\n     ... 还有 ${errors.length - 10} 个错误，请查看详细报告`);
      }
      console.log('');
    }

    console.log('='.repeat(60));
    const status = errors.length === 0 ? '✅ 扫描完成，无错误！' : '⚠️  扫描完成，请修复错误后重试';
    console.log(`           ${status}`);
    console.log('='.repeat(60) + '\n');
  }

  generateMarkdownReport(scanResult: ScanResult, outputPath: string): void {
    const { totalFiles, validFiles, invalidFiles, issues, languageCoverage, filesByPlatform } = scanResult;
    const timestamp = new Date().toLocaleString('zh-CN');

    let md = `# 字幕交付工具 - 校验报告

> 生成时间: ${timestamp}

---

## 📊 统计概览

| 指标 | 数量 |
|------|------|
| 总文件数 | ${totalFiles} |
| ✅ 通过校验 | ${validFiles} |
| ❌ 存在错误 | ${invalidFiles} |

---

## ⚠️ 问题统计

| 级别 | 数量 |
|------|------|
| 🔴 错误 (Error) | ${issues.filter(i => i.severity === 'error').length} |
| 🟡 警告 (Warning) | ${issues.filter(i => i.severity === 'warning').length} |
| 🔵 提示 (Info) | ${issues.filter(i => i.severity === 'info').length} |

---

## 📂 平台文件分布

`;

    for (const [platform, files] of Object.entries(filesByPlatform)) {
      md += `### ${platform} (${files.length} 个文件)\n\n`;
      md += '| 文件名 | 语言 | 格式 |\n';
      md += '|--------|------|------|\n';
      for (const file of files) {
        md += `| ${file.fileName} | ${file.language} | ${file.format.toUpperCase()} |\n`;
      }
      md += '\n';
    }

    md += `---

## 🌍 语言覆盖检查

`;

    const completeCount = languageCoverage.filter(l => l.complete).length;
    const incompleteCount = languageCoverage.filter(l => !l.complete).length;

    md += `### 覆盖统计
- ✅ 覆盖完整: ${completeCount}
- ❌ 缺少语言: ${incompleteCount}

### 详细列表

| 平台 | 集数 | 状态 | 已覆盖 | 缺失 |
|------|------|------|--------|------|
`;

    for (const cov of languageCoverage) {
      const status = cov.complete ? '✅ 完整' : '❌ 缺失';
      md += `| ${cov.platform} | 第${cov.episode}集 | ${status} | ${cov.present.join(', ')} | ${cov.missing.length > 0 ? cov.missing.join(', ') : '-'} |\n`;
    }

    md += `
---

## 🔴 错误详情

`;

    const errors = issues.filter(i => i.severity === 'error');
    if (errors.length === 0) {
      md += '无错误，所有文件通过校验！\n\n';
    } else {
      md += `共 ${errors.length} 个错误\n\n`;
      
      const grouped = this.groupIssuesByFile(errors);
      for (const [file, fileIssues] of Object.entries(grouped)) {
        md += `### ${file}\n\n`;
        for (const issue of fileIssues) {
          const timeStr = issue.startTime !== undefined 
            ? `**时间**: ${this.parser.msToTime(issue.startTime)}` 
            : '';
          const cueStr = issue.cueId ? `**字幕序号**: #${issue.cueId}` : '';
          
          md += `- **问题**: ${issue.message}\n`;
          if (cueStr) md += `  ${cueStr}\n`;
          if (timeStr) md += `  ${timeStr}\n`;
          if (issue.suggestion) md += `  **建议**: ${issue.suggestion}\n`;
          md += '\n';
        }
      }
    }

    md += `---

## 🟡 警告详情

`;

    const warnings = issues.filter(i => i.severity === 'warning');
    if (warnings.length === 0) {
      md += '无警告\n\n';
    } else {
      md += `共 ${warnings.length} 个警告\n\n`;
      
      const grouped = this.groupIssuesByFile(warnings);
      for (const [file, fileIssues] of Object.entries(grouped)) {
        md += `### ${file}\n\n`;
        for (const issue of fileIssues) {
          const timeStr = issue.startTime !== undefined 
            ? `**时间**: ${this.parser.msToTime(issue.startTime)}` 
            : '';
          const cueStr = issue.cueId ? `**字幕序号**: #${issue.cueId}` : '';
          
          md += `- **问题**: ${issue.message}\n`;
          if (cueStr) md += `  ${cueStr}\n`;
          if (timeStr) md += `  ${timeStr}\n`;
          if (issue.suggestion) md += `  **建议**: ${issue.suggestion}\n`;
          md += '\n';
        }
      }
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, md, 'utf-8');
    console.log(`✅ Markdown报告已生成: ${outputPath}`);
  }

  generateCsvReport(scanResult: ScanResult, outputPath: string): void {
    const { issues } = scanResult;

    const headers = ['文件名', '严重级别', '分类', '字幕序号', '开始时间', '结束时间', '问题描述', '建议'];
    let csv = headers.join(',') + '\n';

    const escapeCsv = (value: string | undefined): string => {
      if (value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    for (const issue of issues) {
      const row = [
        escapeCsv(issue.file),
        escapeCsv(issue.severity),
        escapeCsv(issue.category),
        escapeCsv(issue.cueId),
        issue.startTime !== undefined ? escapeCsv(this.parser.msToTime(issue.startTime)) : '',
        issue.endTime !== undefined ? escapeCsv(this.parser.msToTime(issue.endTime)) : '',
        escapeCsv(issue.message),
        escapeCsv(issue.suggestion)
      ];
      csv += row.join(',') + '\n';
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, csv, 'utf-8');
    console.log(`✅ CSV报告已生成: ${outputPath}`);
  }

  packageValidFiles(scanResult: ScanResult, outputDir: string): void {
    const { issues, filesByPlatform } = scanResult;
    
    const errorFiles = new Set(
      issues.filter(i => i.severity === 'error').map(i => i.file)
    );

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('\n📦 打包通过校验的文件...');

    for (const [platform, files] of Object.entries(filesByPlatform)) {
      const validFiles = files.filter(f => !errorFiles.has(f.fileName));
      
      if (validFiles.length === 0) {
        console.log(`  ⏭️  [${platform}] 无可打包的文件（全部存在错误）`);
        continue;
      }

      const platformDir = path.join(outputDir, platform);
      if (!fs.existsSync(platformDir)) {
        fs.mkdirSync(platformDir, { recursive: true });
      }

      for (const file of validFiles) {
        const destPath = path.join(platformDir, file.fileName);
        fs.copyFileSync(file.path, destPath);
      }

      console.log(`  ✅ [${platform}] 已打包 ${validFiles.length} 个文件 -> ${platformDir}`);
    }

    console.log('');
  }

  exportAll(scanResult: ScanResult, options: ExportOptions): void {
    const { outputDir, generateMarkdown, generateCsv, packageByPlatform } = options;
    const timestamp = new Date().toISOString().slice(0, 10);

    if (generateMarkdown) {
      const mdPath = path.join(outputDir, `report_${timestamp}.md`);
      this.generateMarkdownReport(scanResult, mdPath);
    }

    if (generateCsv) {
      const csvPath = path.join(outputDir, `issues_${timestamp}.csv`);
      this.generateCsvReport(scanResult, csvPath);
    }

    if (packageByPlatform) {
      const packagesDir = path.join(outputDir, 'packages');
      this.packageValidFiles(scanResult, packagesDir);
    }
  }

  private groupIssuesByFile(issues: ValidationIssue[]): Record<string, ValidationIssue[]> {
    const grouped: Record<string, ValidationIssue[]> = {};
    
    for (const issue of issues) {
      if (!grouped[issue.file]) {
        grouped[issue.file] = [];
      }
      grouped[issue.file].push(issue);
    }
    
    return grouped;
  }
}
