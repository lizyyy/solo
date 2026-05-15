const express = require('express');
const router = express.Router();
const db = require('../config/dbUtils');
const dayjs = require('dayjs');

router.get('/', async (req, res) => {
  try {
    const { matterId, severity, isResolved } = req.query;
    
    let sql = `
      SELECT g.*, m.name as matter_name, it.name as identity_name, a.name as attachment_name
      FROM material_gaps g
      LEFT JOIN business_matters m ON g.matter_id = m.id
      LEFT JOIN identity_types it ON g.identity_type_id = it.id
      LEFT JOIN attachments a ON g.attachment_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (matterId) {
      sql += ' AND g.matter_id = ?';
      params.push(matterId);
    }

    if (severity) {
      sql += ' AND g.severity = ?';
      params.push(severity);
    }

    if (isResolved !== undefined) {
      sql += ' AND g.is_resolved = ?';
      params.push(isResolved === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY g.created_at DESC';

    const gaps = await db.all(sql, params);
    res.json({ success: true, data: gaps });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { matter_id, identity_type_id, gap_type, gap_description, attachment_id, severity } = req.body;
    const result = await db.run(`
      INSERT INTO material_gaps (matter_id, identity_type_id, gap_type, gap_description, attachment_id, severity, is_resolved, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `, [matter_id, identity_type_id, gap_type, gap_description, attachment_id, severity || 'normal', dayjs().format()]);

    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/resolve', async (req, res) => {
  try {
    const { resolvedBy } = req.body;
    await db.run(`
      UPDATE material_gaps 
      SET is_resolved = 1, resolved_by = ?, resolved_time = ?
      WHERE id = ?
    `, [resolvedBy || 'system', dayjs().format(), req.params.id]);

    res.json({ success: true, message: '材料缺口已解决' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
