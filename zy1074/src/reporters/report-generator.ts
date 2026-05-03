import { 
  ProjectValidationResult, 
  ValidationError,
  ValidationResult,
  Report,
  FixSuggestion
} from '../types';
import { generateFixSuggestions } from '../suggestions/fix-suggestions';

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'passed': return '✅';
    case 'warning': return '⚠️';
    case 'failed': return '❌';
    default: return '❓';
  }
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'error': return '🔴';
    case 'warning': return '🟡';
    case 'info': return '🔵';
    default: return '⚪';
  }
}

function getSeverityText(severity: string): string {
  switch (severity) {
    case 'error': return '错误';
    case 'warning': return '警告';
    case 'info': return '信息';
    default: return '未知';
  }
}

function formatValidationResult(result: ValidationResult | null, indent: string = ''): string {
  if (!result) {
    return `${indent}📁 无数据\n`;
  }

  let output = '';
  const status = result.passed ? (result.warningCount > 0 ? 'warning' : 'passed') : 'failed';
  
  output += `${indent}📄 ${result.fileName}\n`;
  output += `${indent}   状态: ${getStatusEmoji(status)} ${status === 'passed' ? '通过' : status === 'warning' ? '警告' : '失败'}\n`;
  output += `${indent}   统计: 🔴 错误 ${result.errorCount} 项 | 🟡 警告 ${result.warningCount} 项\n`;

  if (result.errors.length > 0) {
    output += `${indent}   问题列表:\n`;
    for (const error of result.errors) {
      output += `${indent}      ${getSeverityEmoji(error.severity)} [${getSeverityText(error.severity)}] `;
      if (error.startTimeStr) {
        output += `[${error.startTimeStr} - ${error.endTimeStr || ''}] `;
      }
      output += `${error.message}\n`;
    }
  }

  return output;
}

export function generateMarkdownReport(
  validationResult: ProjectValidationResult,
  suggestions?: FixSuggestion[]
): string {
  const fixSuggestions = suggestions || generateFixSuggestions(validationResult);
  
  let md = '# 字幕交付体检报告\n\n';
  
  md += '## 📋 基本信息\n\n';
  md += `- **项目路径**: \`${validationResult.projectPath}\`\n`;
  md += `- **检查时间**: ${validationResult.timestamp}\n`;
  md += `- **整体状态**: ${getStatusEmoji(validationResult.overallStatus)} ${
    validationResult.overallStatus === 'passed' ? '✅ 通过' :
    validationResult.overallStatus === 'warning' ? '⚠️ 存在警告' : '❌ 存在错误'
  }\n\n`;

  md += '## 📊 检查统计\n\n';
  md += `| 类型 | 数量 |\n`;
  md += `|------|------|\n`;
  md += `| 🔴 错误 | ${validationResult.summary.totalErrors} |\n`;
  md += `| 🟡 警告 | ${validationResult.summary.totalWarnings} |\n`;
  md += `| 🔵 信息 | ${validationResult.summary.totalInfos} |\n\n`;

  md += '## 📝 详细检查结果\n\n';

  md += '### 🎬 字幕文件检查\n\n';
  if (validationResult.results.subtitles.length > 0) {
    for (const result of validationResult.results.subtitles) {
      md += `#### ${result.fileName}\n\n`;
      md += `- 状态: ${getStatusEmoji(result.passed ? (result.warningCount > 0 ? 'warning' : 'passed') : 'failed')} `;
      md += `${result.passed ? (result.warningCount > 0 ? '存在警告' : '通过') : '存在错误'}\n`;
      md += `- 错误: ${result.errorCount} 项 | 警告: ${result.warningCount} 项\n\n`;

      if (result.errors.length > 0) {
        md += '**问题列表:**\n\n';
        for (const error of result.errors) {
          md += `${getSeverityEmoji(error.severity)} **[${getSeverityText(error.severity)}]** `;
          if (error.startTimeStr) {
            md += `\`${error.startTimeStr} - ${error.endTimeStr || ''}\` `;
          }
          md += `\n`;
          md += `> ${error.message}\n\n`;
        }
      }
    }
  } else {
    md += '> 未检测到字幕文件\n\n';
  }

  md += '### 📑 章节文件检查\n\n';
  if (validationResult.results.chapters) {
    const result = validationResult.results.chapters;
    md += `#### ${result.fileName}\n\n`;
    md += `- 状态: ${getStatusEmoji(result.passed ? (result.warningCount > 0 ? 'warning' : 'passed') : 'failed')} `;
    md += `${result.passed ? (result.warningCount > 0 ? '存在警告' : '通过') : '存在错误'}\n`;
    md += `- 错误: ${result.errorCount} 项 | 警告: ${result.warningCount} 项\n\n`;

    if (result.errors.length > 0) {
      md += '**问题列表:**\n\n';
      for (const error of result.errors) {
        md += `${getSeverityEmoji(error.severity)} **[${getSeverityText(error.severity)}]** `;
        if (error.startTimeStr) {
          md += `\`${error.startTimeStr} - ${error.endTimeStr || ''}\` `;
        }
        md += `\n`;
        md += `> ${error.message}\n\n`;
      }
    }
  } else {
    md += '> 未检测到章节文件\n\n';
  }

  md += '### 📢 广告点位检查\n\n';
  if (validationResult.results.adPoints) {
    const result = validationResult.results.adPoints;
    md += `#### ${result.fileName}\n\n`;
    md += `- 状态: ${getStatusEmoji(result.passed ? (result.warningCount > 0 ? 'warning' : 'passed') : 'failed')} `;
    md += `${result.passed ? (result.warningCount > 0 ? '存在警告' : '通过') : '存在错误'}\n`;
    md += `- 错误: ${result.errorCount} 项 | 警告: ${result.warningCount} 项\n\n`;

    if (result.errors.length > 0) {
      md += '**问题列表:**\n\n';
      for (const error of result.errors) {
        md += `${getSeverityEmoji(error.severity)} **[${getSeverityText(error.severity)}]** `;
        if (error.startTimeStr) {
          md += `\`${error.startTimeStr} - ${error.endTimeStr || ''}\` `;
        }
        md += `\n`;
        md += `> ${error.message}\n\n`;
      }
    }
  } else {
    md += '> 未检测到广告点位文件\n\n';
  }

  if (fixSuggestions.length > 0) {
    md += '## 💡 修复建议\n\n';
    
    let highCount = fixSuggestions.filter(s => s.priority === 'high').length;
    let mediumCount = fixSuggestions.filter(s => s.priority === 'medium').length;
    let lowCount = fixSuggestions.filter(s => s.priority === 'low').length;
    
    md += `### 📈 优先级统计\n\n`;
    md += `- 🔴 高优先级: ${highCount} 项\n`;
    md += `- 🟡 中优先级: ${mediumCount} 项\n`;
    md += `- 🟢 低优先级: ${lowCount} 项\n\n`;

    for (let i = 0; i < fixSuggestions.length; i++) {
      const suggestion = fixSuggestions[i];
      const priorityMarker = suggestion.priority === 'high' ? '🔴' : 
                             suggestion.priority === 'medium' ? '🟡' : '🟢';
      
      md += `### ${priorityMarker} 问题 ${i + 1}/${fixSuggestions.length}\n\n`;
      md += `- **问题类型**: \`${suggestion.error.type}\`\n`;
      md += `- **文件**: \`${suggestion.error.fileName}\`\n`;
      if (suggestion.error.startTimeStr) {
        md += `- **时间**: \`${suggestion.error.startTimeStr} - ${suggestion.error.endTimeStr || ''}\`\n`;
      }
      md += '\n';
      md += `**问题描述**: ${suggestion.error.message}\n\n`;
      md += `**修复建议**:\n\n`;
      
      for (let j = 0; j < suggestion.steps.length; j++) {
        md += `${j + 1}. ${suggestion.steps[j]}\n`;
      }
      
      md += '\n---\n\n';
    }
  }

  md += '---\n\n';
  md += '*报告由「字幕交付体检」工具自动生成*\n';

  return md;
}

export function generateJsonReport(
  validationResult: ProjectValidationResult,
  suggestions?: FixSuggestion[]
): string {
  const fixSuggestions = suggestions || generateFixSuggestions(validationResult);
  
  const report = {
    version: '1.0.0',
    generatedAt: validationResult.timestamp,
    projectPath: validationResult.projectPath,
    overallStatus: validationResult.overallStatus,
    summary: validationResult.summary,
    results: {
      subtitles: validationResult.results.subtitles,
      chapters: validationResult.results.chapters,
      adPoints: validationResult.results.adPoints
    },
    fixSuggestions: fixSuggestions.map(s => ({
      priority: s.priority,
      suggestion: s.suggestion,
      steps: s.steps,
      error: {
        type: s.error.type,
        severity: s.error.severity,
        message: s.error.message,
        fileName: s.error.fileName,
        startTimeStr: s.error.startTimeStr,
        endTimeStr: s.error.endTimeStr
      }
    }))
  };

  return JSON.stringify(report, null, 2);
}

export function generateHtmlReport(
  validationResult: ProjectValidationResult,
  suggestions?: FixSuggestion[]
): string {
  const fixSuggestions = suggestions || generateFixSuggestions(validationResult);
  
  const statusColor = validationResult.overallStatus === 'passed' ? '#10b981' :
                       validationResult.overallStatus === 'warning' ? '#f59e0b' : '#ef4444';
  const statusText = validationResult.overallStatus === 'passed' ? '通过' :
                     validationResult.overallStatus === 'warning' ? '存在警告' : '存在错误';

  function getErrorColor(severity: string): string {
    switch (severity) {
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  }

  function formatErrors(errors: ValidationError[]): string {
    if (errors.length === 0) return '<p class="text-green-600">✅ 无问题</p>';
    
    return errors.map(error => `
      <div class="mb-3 p-3 rounded-lg" style="border-left: 4px solid ${getErrorColor(error.severity)}; background-color: #f9fafb;">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-semibold" style="color: ${getErrorColor(error.severity)};">
            [${getSeverityText(error.severity)}]
          </span>
          ${error.startTimeStr ? `<span class="text-gray-500 text-sm">${error.startTimeStr} - ${error.endTimeStr || ''}</span>` : ''}
        </div>
        <p class="text-gray-700">${error.message}</p>
      </div>
    `).join('');
  }

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>字幕交付体检报告</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  </style>
</head>
<body class="bg-gray-100 min-h-screen py-8 px-4">
  <div class="max-w-4xl mx-auto">
    
    <!-- Header -->
    <div class="card p-6 mb-6">
      <h1 class="text-3xl font-bold text-gray-800 mb-4">🎬 字幕交付体检报告</h1>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p class="text-gray-600 text-sm mb-1">项目路径</p>
          <code class="bg-gray-100 px-2 py-1 rounded text-sm">${validationResult.projectPath}</code>
        </div>
        <div>
          <p class="text-gray-600 text-sm mb-1">检查时间</p>
          <p class="font-medium">${validationResult.timestamp}</p>
        </div>
      </div>
      
      <div class="mt-4 p-4 rounded-lg" style="background-color: ${statusColor}20; border: 2px solid ${statusColor};">
        <div class="flex items-center gap-3">
          <span class="text-2xl">${getStatusEmoji(validationResult.overallStatus)}</span>
          <div>
            <p class="font-bold text-lg" style="color: ${statusColor};">整体状态: ${statusText}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary -->
    <div class="card p-6 mb-6">
      <h2 class="text-xl font-bold text-gray-800 mb-4">📊 检查统计</h2>
      <div class="grid grid-cols-3 gap-4">
        <div class="text-center p-4 bg-red-50 rounded-lg">
          <p class="text-3xl font-bold text-red-600">${validationResult.summary.totalErrors}</p>
          <p class="text-gray-600">🔴 错误</p>
        </div>
        <div class="text-center p-4 bg-yellow-50 rounded-lg">
          <p class="text-3xl font-bold text-yellow-600">${validationResult.summary.totalWarnings}</p>
          <p class="text-gray-600">🟡 警告</p>
        </div>
        <div class="text-center p-4 bg-blue-50 rounded-lg">
          <p class="text-3xl font-bold text-blue-600">${validationResult.summary.totalInfos}</p>
          <p class="text-gray-600">🔵 信息</p>
        </div>
      </div>
    </div>

    <!-- Subtitles Check -->
    <div class="card p-6 mb-6">
      <h2 class="text-xl font-bold text-gray-800 mb-4">🎬 字幕文件检查</h2>
      ${validationResult.results.subtitles.length > 0 ? 
        validationResult.results.subtitles.map(result => `
          <div class="mb-4 p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-gray-800">📄 ${result.fileName}</h3>
              <span class="px-3 py-1 rounded-full text-sm font-medium" style="background-color: ${result.passed ? (result.warningCount > 0 ? '#fef3c7' : '#d1fae5') : '#fee2e2'}; color: ${result.passed ? (result.warningCount > 0 ? '#92400e' : '#065f46') : '#991b1b'};">
                ${result.passed ? (result.warningCount > 0 ? '⚠️ 存在警告' : '✅ 通过') : '❌ 存在错误'}
              </span>
            </div>
            <p class="text-sm text-gray-600 mb-3">错误: ${result.errorCount} 项 | 警告: ${result.warningCount} 项</p>
            ${formatErrors(result.errors)}
          </div>
        `).join('') :
        '<p class="text-gray-500 italic">未检测到字幕文件</p>'
      }
    </div>

    <!-- Chapters Check -->
    <div class="card p-6 mb-6">
      <h2 class="text-xl font-bold text-gray-800 mb-4">📑 章节文件检查</h2>
      ${validationResult.results.chapters ? `
        <div class="p-4 bg-gray-50 rounded-lg">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-gray-800">📄 ${validationResult.results.chapters.fileName}</h3>
            <span class="px-3 py-1 rounded-full text-sm font-medium" style="background-color: ${validationResult.results.chapters.passed ? (validationResult.results.chapters.warningCount > 0 ? '#fef3c7' : '#d1fae5') : '#fee2e2'}; color: ${validationResult.results.chapters.passed ? (validationResult.results.chapters.warningCount > 0 ? '#92400e' : '#065f46') : '#991b1b'};">
              ${validationResult.results.chapters.passed ? (validationResult.results.chapters.warningCount > 0 ? '⚠️ 存在警告' : '✅ 通过') : '❌ 存在错误'}
            </span>
          </div>
          <p class="text-sm text-gray-600 mb-3">错误: ${validationResult.results.chapters.errorCount} 项 | 警告: ${validationResult.results.chapters.warningCount} 项</p>
          ${formatErrors(validationResult.results.chapters.errors)}
        </div>
      ` : '<p class="text-gray-500 italic">未检测到章节文件</p>'}
    </div>

    <!-- Ad Points Check -->
    <div class="card p-6 mb-6">
      <h2 class="text-xl font-bold text-gray-800 mb-4">📢 广告点位检查</h2>
      ${validationResult.results.adPoints ? `
        <div class="p-4 bg-gray-50 rounded-lg">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-gray-800">📄 ${validationResult.results.adPoints.fileName}</h3>
            <span class="px-3 py-1 rounded-full text-sm font-medium" style="background-color: ${validationResult.results.adPoints.passed ? (validationResult.results.adPoints.warningCount > 0 ? '#fef3c7' : '#d1fae5') : '#fee2e2'}; color: ${validationResult.results.adPoints.passed ? (validationResult.results.adPoints.warningCount > 0 ? '#92400e' : '#065f46') : '#991b1b'};">
              ${validationResult.results.adPoints.passed ? (validationResult.results.adPoints.warningCount > 0 ? '⚠️ 存在警告' : '✅ 通过') : '❌ 存在错误'}
            </span>
          </div>
          <p class="text-sm text-gray-600 mb-3">错误: ${validationResult.results.adPoints.errorCount} 项 | 警告: ${validationResult.results.adPoints.warningCount} 项</p>
          ${formatErrors(validationResult.results.adPoints.errors)}
        </div>
      ` : '<p class="text-gray-500 italic">未检测到广告点位文件</p>'}
    </div>
`;

  if (fixSuggestions.length > 0) {
    html += `
    <!-- Fix Suggestions -->
    <div class="card p-6 mb-6">
      <h2 class="text-xl font-bold text-gray-800 mb-4">💡 修复建议</h2>
      
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="text-center p-3 bg-red-50 rounded">
          <span class="text-xl">🔴</span>
          <p class="font-semibold text-red-600">${fixSuggestions.filter(s => s.priority === 'high').length} 高优先级</p>
        </div>
        <div class="text-center p-3 bg-yellow-50 rounded">
          <span class="text-xl">🟡</span>
          <p class="font-semibold text-yellow-600">${fixSuggestions.filter(s => s.priority === 'medium').length} 中优先级</p>
        </div>
        <div class="text-center p-3 bg-green-50 rounded">
          <span class="text-xl">🟢</span>
          <p class="font-semibold text-green-600">${fixSuggestions.filter(s => s.priority === 'low').length} 低优先级</p>
        </div>
      </div>
`;

    for (let i = 0; i < fixSuggestions.length; i++) {
      const suggestion = fixSuggestions[i];
      html += `
      <div class="mb-4 p-4 rounded-lg" style="border-left: 4px solid ${getPriorityColor(suggestion.priority)}; background-color: #f9fafb;">
        <div class="flex items-center gap-2 mb-2">
          <span class="px-2 py-1 rounded text-xs font-medium" style="background-color: ${getPriorityColor(suggestion.priority)}20; color: ${getPriorityColor(suggestion.priority)};">
            ${suggestion.priority === 'high' ? '高优先级' : suggestion.priority === 'medium' ? '中优先级' : '低优先级'}
          </span>
          <span class="font-semibold">问题 ${i + 1}/${fixSuggestions.length}</span>
        </div>
        
        <div class="text-sm text-gray-600 mb-2">
          <span class="font-medium">文件:</span> ${suggestion.error.fileName}
          ${suggestion.error.startTimeStr ? ` | <span class="font-medium">时间:</span> ${suggestion.error.startTimeStr} - ${suggestion.error.endTimeStr || ''}` : ''}
        </div>
        
        <p class="text-gray-700 mb-3">
          <span class="font-medium">问题:</span> ${suggestion.error.message}
        </p>
        
        <div>
          <p class="font-medium text-gray-800 mb-2">💡 修复步骤:</p>
          <ol class="list-decimal list-inside space-y-1 text-gray-700">
            ${suggestion.steps.map(step => `<li>${step}</li>`).join('')}
          </ol>
        </div>
      </div>
`;
    }

    html += `
    </div>
`;
  }

  html += `
    <!-- Footer -->
    <div class="text-center text-gray-500 text-sm mt-8 pt-4 border-t">
      <p>报告由「字幕交付体检」工具自动生成</p>
      <p class="mt-1">生成时间: ${validationResult.timestamp}</p>
    </div>

  </div>
</body>
</html>
`;

  return html;
}

export function generateReport(
  validationResult: ProjectValidationResult,
  suggestions?: FixSuggestion[]
): Report {
  return {
    markdown: generateMarkdownReport(validationResult, suggestions),
    json: generateJsonReport(validationResult, suggestions),
    html: generateHtmlReport(validationResult, suggestions)
  };
}
