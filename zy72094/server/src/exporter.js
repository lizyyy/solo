function exportToCSV(conflicts, courses, selections, filterOptions) {
  const headers = [
    '冲突ID',
    '冲突类型',
    '严重程度',
    '学生ID',
    '课程ID',
    '课程名称',
    '标题',
    '原因',
    '公式',
    '数值',
    '阈值',
    '单位',
    '来源',
    '检测时间'
  ];

  const rows = conflicts.map(conflict => [
    conflict.id,
    conflict.type,
    conflict.severity,
    conflict.studentId || '-',
    conflict.courseId || conflict.affectedCourses?.join(', ') || '-',
    conflict.courseName || conflict.courseNames?.join(', ') || '-',
    conflict.title,
    conflict.reason,
    conflict.formula,
    conflict.value,
    conflict.threshold,
    conflict.unit,
    conflict.source,
    new Date().toISOString()
  ]);

  let csv = headers.join(',') + '\n';
  
  rows.forEach(row => {
    csv += row.map(cell => {
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('\n') || cell.includes('"'))) {
        return '"' + cell.replace(/"/g, '""') + '"';
      }
      return cell;
    }).join(',') + '\n';
  });

  if (filterOptions && Object.keys(filterOptions).length > 0) {
    csv += '\n# 筛选条件\n';
    for (const [key, value] of Object.entries(filterOptions)) {
      if (value) {
        csv += `# ${key}: ${value}\n`;
      }
    }
  }

  csv += '\n# 导出时间: ' + new Date().toLocaleString('zh-CN');

  return csv;
}

function exportToExcel(conflicts, courses, selections, filterOptions) {
  let csv = exportToCSV(conflicts, courses, selections, filterOptions);
  return Buffer.from(csv, 'utf-8');
}

module.exports = {
  exportToCSV,
  exportToExcel
};
