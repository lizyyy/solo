const fs = require('fs');
const { getBookRecords, getErrorRecords, getSession, getAllSessions } = require('../models/bookModel');

async function exportToCSV(sessionId, outputPath, status = null) {
  const records = await getBookRecords(sessionId, status);
  const session = await getSession(sessionId);

  const headers = ['ISBN', '书名', '作者', '出版社', '年级', '品相', '捐赠人', '备注', '状态', '操作人', '角色', '创建时间'];
  const rows = records.map(r => [
    r.isbn,
    r.title,
    r.author,
    r.publisher,
    r.grade,
    r.condition,
    r.donor,
    r.remark,
    r.status,
    r.operator,
    r.role,
    r.created_at
  ]);

  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell || ''}"`).join(',')).join('\n');
  fs.writeFileSync(outputPath, '\uFEFF' + csvContent);

  return { filePath: outputPath, recordCount: records.length, session };
}

async function exportErrorsToCSV(sessionId, outputPath) {
  const errors = await getErrorRecords(sessionId, false);
  const session = await getSession(sessionId);

  const headers = ['原始行号', '错误类型', '错误信息', '修改建议', '原始数据', '操作人', '角色', '创建时间'];
  const rows = errors.map(e => {
    const rawData = JSON.parse(e.raw_data || '{}');
    return [
      e.source_row,
      e.error_type,
      e.error_message,
      e.suggestion,
      JSON.stringify(rawData),
      e.operator,
      e.role,
      e.created_at
    ];
  });

  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell || ''}"`).join(',')).join('\n');
  fs.writeFileSync(outputPath, '\uFEFF' + csvContent);

  return { filePath: outputPath, errorCount: errors.length, session };
}

async function exportAllToMarkdown(sessionId, outputPath) {
  const records = await getBookRecords(sessionId);
  const errors = await getErrorRecords(sessionId);
  const session = await getSession(sessionId);

  let mdContent = `# 书籍入库报告 - 会话 #${sessionId}\n\n`;
  mdContent += `## 导入信息\n\n`;
  mdContent += `- 源文件: ${session.source_file}\n`;
  mdContent += `- 导入类型: ${session.source_type}\n`;
  mdContent += `- 操作人: ${session.operator} (${session.role})\n`;
  mdContent += `- 导入时间: ${session.import_time}\n`;
  mdContent += `- 总计: ${session.total_records} 条 | 成功: ${session.success_count} 条 | 失败: ${session.error_count} 条\n\n`;

  if (records.length > 0) {
    mdContent += `## 成功导入的书籍 (${records.length}条)\n\n`;
    for (const book of records) {
      mdContent += `### ${book.title}\n\n`;
      mdContent += `- ISBN: ${book.isbn}\n`;
      mdContent += `- 作者: ${book.author || '未知'}\n`;
      mdContent += `- 出版社: ${book.publisher || '未知'}\n`;
      mdContent += `- 年级: ${book.grade}\n`;
      mdContent += `- 品相: ${book.condition}\n`;
      mdContent += `- 捐赠人: ${book.donor || '未填写'}\n`;
      mdContent += `- 状态: ${book.status}\n`;
      if (book.remark) mdContent += `- 备注: ${book.remark}\n`;
      mdContent += '\n';
    }
  }

  if (errors.length > 0) {
    const unresolved = errors.filter(e => !e.is_resolved);
    mdContent += `## 需要处理的错误记录 (${unresolved.length}条)\n\n`;
    for (const error of unresolved) {
      const raw = JSON.parse(error.raw_data || '{}');
      mdContent += `### 第 ${error.source_row} 行\n\n`;
      mdContent += `**错误类型**: ${error.error_type}\n\n`;
      mdContent += `**错误信息**: ${error.error_message}\n\n`;
      mdContent += `**修改建议**: ${error.suggestion}\n\n`;
      mdContent += `**原始数据**:\n\n`;
      mdContent += '```\n';
      for (const [key, value] of Object.entries(raw)) {
        mdContent += `${key}: ${value}\n`;
      }
      mdContent += '```\n\n';
    }
  }

  fs.writeFileSync(outputPath, mdContent, 'utf-8');
  return { filePath: outputPath, session };
}

async function generateSessionReport() {
  const sessions = await getAllSessions();
  let report = '# 公益书库入库历史记录\n\n';
  report += `共 ${sessions.length} 次导入\n\n`;

  for (const session of sessions) {
    report += `## 会话 #${session.id} - ${session.import_time}\n\n`;
    report += `- 文件: ${session.source_file}\n`;
    report += `- 类型: ${session.source_type}\n`;
    report += `- 操作人: ${session.operator} (${session.role})\n`;
    report += `- 总计: ${session.total_records} | 成功: ${session.success_count} | 失败: ${session.error_count}\n`;
    report += `- 状态: ${session.status}\n\n`;
  }

  return report;
}

module.exports = {
  exportToCSV,
  exportErrorsToCSV,
  exportAllToMarkdown,
  generateSessionReport
};
