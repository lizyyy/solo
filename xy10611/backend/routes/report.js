const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../database/db');

router.get('/export', async (req, res) => {
  const { responsible_person, start_date, end_date, tag_code } = req.query;
  
  try {
    let query = `
      SELECT 
        st.id,
        lt.tag_code,
        lt.linen_type,
        lt.size,
        lt.floor,
        lt.room_number,
        st.status,
        st.status_text,
        st.operator,
        st.operation_time,
        st.remarks,
        st.related_type
      FROM status_timeline st
      JOIN linen_tags lt ON st.linen_tag_id = lt.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (responsible_person) {
      query += ` AND st.operator = ?`;
      params.push(responsible_person);
    }
    
    if (start_date) {
      query += ` AND st.operation_time >= ?`;
      params.push(start_date + ' 00:00:00');
    }
    
    if (end_date) {
      query += ` AND st.operation_time <= ?`;
      params.push(end_date + ' 23:59:59');
    }
    
    if (tag_code) {
      query += ` AND lt.tag_code = ?`;
      params.push(tag_code);
    }
    
    query += ` ORDER BY st.operation_time DESC`;
    
    const rows = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const compensationRecords = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          cr.*,
          lt.tag_code,
          crl.rule_name,
          crl.compensation_amount,
          cr.responsible_person,
          cr.deducted_at,
          cr.deducted_by
        FROM compensation_records cr
        JOIN linen_tags lt ON cr.linen_tag_id = lt.id
        JOIN compensation_rules crl ON cr.rule_id = crl.id
        ORDER BY cr.created_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '酒店布草洗涤追踪系统';
    workbook.created = new Date();
    
    const timelineSheet = workbook.addWorksheet('状态时间线');
    timelineSheet.columns = [
      { header: '标签编号', key: 'tag_code', width: 15 },
      { header: '布草类型', key: 'linen_type', width: 15 },
      { header: '规格', key: 'size', width: 10 },
      { header: '楼层', key: 'floor', width: 10 },
      { header: '房间号', key: 'room_number', width: 12 },
      { header: '状态', key: 'status_text', width: 20 },
      { header: '操作人', key: 'operator', width: 15 },
      { header: '操作时间', key: 'operation_time', width: 25 },
      { header: '备注', key: 'remarks', width: 30 },
      { header: '相关类型', key: 'related_type', width: 15 }
    ];
    
    timelineSheet.addRows(rows);
    
    timelineSheet.getRow(1).font = { bold: true, size: 12 };
    timelineSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    const compensationSheet = workbook.addWorksheet('赔付记录');
    compensationSheet.columns = [
      { header: '标签编号', key: 'tag_code', width: 15 },
      { header: '赔付规则', key: 'rule_name', width: 25 },
      { header: '赔付金额', key: 'compensation_amount', width: 12 },
      { header: '责任方', key: 'responsible_party', width: 15 },
      { header: '责任人', key: 'responsible_person', width: 15 },
      { header: '是否扣减', key: 'deducted', width: 12 },
      { header: '扣减时间', key: 'deducted_at', width: 25 },
      { header: '扣减人', key: 'deducted_by', width: 15 },
      { header: '备注', key: 'remarks', width: 30 }
    ];
    
    compensationSheet.addRows(compensationRecords.map(r => ({
      ...r,
      deducted: r.deducted ? '是' : '否'
    })));
    
    compensationSheet.getRow(1).font = { bold: true, size: 12 };
    compensationSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=linen-tracking-report-${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const statusCounts = await new Promise((resolve, reject) => {
      db.all(`
        SELECT status, COUNT(*) as count 
        FROM linen_tags 
        GROUP BY status
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const compensationSummary = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(*) as total_records,
          SUM(CASE WHEN deducted = 1 THEN 1 ELSE 0 END) as deducted_count,
          SUM(compensation_amount) as total_amount,
          SUM(CASE WHEN deducted = 1 THEN compensation_amount ELSE 0 END) as deducted_amount
        FROM compensation_records
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const damageByType = await new Promise((resolve, reject) => {
      db.all(`
        SELECT damage_type, damage_level, COUNT(*) as count
        FROM damage_photos
        GROUP BY damage_type, damage_level
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({
      status_counts: statusCounts,
      compensation_summary: compensationSummary,
      damage_by_type: damageByType
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;