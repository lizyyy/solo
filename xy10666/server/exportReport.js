const ExcelJS = require('exceljs');
const db = require('./database');

module.exports = function(req, res) {
  const { responsible_person, start_date, end_date, type } = req.query;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '模具寿命保养拦截系统';
  
  const worksheet = workbook.addWorksheet('流转记录报表');

  worksheet.columns = [
    { header: '序号', key: 'id', width: 8 },
    { header: '流转类型', key: 'flow_type', width: 15 },
    { header: '相关ID', key: 'related_id', width: 10 },
    { header: '操作', key: 'action', width: 15 },
    { header: '操作人', key: 'operator', width: 15 },
    { header: '备注', key: 'remarks', width: 30 },
    { header: '创建时间', key: 'created_at', width: 20 }
  ];

  let query = 'SELECT * FROM flow_records WHERE 1=1';
  const params = [];

  if (responsible_person) {
    query += ' AND operator = ?';
    params.push(responsible_person);
  }
  if (start_date) {
    query += ' AND created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND created_at <= ?';
    params.push(end_date);
  }
  if (type) {
    query += ' AND flow_type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, async (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    rows.forEach((row, index) => {
      worksheet.addRow({
        id: index + 1,
        flow_type: getFlowTypeName(row.flow_type),
        related_id: row.related_id,
        action: row.action,
        operator: row.operator,
        remarks: row.remarks,
        created_at: row.created_at
      });
    });

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=mold_report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  });
};

function getFlowTypeName(type) {
  const typeMap = {
    'mold': '模具档案',
    'maintenance_plan': '保养计划',
    'maintenance': '保养记录',
    'production': '排产任务',
    'exception': '异常处理'
  };
  return typeMap[type] || type;
}
