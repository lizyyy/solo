const express = require('express');
const router = express.Router();
const db = require('../database/database');
const violationChecker = require('../services/violationChecker');

router.get('/', async (req, res) => {
  try {
    const { artwork_id, layer_id, type, severity, resolved } = req.query;
    
    let sql = 'SELECT * FROM violations WHERE 1=1';
    const params = [];
    
    if (artwork_id) {
      sql += ' AND artwork_id = ?';
      params.push(artwork_id);
    }
    if (layer_id) {
      sql += ' AND layer_id = ?';
      params.push(layer_id);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }
    if (resolved !== undefined) {
      sql += ' AND resolved = ?';
      params.push(resolved === 'true' || resolved === '1' ? 1 : 0);
    }
    sql += ' ORDER BY detected_at DESC';
    
    const violations = await db.all(sql, params);
    res.json({ success: true, data: violations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const violation = await db.get('SELECT * FROM violations WHERE id = ?', [req.params.id]);
    
    if (!violation) {
      return res.status(404).json({ success: false, error: '违规记录不存在' });
    }
    
    res.json({ success: true, data: violation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/check', async (req, res) => {
  try {
    const result = await violationChecker.runFullCheckAndRecord();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/resolve', async (req, res) => {
  try {
    const { resolved_by, resolution_notes } = req.body;
    
    const existing = await db.get('SELECT id FROM violations WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '违规记录不存在' });
    }
    
    const moment = require('moment');
    await db.run(`
      UPDATE violations 
      SET resolved = 1, resolved_by = ?, resolved_at = ?, resolution_notes = ?
      WHERE id = ?
    `, [resolved_by, moment().toISOString(), resolution_notes, req.params.id]);
    
    res.json({ success: true, message: '问题已标记为已解决' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const totalViolations = await db.get('SELECT COUNT(*) as count FROM violations');
    const unresolved = await db.get('SELECT COUNT(*) as count FROM violations WHERE resolved = 0');
    const critical = await db.get('SELECT COUNT(*) as count FROM violations WHERE severity = ? AND resolved = 0', ['critical']);
    
    const byType = await db.all(`
      SELECT type, COUNT(*) as count, 
             SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as unresolved_count
      FROM violations 
      GROUP BY type
      ORDER BY count DESC
    `);
    
    const bySeverity = await db.all(`
      SELECT severity, COUNT(*) as count,
             SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as unresolved_count
      FROM violations
      GROUP BY severity
      ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END
    `);
    
    res.json({
      success: true,
      data: {
        total: totalViolations.count,
        unresolved: unresolved.count,
        critical_unresolved: critical.count,
        by_type: byType,
        by_severity: bySeverity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
