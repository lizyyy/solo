const express = require('express');
const router = express.Router();
const db = require('../database/db');
const ExcelJS = require('exceljs');

router.get('/summary', (req, res) => {
  const { start_date, end_date, responsible_person } = req.query;
  
  let params = [];
  let whereClauses = [];
  
  if (start_date) {
    whereClauses.push('cs.created_at >= ?');
    params.push(start_date);
  }
  if (end_date) {
    whereClauses.push('cs.created_at <= ?');
    params.push(end_date);
  }
  if (responsible_person) {
    whereClauses.push('cs.assigned_staff_id = ?');
    params.push(responsible_person);
  }
  
  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  db.all(`
    SELECT 
      cs.id,
      cs.scheduled_time,
      cs.actual_start_time,
      cs.actual_end_time,
      cs.status,
      cs.quality_score,
      cs.notes,
      cs.old_values,
      cs.new_values,
      s.movie_name,
      h.name as hall_name,
      st.name as staff_name,
      ei.status as inspection_status,
      ei.issues as inspection_issues
    FROM cleaning_schedules cs
    LEFT JOIN screenings s ON cs.screening_id = s.id
    LEFT JOIN halls h ON cs.hall_id = h.id
    LEFT JOIN staff st ON cs.assigned_staff_id = st.id
    LEFT JOIN equipment_inspections ei ON cs.id = ei.cleaning_id
    ${whereSQL}
    ORDER BY cs.scheduled_time DESC
  `, params, (err, cleanings) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all(`
      SELECT * FROM shift_changes ORDER BY change_time DESC
    `, (shiftErr, shifts) => {
      if (shiftErr) return res.status(500).json({ error: shiftErr.message });
      
      db.all(`
        SELECT al.*, st.name as changer_name
        FROM audit_logs al
        LEFT JOIN staff st ON al.changed_by = st.id
        ORDER BY al.changed_at DESC
      `, (auditErr, audits) => {
        if (auditErr) return res.status(500).json({ error: auditErr.message });
        
        res.json({
          cleanings,
          shifts,
          audit_logs: audits,
          responsibility_nodes: cleanings.map(c => ({
            task_id: c.id,
            task: `${c.hall_name} - ${c.movie_name} 清洁`,
            responsible_person: c.staff_name,
            start_time: c.actual_start_time,
            end_time: c.actual_end_time,
            status: c.status,
            quality_score: c.quality_score,
            has_changes: c.old_values !== null
          }))
        });
      });
    });
  });
});

router.get('/export', async (req, res) => {
  const { start_date, end_date, responsible_person } = req.query;
  
  let params = [];
  let whereClauses = [];
  
  if (start_date) {
    whereClauses.push('cs.created_at >= ?');
    params.push(start_date);
  }
  if (end_date) {
    whereClauses.push('cs.created_at <= ?');
    params.push(end_date);
  }
  if (responsible_person) {
    whereClauses.push('cs.assigned_staff_id = ?');
    params.push(responsible_person);
  }
  
  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  db.all(`
    SELECT 
      cs.id,
      cs.scheduled_time,
      cs.actual_start_time,
      cs.actual_end_time,
      cs.status,
      cs.quality_score,
      cs.notes,
      cs.old_values,
      cs.new_values,
      s.movie_name,
      h.name as hall_name,
      st.name as staff_name
    FROM cleaning_schedules cs
    LEFT JOIN screenings s ON cs.screening_id = s.id
    LEFT JOIN halls h ON cs.hall_id = h.id
    LEFT JOIN staff st ON cs.assigned_staff_id = st.id
    ${whereSQL}
    ORDER BY cs.scheduled_time DESC
  `, params, async (err, cleanings) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('清洁排班报告');
    
    worksheet.columns = [
      { header: '任务ID', key: 'id', width: 10 },
      { header: '影厅', key: 'hall_name', width: 15 },
      { header: '影片', key: 'movie_name', width: 20 },
      { header: '负责人', key: 'staff_name', width: 15 },
      { header: '计划时间', key: 'scheduled_time', width: 25 },
      { header: '开始时间', key: 'actual_start_time', width: 25 },
      { header: '结束时间', key: 'actual_end_time', width: 25 },
      { header: '状态', key: 'status', width: 12 },
      { header: '质量评分', key: 'quality_score', width: 12 },
      { header: '备注', key: 'notes', width: 30 },
      { header: '修改前值', key: 'old_values', width: 30 },
      { header: '修改后值', key: 'new_values', width: 30 }
    ];
    
    worksheet.getRow(1).font = { bold: true };
    
    cleanings.forEach(cleaning => {
      worksheet.addRow({
        id: cleaning.id,
        hall_name: cleaning.hall_name,
        movie_name: cleaning.movie_name,
        staff_name: cleaning.staff_name || '未分配',
        scheduled_time: cleaning.scheduled_time,
        actual_start_time: cleaning.actual_start_time || '-',
        actual_end_time: cleaning.actual_end_time || '-',
        status: cleaning.status,
        quality_score: cleaning.quality_score || '-',
        notes: cleaning.notes || '-',
        old_values: cleaning.old_values || '-',
        new_values: cleaning.new_values || '-'
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=cleaning_report.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  });
});

module.exports = router;
