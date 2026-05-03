import * as fs from 'fs-extra';
import * as path from 'path';
import {
  ReportData,
  ValidationIssue,
  ValidationResult,
  InspectionResult,
  FileInspection,
} from '../types';
import { formatTime } from '../utils/time';

export type ReportFormat = 'json' | 'markdown' | 'html';

export interface ReportOptions {
  format: ReportFormat;
  outputPath: string;
  includeDetails?: boolean;
  includeMachineReadable?: boolean;
}

function getSeverityEmoji(severity: ValidationIssue['severity']): string {
  switch (severity) {
    case 'error': return '❌';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
  }
}

function getSeverityLabel(severity: ValidationIssue['severity']): string {
  switch (severity) {
    case 'error': return '错误';
    case 'warning': return '警告';
    case 'info': return '提示';
  }
}

function getCategoryLabel(category: ValidationIssue['category']): string {
  const labels: Record<ValidationIssue['category'], string> = {
    file: '文件',
    naming: '命名',
    timing: '时间',
    loudness: '响度',
    silence: '静音',
    chapter: '章节',
    format: '格式',
  };
  return labels[category] || category;
}

function getStatusEmoji(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass': return '✅';
    case 'warn': return '⚠️';
    case 'fail': return '❌';
  }
}

function getStatusLabel(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass': return '通过';
    case 'warn': return '有警告';
    case 'fail': return '失败';
  }
}

export function generateReportData(
  inspection: InspectionResult,
  validation: ValidationResult
): ReportData {
  let status: 'pass' | 'warn' | 'fail' = 'pass';
  if (validation.errors > 0) {
    status = 'fail';
  } else if (validation.warnings > 0) {
    status = 'warn';
  }

  const recommendations: string[] = [];

  if (validation.errors > 0) {
    recommendations.push('存在必须修复的错误，请先解决所有错误级别的问题');
  }

  const fileErrors = validation.issues.filter(i => i.category === 'file' && i.severity === 'error');
  if (fileErrors.length > 0) {
    recommendations.push('请确保所有引用的音频文件都存在于正确的位置');
  }

  const loudnessIssues = validation.issues.filter(i => i.category === 'loudness');
  if (loudnessIssues.length > 0) {
    recommendations.push('建议统一各音频段的响度，目标值通常为 -16 LUFS（播客标准）');
  }

  const silenceIssues = validation.issues.filter(i => i.category === 'silence');
  if (silenceIssues.length > 0) {
    recommendations.push('请检查并修剪音频开头和结尾的过长静音');
  }

  const chapterIssues = validation.issues.filter(i => i.category === 'chapter');
  if (chapterIssues.length > 0) {
    recommendations.push('请修正章节时间，确保格式正确且不超出音频长度');
  }

  if (validation.warnings > 0 && validation.errors === 0) {
    recommendations.push('虽然没有错误，但建议处理警告以获得更好的交付质量');
  }

  if (recommendations.length === 0) {
    recommendations.push('所有检查通过，音频文件已准备好交付');
  }

  let conclusion = '';
  switch (status) {
    case 'pass':
      conclusion = '所有检查通过，音频文件符合交付标准。';
      break;
    case 'warn':
      conclusion = `检查完成，发现 ${validation.warnings} 个警告，但没有必须修复的错误。建议处理警告以提升交付质量。`;
      break;
    case 'fail':
      conclusion = `检查失败，发现 ${validation.errors} 个错误。请在交付前修复所有错误。`;
      break;
  }

  return {
    generatedAt: new Date().toISOString(),
    project: {
      name: inspection.manifest.project.name,
      episode: inspection.manifest.project.episode,
    },
    inspection,
    validation,
    summary: {
      status,
      conclusion,
      recommendations,
    },
  };
}

export function generateMarkdownReport(reportData: ReportData): string {
  const { summary, inspection, validation } = reportData;
  const { manifest } = inspection;

  let md = `# 播客交付体检报告

## 项目信息

| 项目 | 值 |
|------|-----|
| 播客名称 | ${manifest.project.name} |
| 节目期数 | ${manifest.project.episode} |
| 生成时间 | ${new Date(reportData.generatedAt).toLocaleString('zh-CN')} |
| 检查结果 | ${getStatusEmoji(summary.status)} ${getStatusLabel(summary.status)} |

## 检查结论

${summary.conclusion}

## 统计概览

| 指标 | 数值 |
|------|------|
| 检查文件数 | ${inspection.summary.totalFiles} |
| 存在文件数 | ${inspection.summary.existingFiles} |
| 问题总数 | ${validation.totalIssues} |
| 错误数 | ${validation.errors} |
| 警告数 | ${validation.warnings} |
| 提示数 | ${validation.infos} |

---

## 建议

`;

  summary.recommendations.forEach((rec, index) => {
    md += `${index + 1}. ${rec}\n`;
  });

  if (inspection.files.length > 0) {
    md += `

---

## 音频文件详情

### 文件概览

| ID | 角色 | 路径 | 存在 | 时长 | 采样率 | 声道 |
|----|------|------|------|------|--------|------|
`;

    inspection.files.forEach(file => {
      const exists = file.exists ? '✅' : '❌';
      const duration = file.info?.duration ? formatTime(file.info.duration) : '-';
      const sampleRate = file.info?.sampleRate ? `${file.info.sampleRate} Hz` : '-';
      const channels = file.info?.channels ? `${file.info.channels}ch` : '-';
      
      md += `| ${file.id} | ${file.role} | ${path.basename(file.path)} | ${exists} | ${duration} | ${sampleRate} | ${channels} |\n`;
    });

    md += `

### 响度分析

| ID | 角色 | RMS 响度 | 峰值 |
|----|------|----------|------|
`;

    inspection.files.forEach(file => {
      if (file.loudness) {
        const rms = isFinite(file.loudness.rmsDb) ? `${file.loudness.rmsDb.toFixed(2)} dB` : '-';
        const peak = isFinite(file.loudness.peakDb) ? `${file.loudness.peakDb.toFixed(2)} dB` : '-';
        md += `| ${file.id} | ${file.role} | ${rms} | ${peak} |\n`;
      }
    });

    if (inspection.files.some(f => f.silence)) {
      md += `

### 静音检测

| ID | 角色 | 开头静音 | 结尾静音 |
|----|------|----------|----------|
`;

      inspection.files.forEach(file => {
        if (file.silence) {
          const startSilence = file.silence.hasLongSilenceAtStart 
            ? `⚠️ ${file.silence.startSilenceDuration.toFixed(3)}s` 
            : `${file.silence.startSilenceDuration.toFixed(3)}s`;
          const endSilence = file.silence.hasLongSilenceAtEnd 
            ? `⚠️ ${file.silence.endSilenceDuration.toFixed(3)}s` 
            : `${file.silence.endSilenceDuration.toFixed(3)}s`;
          md += `| ${file.id} | ${file.role} | ${startSilence} | ${endSilence} |\n`;
        }
      });
    }
  }

  if (validation.issues.length > 0) {
    md += `

---

## 问题详情

`;

    const issuesBySeverity = {
      error: validation.issues.filter(i => i.severity === 'error'),
      warning: validation.issues.filter(i => i.severity === 'warning'),
      info: validation.issues.filter(i => i.severity === 'info'),
    };

    (['error', 'warning', 'info'] as const).forEach(severity => {
      const issues = issuesBySeverity[severity];
      if (issues.length === 0) return;

      md += `### ${getSeverityEmoji(severity)} ${getSeverityLabel(severity)} (${issues.length})

`;

      issues.forEach(issue => {
        md += `#### ${issue.id}

- **类别**: ${getCategoryLabel(issue.category)}
- **问题**: ${issue.message}

`;

        if (issue.detail) {
          md += `**详情**:
\`\`\`
${issue.detail}
\`\`\`

`;
        }

        if (issue.suggestion) {
          md += `**建议**: ${issue.suggestion}

`;
        }

        md += '\n';
      });
    });
  }

  if (manifest.chapters && manifest.chapters.length > 0) {
    md += `

---

## 章节信息

| ID | 标题 | 开始时间 |
|----|------|----------|
`;

    manifest.chapters.forEach(chapter => {
      md += `| ${chapter.id} | ${chapter.title} | ${chapter.startTime} |\n`;
    });
  }

  md += `

---

## 设置信息

| 设置项 | 值 |
|--------|-----|
| 目标响度 | ${manifest.settings.targetLoudness} dB |
| 响度容差 | ±${manifest.settings.loudnessTolerance} dB |
| 最大开头静音 | ${manifest.settings.maxSilenceAtStart} 秒 |
| 最大结尾静音 | ${manifest.settings.maxSilenceAtEnd} 秒 |
`;

  if (manifest.settings.sampleRate) {
    md += `| 期望采样率 | ${manifest.settings.sampleRate} Hz |\n`;
  }

  if (manifest.settings.channels) {
    md += `| 期望声道数 | ${manifest.settings.channels} ch |\n`;
  }

  return md;
}

export function generateHtmlReport(reportData: ReportData): string {
  const { summary, inspection, validation } = reportData;
  const { manifest } = inspection;

  const statusColor = {
    pass: '#10b981',
    warn: '#f59e0b',
    fail: '#ef4444',
  };

  const severityBgColor = {
    error: '#fef2f2',
    warning: '#fffbeb',
    info: '#eff6ff',
  };

  const severityBorderColor = {
    error: '#fca5a5',
    warning: '#fcd34d',
    info: '#93c5fd',
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>播客交付体检报告</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
      background: #f9fafb;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 { 
      color: #111827; 
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 16px;
      margin-top: 0;
    }
    h2 { 
      color: #374151; 
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
      margin-top: 32px;
    }
    h3 { color: #4b5563; margin-top: 24px; }
    h4 { color: #6b7280; margin-top: 16px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    tr:hover { background: #f9fafb; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      color: white;
    }
    .issue {
      margin: 12px 0;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid;
    }
    .issue-id {
      font-family: monospace;
      font-weight: 600;
      margin-right: 8px;
    }
    .issue-category {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      background: #e5e7eb;
      color: #4b5563;
    }
    .issue-detail {
      margin-top: 8px;
      padding: 12px;
      background: #f3f4f6;
      border-radius: 6px;
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
    }
    .issue-suggestion {
      margin-top: 8px;
      padding: 8px 12px;
      background: #ecfdf5;
      border-radius: 6px;
      color: #065f46;
    }
    .summary-box {
      padding: 20px;
      border-radius: 8px;
      margin: 16px 0;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin: 24px 0;
    }
    .stat-card {
      text-align: center;
      padding: 20px;
      border-radius: 8px;
      background: #f9fafb;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #111827;
    }
    .stat-label {
      font-size: 14px;
      color: #6b7280;
      margin-top: 4px;
    }
    .recommendations {
      background: #fefce8;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 16px 0;
    }
    .recommendations ol {
      margin: 0;
      padding-left: 20px;
    }
    .recommendations li {
      padding: 4px 0;
    }
    .emoji { font-size: 1.2em; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎙️ 播客交付体检报告</h1>
    
    <h2>📋 项目信息</h2>
    <table>
      <tr><th>项目</th><th>值</th></tr>
      <tr><td>播客名称</td><td>${manifest.project.name}</td></tr>
      <tr><td>节目期数</td><td>${manifest.project.episode}</td></tr>
      <tr><td>生成时间</td><td>${new Date(reportData.generatedAt).toLocaleString('zh-CN')}</td></tr>
      <tr><td>检查结果</td><td><span class="status-badge" style="background: ${statusColor[summary.status]}">${getStatusEmoji(summary.status)} ${getStatusLabel(summary.status)}</span></td></tr>
    </table>
    
    <h2>📝 检查结论</h2>
    <div class="summary-box" style="background: ${summary.status === 'fail' ? '#fef2f2' : summary.status === 'warn' ? '#fffbeb' : '#f0fdf4'}">
      ${summary.conclusion}
    </div>
    
    <h2>📊 统计概览</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${inspection.summary.totalFiles}</div>
        <div class="stat-label">检查文件数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${inspection.summary.existingFiles}</div>
        <div class="stat-label">存在文件数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #ef4444">${validation.errors}</div>
        <div class="stat-label">错误</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #f59e0b">${validation.warnings}</div>
        <div class="stat-label">警告</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #3b82f6">${validation.infos}</div>
        <div class="stat-label">提示</div>
      </div>
    </div>
    
    <h2>💡 建议</h2>
    <div class="recommendations">
      <ol>
        ${summary.recommendations.map(r => `<li>${r}</li>`).join('')}
      </ol>
    </div>
    
    ${inspection.files.length > 0 ? `
    <h2>🎵 音频文件详情</h2>
    
    <h3>文件概览</h3>
    <table>
      <tr><th>ID</th><th>角色</th><th>文件</th><th>存在</th><th>时长</th><th>采样率</th><th>声道</th></tr>
      ${inspection.files.map(file => {
        const exists = file.exists ? '✅' : '❌';
        const duration = file.info?.duration ? formatTime(file.info.duration) : '-';
        const sampleRate = file.info?.sampleRate ? `${file.info.sampleRate} Hz` : '-';
        const channels = file.info?.channels ? `${file.info.channels}ch` : '-';
        return `<tr><td><code>${file.id}</code></td><td>${file.role}</td><td>${path.basename(file.path)}</td><td>${exists}</td><td>${duration}</td><td>${sampleRate}</td><td>${channels}</td></tr>`;
      }).join('')}
    </table>
    
    ${inspection.files.some(f => f.loudness) ? `
    <h3>响度分析</h3>
    <table>
      <tr><th>ID</th><th>角色</th><th>RMS 响度</th><th>峰值</th></tr>
      ${inspection.files.filter(f => f.loudness).map(file => {
        const rms = isFinite(file.loudness!.rmsDb) ? `${file.loudness!.rmsDb.toFixed(2)} dB` : '-';
        const peak = isFinite(file.loudness!.peakDb) ? `${file.loudness!.peakDb.toFixed(2)} dB` : '-';
        return `<tr><td><code>${file.id}</code></td><td>${file.role}</td><td>${rms}</td><td>${peak}</td></tr>`;
      }).join('')}
    </table>
    ` : ''}
    ` : ''}
    
    ${validation.issues.length > 0 ? `
    <h2>⚠️ 问题详情</h2>
    
    ${(['error', 'warning', 'info'] as const).map(severity => {
      const issues = validation.issues.filter(i => i.severity === severity);
      if (issues.length === 0) return '';
      
      return `
      <h3>${getSeverityEmoji(severity)} ${getSeverityLabel(severity)} (${issues.length})</h3>
      ${issues.map(issue => `
      <div class="issue" style="background: ${severityBgColor[severity]}; border-color: ${severityBorderColor[severity]}">
        <div>
          <span class="issue-id">${issue.id}</span>
          <span class="issue-category">${getCategoryLabel(issue.category)}</span>
        </div>
        <div style="margin-top: 8px; font-weight: 500">${issue.message}</div>
        ${issue.detail ? `<div class="issue-detail">${issue.detail}</div>` : ''}
        ${issue.suggestion ? `<div class="issue-suggestion">💡 ${issue.suggestion}</div>` : ''}
      </div>
      `).join('')}
      `;
    }).join('')}
    ` : ''}
    
    <h2>⚙️ 设置信息</h2>
    <table>
      <tr><th>设置项</th><th>值</th></tr>
      <tr><td>目标响度</td><td>${manifest.settings.targetLoudness} dB</td></tr>
      <tr><td>响度容差</td><td>±${manifest.settings.loudnessTolerance} dB</td></tr>
      <tr><td>最大开头静音</td><td>${manifest.settings.maxSilenceAtStart} 秒</td></tr>
      <tr><td>最大结尾静音</td><td>${manifest.settings.maxSilenceAtEnd} 秒</td></tr>
      ${manifest.settings.sampleRate ? `<tr><td>期望采样率</td><td>${manifest.settings.sampleRate} Hz</td></tr>` : ''}
      ${manifest.settings.channels ? `<tr><td>期望声道数</td><td>${manifest.settings.channels} 声道</td></tr>` : ''}
    </table>
  </div>
</body>
</html>`;
}

export function generateJsonReport(reportData: ReportData): string {
  return JSON.stringify(reportData, null, 2);
}

export async function writeReport(
  reportData: ReportData,
  options: ReportOptions
): Promise<string> {
  const { format, outputPath } = options;
  
  let content: string;
  
  switch (format) {
    case 'json':
      content = generateJsonReport(reportData);
      break;
    case 'html':
      content = generateHtmlReport(reportData);
      break;
    case 'markdown':
    default:
      content = generateMarkdownReport(reportData);
      break;
  }

  const outputDir = path.dirname(outputPath);
  await fs.ensureDir(outputDir);
  
  await fs.writeFile(outputPath, content, 'utf-8');
  
  return outputPath;
}

export async function generateAllReports(
  reportData: ReportData,
  outputDir: string,
  baseName: string = 'delivery-check-report'
): Promise<{ json: string; markdown: string; html: string }> {
  await fs.ensureDir(outputDir);

  const jsonPath = path.join(outputDir, `${baseName}.json`);
  const markdownPath = path.join(outputDir, `${baseName}.md`);
  const htmlPath = path.join(outputDir, `${baseName}.html`);

  await Promise.all([
    writeReport(reportData, { format: 'json', outputPath: jsonPath }),
    writeReport(reportData, { format: 'markdown', outputPath: markdownPath }),
    writeReport(reportData, { format: 'html', outputPath: htmlPath }),
  ]);

  return {
    json: jsonPath,
    markdown: markdownPath,
    html: htmlPath,
  };
}
