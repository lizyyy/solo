const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { logAudit } = require('../middleware/audit');

router.get('/', (req, res) => {
  db.all(`
    SELECT ei.*, h.name as hall_name, s.name as inspector_name, r.name as resolver_name
    FROM equipment_inspections ei
    LEFT JOIN halls h ON ei.hall_id = h.id
    LEFT JOIN staff s ON ei.inspector_id = s.id
    LEFT JOIN staff r ON ei.resolved_by = r.id
    ORDER BY ei.inspection_time DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`
    SELECT ei.*, h.name as hall_name, s.name as inspector_name
    FROM equipment_inspections ei
    LEFT JOIN halls h ON ei.hall_id = h.id
    LEFT JOIN staff s ON ei.inspector_id = s.id
    WHERE ei.id = ?
  `, [req.params.id], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row);
  });
});

router.post('/:id/start', (req, res) => {
  const { inspector_id } = req.body;
  
  db.get('SELECT * FROM equipment_inspections WHERE id = ?', [req.params.id], async (err, inspection) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get('SELECT * FROM cleaning_schedules WHERE id = ?', [inspection.cleaning_id], (cleanErr, cleaning) => {
      if (cleanErr) return res.status(500).json({ error: cleanErr.message });
      
      if (cleaning && cleaning.status !== 'completed') {
        return res.status(400).json({ error: '清洁未完成，无法开始设备巡检' });
      }
      
      db.run(
        `UPDATE equipment_inspections SET status = 'in_progress', inspector_id = ?, inspection_time = CURRENT_TIMESTAMP WHERE id = ?`,
        [inspector_id, req.params.id],
        async function(updateErr) {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          
          await logAudit('equipment_inspections', req.params.id, 'start', 
            { status: inspection.status }, 
            { status: 'in_progress', inspector_id }, 
            1
          );
          
          res.json({ message: '设备巡检开始' });
        }
      );
    });
  });
});

router.post('/:id/update-item', (req, res) => {
  const { item_index, status, issue } = req.body;
  
  db.get('SELECT * FROM equipment_inspections WHERE id = ?', [req.params.id], async (err, inspection) => {
    if (err) return res.status(500).json({ error: err.message });
    
    let items = JSON.parse(inspection.items || '[]');
    if (items[item_index]) {
      items[item_index].status = status;
      if (issue) items[item_index].issue = issue;
    }
    
    const hasIssues = items.some(item => item.status === 'failed');
    
    db.run(
      `UPDATE equipment_inspections SET items = ? WHERE id = ?`,
      [JSON.stringify(items), req.params.id],
      async function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        
        await logAudit('equipment_inspections', req.params.id, 'update_item', 
          { items: inspection.items }, 
          { items: JSON.stringify(items) }, 
          1
        );
        
        if (hasIssues) {
          db.get('SELECT * FROM positions WHERE name = ?', ['设备维修'], (posErr, position) => {
            if (position) {
              db.run(
                `INSERT INTO uncovered_positions (hall_id, position_id, notes) VALUES (?, ?, ?)`,
                [inspection.hall_id, position.id, `设备巡检发现问题: ${issue}`],
                (insertErr) => {
                  if (insertErr) console.error('创建未覆盖岗位失败:', insertErr);
                }
              );
            }
          });
        }
        
        res.json({ message: '检查项更新成功', has_issues: hasIssues });
      }
    );
  });
});

router.post('/:id/complete', (req, res) => {
  const { issues, resolution } = req.body;
  
  db.get('SELECT * FROM equipment_inspections WHERE id = ?', [req.params.id], async (err, inspection) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const hasIssues = issues && issues.length > 0;
    const newStatus = hasIssues ? 'needs_repair' : 'passed';
    
    db.run(
      `UPDATE equipment_inspections SET status = ?, issues = ?, resolution = ? WHERE id = ?`,
      [newStatus, issues, resolution, req.params.id],
      async function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        
        await logAudit('equipment_inspections', req.params.id, 'complete', 
          { status: inspection.status }, 
          { status: newStatus, issues, resolution }, 
          1
        );
        
        res.json({ message: hasIssues ? '巡检完成，需要维修' : '巡检通过' });
      }
    );
  });
});

router.post('/:id/resolve', (req, res) => {
  const { resolved_by, resolution } = req.body;
  
  db.get('SELECT * FROM equipment_inspections WHERE id = ?', [req.params.id], async (err, inspection) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(
      `UPDATE equipment_inspections SET status = 'resolved', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, resolution = ? WHERE id = ?`,
      [resolved_by, resolution, req.params.id],
      async function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        
        await logAudit('equipment_inspections', req.params.id, 'resolve', 
          { status: inspection.status }, 
          { status: 'resolved', resolved_by, resolution }, 
          1
        );
        
        res.json({ message: '问题已解决' });
      }
    );
  });
});

module.exports = router;
