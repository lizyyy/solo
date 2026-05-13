const ExcelJS = require('exceljs');
const moment = require('moment');

module.exports = (app, db) => {
  app.get('/api/report/export', (req, res) => {
    const { volunteer_id, start_date, end_date, operator } = req.query;
    
    let sql = `
      SELECT 
        t.id,
        t.volunteer_id,
        t.volunteer_name,
        t.action,
        t.description,
        t.operator as responsible_person,
        t.operate_time,
        t.status,
        t.related_type,
        t.related_id
      FROM timeline t
      WHERE 1=1
    `;
    let params = [];
    
    if (volunteer_id) {
      sql += ` AND t.volunteer_id = ?`;
      params.push(volunteer_id);
    }
    if (start_date) {
      sql += ` AND t.operate_time >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND t.operate_time <= ?`;
      params.push(end_date);
    }
    if (operator) {
      sql += ` AND t.operator = ?`;
      params.push(operator);
    }
    sql += ` ORDER BY t.operate_time DESC`;

    db.all(sql, params, (err, timelineRows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.all(`SELECT * FROM audit_logs ORDER BY operate_time DESC`, (err, auditRows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        db.all(`SELECT * FROM subsidy_records ORDER BY created_at DESC`, (err, subsidyRows) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          const workbook = new ExcelJS.Workbook();
          workbook.creator = '志愿者补贴系统';
          workbook.created = new Date();

          const timelineSheet = workbook.addWorksheet('操作时间线');
          timelineSheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: '志愿者ID', key: 'volunteer_id', width: 12 },
            { header: '志愿者姓名', key: 'volunteer_name', width: 15 },
            { header: '操作类型', key: 'action', width: 20 },
            { header: '描述', key: 'description', width: 40 },
            { header: '责任人', key: 'responsible_person', width: 15 },
            { header: '操作时间', key: 'operate_time', width: 25 },
            { header: '状态', key: 'status', width: 15 },
            { header: '关联类型', key: 'related_type', width: 15 }
          ];
          timelineRows.forEach(row => timelineSheet.addRow(row));

          const auditSheet = workbook.addWorksheet('修改记录');
          auditSheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: '模块', key: 'module', width: 20 },
            { header: '记录ID', key: 'record_id', width: 12 },
            { header: '字段名', key: 'field_name', width: 20 },
            { header: '旧值', key: 'old_value', width: 30 },
            { header: '新值', key: 'new_value', width: 30 },
            { header: '操作类型', key: 'operation', width: 15 },
            { header: '操作人', key: 'operator', width: 15 },
            { header: '操作时间', key: 'operate_time', width: 25 }
          ];
          auditRows.forEach(row => auditSheet.addRow(row));

          const subsidySheet = workbook.addWorksheet('补贴记录');
          subsidySheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: '志愿者ID', key: 'volunteer_id', width: 12 },
            { header: '志愿者姓名', key: 'volunteer_name', width: 15 },
            { header: '补贴规则', key: 'rule_name', width: 25 },
            { header: '金额', key: 'amount', width: 12 },
            { header: '回调ID', key: 'callback_id', width: 25 },
            { header: '状态', key: 'status', width: 15 },
            { header: '备注', key: 'remarks', width: 30 },
            { header: '创建人', key: 'created_by', width: 15 },
            { header: '创建时间', key: 'created_at', width: 25 }
          ];
          subsidyRows.forEach(row => subsidySheet.addRow(row));

          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename=志愿者补贴报告_${moment().format('YYYYMMDDHHmmss')}.xlsx`);

          workbook.xlsx.write(res).then(() => res.end());
        });
      });
    });
  });

  app.get('/api/audit-logs', (req, res) => {
    const { module, operator, start_date, end_date } = req.query;
    let sql = `SELECT * FROM audit_logs WHERE 1=1`;
    let params = [];
    
    if (module) {
      sql += ` AND module = ?`;
      params.push(module);
    }
    if (operator) {
      sql += ` AND operator = ?`;
      params.push(operator);
    }
    if (start_date) {
      sql += ` AND operate_time >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND operate_time <= ?`;
      params.push(end_date);
    }
    sql += ` ORDER BY operate_time DESC`;
    
    db.all(sql, params, (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    });
  });
};
