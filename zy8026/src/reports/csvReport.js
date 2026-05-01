import fs from 'fs';

export function generateCSV(issues, outputPath) {
  const sortedIssues = [...issues].sort((a, b) => {
    const severityOrder = { error: 0, warning: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return (a.type || '').localeCompare(b.type || '');
  });

  let csv = '类型,严重程度,镜头ID,文件名,描述\n';

  for (const issue of sortedIssues) {
    const typeLabel = getTypeLabel(issue.type);
    const severityLabel = issue.severity === 'error' ? '错误' : '警告';
    const shotId = escapeCSV(issue.shotId || '');
    const filename = escapeCSV(issue.filename || '');
    const message = escapeCSV(issue.message || '');
    
    csv += `${typeLabel},${severityLabel},${shotId},${filename},${message}\n`;
  }

  fs.writeFileSync(outputPath, csv, 'utf-8');
  return outputPath;
}

function escapeCSV(value) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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