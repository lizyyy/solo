import fs from 'fs/promises';
import path from 'path';

export async function generateReport(results, outputPath, logger) {
  logger.detail('开始生成报告...');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(outputPath, `comparison-report-${timestamp}.json`);
  const summaryPath = path.join(outputPath, `summary-${timestamp}.md`);

  await fs.writeFile(reportPath, JSON.stringify(results, null, 2), 'utf8');
  logger.success(`详细报告已生成: ${reportPath}`);

  const summaryMarkdown = generateSummaryMarkdown(results);
  await fs.writeFile(summaryPath, summaryMarkdown, 'utf8');
  logger.success(`摘要报告已生成: ${summaryPath}`);

  await generateIssueReports(results, outputPath, logger);

  logger.detail('报告生成完成');
}

function generateSummaryMarkdown(results) {
  return `# 合同版本目录重签版本比对 - 执行摘要

生成时间: ${new Date().toLocaleString('zh-CN')}

## 统计概览

| 类别 | 数量 | 说明 |
|------|------|------|
| 合同总数 | ${results.totalContracts} | 参与比对的合同数量 |
| 比对一致 | ${results.matched} | 新旧版本无差异 |
| 存在差异 | ${results.differences} | 需要人工审核 |
| 附件漏传 | ${results.missingAttachments} | 必须补充的附件 |
| 签章位置变化 | ${results.signatureChanges} | 需要重新确认 |
| 处理异常 | ${results.errors} | 处理失败的合同 |

## 合同详细列表

${results.contracts.map((c, i) => generateContractSection(c, i + 1)).join('\n')}

---
*本报告由合同版本目录重签版本比对 CLI 自动生成*
`;
}

function generateContractSection(contract, index) {
  const statusEmoji = {
    matched: '✅',
    difference: '⚠️',
    missing_attachment: '❌',
    signature_change: '🔄',
    error: '💥',
  };

  const statusText = {
    matched: '比对一致',
    difference: '存在差异',
    missing_attachment: '附件漏传',
    signature_change: '签章位置变化',
    error: '处理异常',
  };

  let section = `### ${index}. ${statusEmoji[contract.status] || '❓'} ${contract.contractNo} - ${contract.contractName}

- **合同类型**: ${contract.contractType}
- **处理状态**: ${statusText[contract.status] || contract.status}
- **版本范围**: ${contract.oldVersion || '-'} → ${contract.newVersion || '-'}
`;

  if (contract.differences && contract.differences.length > 0) {
    section += `
#### 差异字段

| 字段名称 | 旧版本值 | 新版本值 | 严重程度 |
|----------|----------|----------|----------|
${contract.differences.map(d => `| ${d.fieldName} | ${d.oldValue || '-'} | ${d.newValue || '-'} | ${d.severity} |`).join('\n')}
`;
  }

  if (contract.missingAttachments && contract.missingAttachments.length > 0) {
    section += `
#### 漏传附件

| 附件名称 | 说明 | 严重程度 |
|----------|------|----------|
${contract.missingAttachments.map(a => `| ${a.name} | ${a.description} | ${a.severity} |`).join('\n')}
`;
  }

  if (contract.signatureChanges && contract.signatureChanges.length > 0) {
    section += `
#### 签章位置变化

| 签章位置 | 旧版本页码 | 新版本页码 |
|----------|------------|------------|
${contract.signatureChanges.map(s => `| ${s.positionName} | ${s.oldPage} | ${s.newPage} |`).join('\n')}
`;
  }

  if (contract.error) {
    section += `
#### 错误信息

\`\`\`
${contract.error}
\`\`\`
`;
  }

  return section;
}

async function generateIssueReports(results, outputPath, logger) {
  const missingAttachments = results.contracts.filter(c => c.missingAttachments && c.missingAttachments.length > 0);
  if (missingAttachments.length > 0) {
    const reportPath = path.join(outputPath, 'missing-attachments-report.md');
    const content = `# 附件漏传专项报告

生成时间: ${new Date().toLocaleString('zh-CN')}

共有 ${missingAttachments.length} 份合同存在附件漏传问题，需立即补充。

${missingAttachments.map(c => `
## ${c.contractNo} - ${c.contractName}

### 漏传附件清单:
${c.missingAttachments.map(a => `- **${a.name}**: ${a.description}`).join('\n')}
`).join('\n')}
`;
    await fs.writeFile(reportPath, content, 'utf8');
    logger.detail(`附件漏传专项报告已生成: ${reportPath}`);
  }

  const signatureChanges = results.contracts.filter(c => c.signatureChanges && c.signatureChanges.length > 0);
  if (signatureChanges.length > 0) {
    const reportPath = path.join(outputPath, 'signature-changes-report.md');
    const content = `# 签章位置变化专项报告

生成时间: ${new Date().toLocaleString('zh-CN')}

共有 ${signatureChanges.length} 份合同存在签章位置变化，需重新确认。

${signatureChanges.map(c => `
## ${c.contractNo} - ${c.contractName}

### 变化签章清单:
${c.signatureChanges.map(s => `- **${s.positionName}**: 第 ${s.oldPage} 页 → 第 ${s.newPage} 页`).join('\n')}
`).join('\n')}
`;
    await fs.writeFile(reportPath, content, 'utf8');
    logger.detail(`签章位置变化专项报告已生成: ${reportPath}`);
  }
}
