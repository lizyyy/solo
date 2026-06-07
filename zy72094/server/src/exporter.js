function exportToCSV(conflicts, courses, selections, filterOptions, notesMap) {
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
    '规则说明',
    '数值',
    '阈值',
    '单位',
    '偏差',
    '来源',
    '检测步骤',
    '人工备注',
    '检测时间'
  ];

  const typeLabels = {
    TIME_CONFLICT: '时间冲突',
    CREDIT_OVERLOAD: '学分超量',
    CREDIT_UNDERLOAD: '学分不足',
    DUPLICATE_SELECTION: '重复选课',
    COURSE_CAPACITY_EXCEEDED: '容量超限',
    COURSE_RATIO_HIGH: '选课率预警',
    DAILY_LIMIT_EXCEEDED: '单日超限'
  };

  const severityLabels = { high: '高危', medium: '中危', low: '低危' };

  const rows = conflicts.map(conflict => {
    const deviation = conflict.unit === '%'
      ? ((conflict.value - conflict.threshold) * 100).toFixed(1) + '%'
      : (conflict.value - conflict.threshold) + ' ' + conflict.unit;

    const conflictNotes = (notesMap && notesMap[conflict.id]) || [];
    const notesStr = conflictNotes.map(n => `[${n.author} ${new Date(n.timestamp).toLocaleString('zh-CN')}] ${n.content}`).join('; ');

    return [
      conflict.id,
      typeLabels[conflict.type] || conflict.type,
      severityLabels[conflict.severity] || conflict.severity,
      conflict.studentId || '-',
      conflict.courseId || conflict.affectedCourses?.join('; ') || '-',
      conflict.courseName || conflict.courseNames?.join('; ') || '-',
      conflict.title,
      conflict.reason,
      conflict.formula,
      conflict.formulaDetail || '',
      conflict.value,
      conflict.threshold,
      conflict.unit,
      deviation,
      conflict.source,
      conflict.traceId || '',
      notesStr || '',
      new Date().toISOString()
    ];
  });

  let csv = headers.join(',') + '\n';
  
  rows.forEach(row => {
    csv += row.map(cell => {
      const str = String(cell);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',') + '\n';
  });

  csv += '\n# === 统计信息 ===\n';
  csv += `# 冲突总数: ${conflicts.length}\n`;
  const byType = {};
  const bySeverity = { high: 0, medium: 0, low: 0 };
  conflicts.forEach(c => {
    byType[c.type] = (byType[c.type] || 0) + 1;
    bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
  });
  csv += `# 高危: ${bySeverity.high}, 中危: ${bySeverity.medium}, 低危: ${bySeverity.low}\n`;
  for (const [type, count] of Object.entries(byType)) {
    csv += `# ${typeLabels[type] || type}: ${count}\n`;
  }

  if (filterOptions) {
    const activeFilters = Object.entries(filterOptions).filter(([_, v]) => v);
    if (activeFilters.length > 0) {
      csv += '\n# === 筛选条件 ===\n';
      for (const [key, value] of activeFilters) {
        csv += `# ${key}: ${value}\n`;
      }
    }
  }

  csv += '\n# 导出时间: ' + new Date().toLocaleString('zh-CN') + '\n';

  return csv;
}

function exportToExcel(conflicts, courses, selections, filterOptions, notesMap) {
  let csv = exportToCSV(conflicts, courses, selections, filterOptions, notesMap);
  return Buffer.from(csv, 'utf-8');
}

module.exports = {
  exportToCSV,
  exportToExcel
};
