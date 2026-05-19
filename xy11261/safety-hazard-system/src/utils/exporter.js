const ExcelJS = require('exceljs');
const path = require('path');
const { db } = require('../models/database');

const exportHazardsToExcel = async (filters = {}) => {
  let sql = 'SELECT * FROM hazards WHERE 1=1';
  const params = [];

  if (filters.rectifier) {
    sql += ' AND rectifier = ?';
    params.push(filters.rectifier);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.hazard_level) {
    sql += ' AND hazard_level = ?';
    params.push(filters.hazard_level);
  }
  if (filters.start_time) {
    sql += ' AND inspector_time >= ?';
    params.push(filters.start_time);
  }
  if (filters.end_time) {
    sql += ' AND inspector_time <= ?';
    params.push(filters.end_time);
  }
  if (filters.location) {
    sql += ' AND location LIKE ?';
    params.push(`%${filters.location}%`);
  }

  sql += ' ORDER BY inspector_time DESC';

  const stmt = db.prepare(sql);
  const hazards = stmt.all(...params);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('隐患台账');

  const statusMap = {
    pending: '待分配',
    rectifying: '整改中',
    rechecking: '待复查',
    closed: '已闭环',
    escalated: '已升级'
  };

  const levelMap = {
    low: '低',
    medium: '中',
    high: '高',
    critical: '重大'
  };

  worksheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: '位置', key: 'location', width: 25 },
    { header: '隐患描述', key: 'description', width: 40 },
    { header: '风险等级', key: 'hazard_level', width: 10 },
    { header: '状态', key: 'status', width: 12 },
    { header: '巡检人', key: 'inspector', width: 12 },
    { header: '巡检时间', key: 'inspector_time', width: 20 },
    { header: '整改责任人', key: 'rectifier', width: 12 },
    { header: '整改截止时间', key: 'rectify_deadline', width: 20 },
    { header: '整改时间', key: 'rectify_time', width: 20 },
    { header: '复查人', key: 'rechecker', width: 12 },
    { header: '复查结果', key: 'recheck_result', width: 10 },
    { header: '复查时间', key: 'recheck_time', width: 20 },
    { header: '是否逾期升级', key: 'is_escalated', width: 12 }
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 12 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  for (const hazard of hazards) {
    worksheet.addRow({
      id: hazard.id,
      location: hazard.location,
      description: hazard.description,
      hazard_level: levelMap[hazard.hazard_level] || hazard.hazard_level,
      status: statusMap[hazard.status] || hazard.status,
      inspector: hazard.inspector,
      inspector_time: hazard.inspector_time ? new Date(hazard.inspector_time).toLocaleString('zh-CN') : '',
      rectifier: hazard.rectifier || '',
      rectify_deadline: hazard.rectify_deadline ? new Date(hazard.rectify_deadline).toLocaleString('zh-CN') : '',
      rectify_time: hazard.rectify_time ? new Date(hazard.rectify_time).toLocaleString('zh-CN') : '',
      rechecker: hazard.rechecker || '',
      recheck_result: hazard.recheck_result === 'pass' ? '合格' : hazard.recheck_result === 'fail' ? '不合格' : '',
      recheck_time: hazard.recheck_time ? new Date(hazard.recheck_time).toLocaleString('zh-CN') : '',
      is_escalated: hazard.status === 'escalated' ? '是' : '否'
    });
  }

  const summarySheet = workbook.addWorksheet('统计摘要');
  summarySheet.columns = [
    { header: '统计项', key: 'item', width: 30 },
    { header: '数量', key: 'count', width: 15 }
  ];

  const summaryHeader = summarySheet.getRow(1);
  summaryHeader.font = { bold: true, size: 12 };
  summaryHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  const stats = {
    total: hazards.length,
    closed: hazards.filter(h => h.status === 'closed').length,
    pending: hazards.filter(h => h.status === 'pending').length,
    rectifying: hazards.filter(h => h.status === 'rectifying').length,
    rechecking: hazards.filter(h => h.status === 'rechecking').length,
    escalated: hazards.filter(h => h.status === 'escalated').length,
    highLevel: hazards.filter(h => ['high', 'critical'].includes(h.hazard_level)).length
  };

  summarySheet.addRow({ item: '隐患总数', count: stats.total });
  summarySheet.addRow({ item: '已闭环数量', count: stats.closed });
  summarySheet.addRow({ item: '待分配数量', count: stats.pending });
  summarySheet.addRow({ item: '整改中数量', count: stats.rectifying });
  summarySheet.addRow({ item: '待复查数量', count: stats.rechecking });
  summarySheet.addRow({ item: '已升级数量', count: stats.escalated });
  summarySheet.addRow({ item: '高/重大风险数量', count: stats.highLevel });
  summarySheet.addRow({ item: '闭环率', count: stats.total > 0 ? `${((stats.closed / stats.total) * 100).toFixed(1)}%` : '0%' });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `隐患台账_${timestamp}.xlsx`;
  const filePath = path.join(__dirname, '../../exports', filename);

  await workbook.xlsx.writeFile(filePath);

  return {
    filePath,
    filename,
    total: hazards.length,
    stats
  };
};

module.exports = { exportHazardsToExcel };
