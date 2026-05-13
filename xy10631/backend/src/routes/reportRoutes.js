const express = require('express');
const router = express.Router();
const db = require('../database/db');
const ExcelJS = require('exceljs');

router.get('/export', async (req, res) => {
  const { operator_id, start_time, end_time } = req.query;
  
  try {
    let sql = `
      SELECT 
        ol.*,
        s.name as sku_name,
        su.shift_date,
        a.name as area_name
      FROM operation_log ol
      LEFT JOIN sku s ON ol.business_type = 'sku' AND ol.business_id = s.id
      LEFT JOIN shift_usage su ON ol.business_type = 'shift_usage' AND ol.business_id = su.id
      LEFT JOIN area a ON ol.business_type = 'area' AND ol.business_id = a.id
      WHERE 1=1
    `;
    const params = [];
    
    if (operator_id) {
      sql += ` AND ol.operator_id = ?`;
      params.push(operator_id);
    }
    
    if (start_time) {
      sql += ` AND ol.operation_time >= ?`;
      params.push(start_time);
    }
    
    if (end_time) {
      sql += ` AND ol.operation_time <= ?`;
      params.push(end_time);
    }
    
    sql += ` ORDER BY ol.operation_time DESC`;
    
    db.all(sql, params, async (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('责任节点报告');
      
      worksheet.columns = [
        { header: '序号', key: 'index', width: 8 },
        { header: '业务类型', key: 'business_type', width: 15 },
        { header: '操作类型', key: 'operation_type', width: 15 },
        { header: '字段名称', key: 'field_name', width: 15 },
        { header: '原值', key: 'old_value', width: 15 },
        { header: '新值', key: 'new_value', width: 15 },
        { header: '操作人ID', key: 'operator_id', width: 15 },
        { header: '操作人姓名', key: 'operator_name', width: 15 },
        { header: '操作时间', key: 'operation_time', width: 25 },
        { header: '备注', key: 'notes', width: 30 }
      ];
      
      rows.forEach((row, index) => {
        worksheet.addRow({
          index: index + 1,
          business_type: row.business_type,
          operation_type: row.operation_type,
          field_name: row.field_name || '-',
          old_value: row.old_value || '-',
          new_value: row.new_value || '-',
          operator_id: row.operator_id,
          operator_name: row.operator_name,
          operation_time: row.operation_time,
          notes: row.notes
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
      res.setHeader('Content-Disposition', 'attachment; filename=责任节点报告.xlsx');
      
      await workbook.xlsx.write(res);
      res.end();
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sample-data/create', (req, res) => {
  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    const sku1Id = uuidv4();
    db.run(`
      INSERT INTO sku (id, sku_code, name, category, unit, unit_price, safety_stock, current_stock, status, created_at, updated_at, created_by)
      VALUES (?, 'SKU001', '多功能清洁剂', '清洁用品', '瓶', 25.5, 50, 100, 'active', ?, ?, 'admin')
    `, [sku1Id, now, now]);
    
    const sku2Id = uuidv4();
    db.run(`
      INSERT INTO sku (id, sku_code, name, category, unit, unit_price, safety_stock, current_stock, status, created_at, updated_at, created_by)
      VALUES (?, 'SKU002', '拖把头', '清洁工具', '个', 15.0, 30, 25, 'active', ?, ?, 'admin')
    `, [sku2Id, now, now]);
    
    const area1Id = uuidv4();
    db.run(`
      INSERT INTO area (id, area_code, name, building, floor, area_size, manager_id, manager_name, status, created_at, updated_at)
      VALUES (?, 'AREA001', 'A栋大堂', 'A栋', '1F', 500, 'mgr001', '张经理', 'active', ?, ?)
    `, [area1Id, now, now]);
    
    const area2Id = uuidv4();
    db.run(`
      INSERT INTO area (id, area_code, name, building, floor, area_size, manager_id, manager_name, status, created_at, updated_at)
      VALUES (?, 'AREA002', 'B栋办公区', 'B栋', '3F', 800, 'mgr002', '李主管', 'active', ?, ?)
    `, [area2Id, now, now]);
    
    const usage1Id = uuidv4();
    db.run(`
      INSERT INTO shift_usage (id, sku_id, sku_code, shift_date, shift_type, area_id, area_name, quantity, user_id, user_name, status, notes, created_at, updated_at)
      VALUES (?, ?, 'SKU001', '2024-01-15', '早班', ?, 'A栋大堂', 10, 'user001', '王阿姨', 'approved', '日常清洁领用', ?, ?)
    `, [usage1Id, sku1Id, area1Id, now, now]);
    
    const usage2Id = uuidv4();
    db.run(`
      INSERT INTO shift_usage (id, sku_id, sku_code, shift_date, shift_type, area_id, area_name, quantity, user_id, user_name, status, notes, created_at, updated_at)
      VALUES (?, ?, 'SKU002', '2024-01-15', '中班', ?, 'B栋办公区', 5, 'user002', '赵师傅', 'pending', '待审批', ?, ?)
    `, [usage2Id, sku2Id, area2Id, now, now]);
    
    const return1Id = uuidv4();
    db.run(`
      INSERT INTO return_inspection (id, usage_id, sku_id, return_quantity, inspector_id, inspector_name, inspection_date, inspection_result, rejection_reason, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, 2, 'ins001', '质检员刘', ?, 'rejected', '产品已开封，影响二次销售', 'rejected', '问题流案例', ?, ?)
    `, [return1Id, usage1Id, sku1Id, now, now, now]);
    
    const alert1Id = uuidv4();
    db.run(`
      INSERT INTO replenishment_alert (id, sku_id, sku_code, alert_date, current_stock, threshold, alert_level, handler_id, handler_name, handle_date, handle_result, replenishment_quantity, status, notes, created_at, updated_at)
      VALUES (?, ?, 'SKU002', ?, 25, 30, 'medium', 'pur001', '采购陈', ?, '已安排补货', 50, 'handled', '复核流案例', ?, ?)
    `, [alert1Id, sku2Id, now, now, now, now]);
    
    const variance1Id = uuidv4();
    db.run(`
      INSERT INTO cost_variance (id, sku_id, sku_code, period, expected_cost, actual_cost, variance, variance_rate, analysis, reviewer_id, reviewer_name, review_date, status, created_at, updated_at)
      VALUES (?, ?, 'SKU001', '2024-01', 255, 306, 51, 20, '领用数量超出预期，已核实为区域活动增加清洁频次', 'rev001', '财务周', ?, 'reviewed', ?, ?)
    `, [variance1Id, sku1Id, now, now, now]);
    
    db.run('COMMIT', (err) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: '样例数据创建成功', sku_count: 2, area_count: 2, usage_count: 2, return_count: 1, alert_count: 1, variance_count: 1 });
    });
  });
});

module.exports = router;