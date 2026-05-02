import fs from 'fs';

export function generateMarkdown(issues, outputPath) {
  const sortedIssues = [...issues].sort((a, b) => {
    const severityOrder = { error: 0, warning: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return (a.type || '').localeCompare(b.type || '');
  });

  const errors = sortedIssues.filter(i => i.severity === 'error');
  const warnings = sortedIssues.filter(i => i.severity === 'warning');

  let md = `# 视频素材质检报告

生成时间: ${new Date().toLocaleString('zh-CN')}

## 概览

| 统计项 | 数量 |
|--------|------|
| 错误 | ${errors.length} |
| 警告 | ${warnings.length} |
| 总计 | ${issues.length} |

`;

  if (errors.length > 0) {
    md += `## 错误 (${errors.length})

| 类型 | 镜头ID | 文件名 | 描述 |
|------|--------|--------|------|
`;
    for (const issue of errors) {
      md += `| ${getTypeLabel(issue.type)} | ${issue.shotId || '-'} | ${issue.filename || '-'} | ${issue.message} |\n`;
    }
    md += '\n';
  }

  if (warnings.length > 0) {
    md += `## 警告 (${warnings.length})

| 类型 | 镜头ID | 文件名 | 描述 |
|------|--------|--------|------|
`;
    for (const issue of warnings) {
      md += `| ${getTypeLabel(issue.type)} | ${issue.shotId || '-'} | ${issue.filename || '-'} | ${issue.message} |\n`;
    }
    md += '\n';
  }

  md += `## 类型说明

- **${getTypeLabel('file_naming')}**: 文件命名或存在性问题
- **${getTypeLabel('duration')}**: 时长偏差问题
- **${getTypeLabel('subtitle')}**: 字幕时间越界问题
- **${getTypeLabel('format')}**: 画幅/码率不达标问题

`;

  fs.writeFileSync(outputPath, md, 'utf-8');
  return outputPath;
}

function getTypeLabel(type) {
  const labels = {
    file_naming: '文件命名',
    duration: '时长偏差',
    subtitle: '字幕越界',
    format: '格式规格'
  };
  return labels[type] || type;
}