import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { ValidationResult, Issue } from '../types';

export interface ReportOptions {
  outputDir: string;
  issuesCsvName?: string;
  reportMdName?: string;
}

export async function generateReports(
  result: ValidationResult,
  options: ReportOptions
): Promise<{ issuesCsvPath: string; reportMdPath: string }> {
  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }
  
  const issuesCsvPath = path.join(
    options.outputDir,
    options.issuesCsvName || 'issues.csv'
  );
  const reportMdPath = path.join(
    options.outputDir,
    options.reportMdName || 'handover_report.md'
  );
  
  await generateIssuesCsv(result.issues, issuesCsvPath);
  await generateHandoverReport(result, reportMdPath);
  
  console.log(`\n报告已生成:`);
  console.log(`  - 问题列表: ${issuesCsvPath}`);
  console.log(`  - 移交报告: ${reportMdPath}`);
  
  return { issuesCsvPath, reportMdPath };
}

async function generateIssuesCsv(issues: Issue[], outputPath: string): Promise<void> {
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'id', title: '问题ID' },
      { id: 'caseNumber', title: '案号' },
      { id: 'ruleId', title: '规则ID' },
      { id: 'ruleName', title: '规则名称' },
      { id: 'severity', title: '严重程度' },
      { id: 'category', title: '分类' },
      { id: 'message', title: '问题描述' },
      { id: 'details', title: '详细信息' },
      { id: 'affectedFiles', title: '涉及文件' },
      { id: 'timestamp', title: '发现时间' }
    ],
    encoding: 'utf8'
  });
  
  const records = issues.map(issue => ({
    id: issue.id,
    caseNumber: issue.caseNumber,
    ruleId: issue.ruleId,
    ruleName: issue.ruleName,
    severity: formatSeverity(issue.severity),
    category: issue.category,
    message: issue.message,
    details: issue.details.replace(/\n/g, '; '),
    affectedFiles: issue.affectedFiles.join('; '),
    timestamp: issue.timestamp
  }));
  
  await csvWriter.writeRecords(records);
}

function formatSeverity(severity: string): string {
  const map: Record<string, string> = {
    'error': '错误',
    'warning': '警告',
    'info': '提示'
  };
  return map[severity] || severity;
}

async function generateHandoverReport(
  result: ValidationResult,
  outputPath: string
): Promise<void> {
  const content = buildReportContent(result);
  fs.writeFileSync(outputPath, content, 'utf-8');
}

function buildReportContent(result: ValidationResult): string {
  const now = new Date().toLocaleString('zh-CN');
  
  let content = `# 法院电子卷宗移交校验报告

**生成时间**: ${now}  
**校验耗时**: ${result.validationTime}

---

## 一、校验概览

| 指标 | 数值 |
|------|------|
| 总案件数 | ${result.totalCases} |
| 已验证案件数 | ${result.validatedCases} |
| 总问题数 | ${result.totalIssues} |
| 错误数 | ${result.errors} |
| 警告数 | ${result.warnings} |
| 提示数 | ${result.infos} |

---

## 二、问题分类统计

`;
  
  const categoryStats = new Map<string, { error: number; warning: number; info: number; total: number }>();
  
  for (const issue of result.issues) {
    const stat = categoryStats.get(issue.category) || { error: 0, warning: 0, info: 0, total: 0 };
    stat[issue.severity as keyof typeof stat]++;
    stat.total++;
    categoryStats.set(issue.category, stat);
  }
  
  content += `| 分类 | 错误 | 警告 | 提示 | 总计 |
|------|------|------|------|------|
`;
  
  for (const [category, stat] of categoryStats.entries()) {
    content += `| ${category} | ${stat.error} | ${stat.warning} | ${stat.info} | ${stat.total} |\n`;
  }
  
  content += `
---

## 三、特殊情况提示

`;
  
  if (result.pathCaseIssues.length > 0) {
    content += `### 3.1 路径大小写差异问题

以下案件存在路径大小写不一致的情况，可能导致跨平台兼容性问题：

| 案号 | 实际路径 | 期望路径 |
|------|----------|----------|
`;
    for (const issue of result.pathCaseIssues) {
      content += `| ${issue.caseNumber} | ${issue.actualPath} | ${issue.expectedPath} |\n`;
    }
    content += '\n';
  }
  
  if (result.batchAppendCases.length > 0) {
    content += `### 3.2 同案号多批次追加

以下案件涉及多个批次，请确认所有批次文件完整：

| 案号 | 涉及批次 |
|------|----------|
`;
    for (const item of result.batchAppendCases) {
      content += `| ${item.caseNumber} | ${item.batchNumbers.join(', ')} |\n`;
    }
    content += '\n';
  }
  
  if (result.duplicateFiles.length > 0) {
    content += `### 3.3 跨盘/跨案重复文件

以下文件在不同光盘或不同案件中重复出现：

`;
    for (let i = 0; i < result.duplicateFiles.length; i++) {
      const group = result.duplicateFiles[i];
      content += `#### 重复文件组 ${i + 1}

- **哈希值**: ${group.hash}
- **涉及文件**:

`;
      for (const file of group.files) {
        content += `  - 光盘: ${file.diskLabel || '未知'}, 案号: ${file.caseNumber}, 路径: ${file.path}\n`;
      }
      content += '\n';
    }
  }
  
  content += `---

## 四、详细问题列表

`;
  
  const errors = result.issues.filter(i => i.severity === 'error');
  const warnings = result.issues.filter(i => i.severity === 'warning');
  const infos = result.issues.filter(i => i.severity === 'info');
  
  if (errors.length > 0) {
    content += `### 4.1 错误 (${errors.length}个)

`;
    for (const issue of errors) {
      content += `#### [${issue.ruleId}] ${issue.message}

- **案号**: ${issue.caseNumber}
- **分类**: ${issue.category}
- **详细信息**: 
${indentLines(issue.details, '  ')}
${issue.affectedFiles.length > 0 ? `- **涉及文件**: ${issue.affectedFiles.join(', ')}\n` : ''}
`;
    }
  }
  
  if (warnings.length > 0) {
    content += `### 4.2 警告 (${warnings.length}个)

`;
    for (const issue of warnings) {
      content += `#### [${issue.ruleId}] ${issue.message}

- **案号**: ${issue.caseNumber}
- **分类**: ${issue.category}
- **详细信息**: 
${indentLines(issue.details, '  ')}
${issue.affectedFiles.length > 0 ? `- **涉及文件**: ${issue.affectedFiles.join(', ')}\n` : ''}
`;
    }
  }
  
  if (infos.length > 0) {
    content += `### 4.3 提示 (${infos.length}个)

`;
    for (const issue of infos) {
      content += `#### [${issue.ruleId}] ${issue.message}

- **案号**: ${issue.caseNumber}
- **分类**: ${issue.category}
- **详细信息**: 
${indentLines(issue.details, '  ')}
${issue.affectedFiles.length > 0 ? `- **涉及文件**: ${issue.affectedFiles.join(', ')}\n` : ''}
`;
    }
  }
  
  content += `---

## 五、案件统计详情

| 案号 | 批次 | 文件数 | 错误数 | 警告数 | 提示数 |
|------|------|--------|--------|--------|--------|
`;
  
  for (const stat of result.caseStats) {
    const caseErrors = stat.issues.filter(i => i.severity === 'error').length;
    const caseWarnings = stat.issues.filter(i => i.severity === 'warning').length;
    const caseInfos = stat.issues.filter(i => i.severity === 'info').length;
    
    content += `| ${stat.caseNumber} | ${stat.batchNumbers.join(',') || '-'} | ${stat.fileCount} | ${caseErrors} | ${caseWarnings} | ${caseInfos} |\n`;
  }
  
  content += `
---

## 六、校验结论

`;
  
  if (result.errors > 0) {
    content += `⚠️ **校验不通过**

存在 ${result.errors} 个错误需要修复后才能进行移交。主要问题包括：
`;
    const errorCategories = new Set(errors.map(e => e.category));
    for (const cat of errorCategories) {
      const count = errors.filter(e => e.category === cat).length;
      content += `- ${cat}: ${count} 个错误\n`;
    }
  } else if (result.warnings > 0) {
    content += `✅ **校验基本通过，但存在警告**

存在 ${result.warnings} 个警告，建议检查后再进行移交。主要问题包括：
`;
    const warningCategories = new Set(warnings.map(e => e.category));
    for (const cat of warningCategories) {
      const count = warnings.filter(e => e.category === cat).length;
      content += `- ${cat}: ${count} 个警告\n`;
    }
  } else {
    content += `✅ **校验完全通过**

所有 ${result.totalCases} 个案件校验通过，未发现任何问题。可以安全进行移交。
`;
  }
  
  content += `
---

*本报告由 case-validator 工具自动生成*
`;
  
  return content;
}

function indentLines(text: string, indent: string): string {
  return text.split('\n').map(line => indent + line).join('\n');
}
