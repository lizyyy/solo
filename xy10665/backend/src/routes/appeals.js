const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { status, complaint_id, creator_id, reviewer } = req.query;
    let sql = `
      SELECT a.*, 
             c.complaint_reason, ci.title as content_title, ci.creator_name
      FROM creator_appeals a
      LEFT JOIN complaints c ON a.complaint_id = c.id
      LEFT JOIN content_items ci ON c.content_id = ci.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }
    if (complaint_id) {
      sql += ' AND a.complaint_id = ?';
      params.push(complaint_id);
    }
    if (creator_id) {
      sql += ' AND a.creator_id = ?';
      params.push(creator_id);
    }
    if (reviewer) {
      sql += ' AND a.reviewer = ?';
      params.push(reviewer);
    }
    sql += ' ORDER BY a.created_at DESC';

    const appeals = await db.all(sql, params);
    res.json({ success: true, data: appeals });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const appeal = await db.get(`
      SELECT a.*, 
             c.complaint_reason, ci.title as content_title, ci.creator_name
      FROM creator_appeals a
      LEFT JOIN complaints c ON a.complaint_id = c.id
      LEFT JOIN content_items ci ON c.content_id = ci.id
      WHERE a.id = ?
    `, [req.params.id]);

    if (!appeal) {
      return res.status(404).json({ success: false, error: '申诉不存在' });
    }

    const materials = await db.all('SELECT * FROM compliance_materials WHERE appeal_id = ?', [req.params.id]);

    res.json({ success: true, data: { ...appeal, materials } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { complaint_id, creator_id, appeal_reason, appeal_details } = req.body;

    if (!complaint_id || !creator_id || !appeal_reason) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const complaint = await db.get('SELECT * FROM complaints WHERE id = ?', [complaint_id]);
    if (!complaint) {
      return res.status(404).json({ success: false, error: '投诉不存在' });
    }

    const id = uuidv4();
    await db.run(
      'INSERT INTO creator_appeals (id, complaint_id, creator_id, appeal_reason, appeal_details) VALUES (?, ?, ?, ?, ?)',
      [id, complaint_id, creator_id, appeal_reason, appeal_details]
    );

    await db.run(
      'UPDATE complaints SET current_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['appealed', complaint_id]
    );

    const appeal = await db.get(`
      SELECT a.*, 
             c.complaint_reason, ci.title as content_title, ci.creator_name
      FROM creator_appeals a
      LEFT JOIN complaints c ON a.complaint_id = c.id
      LEFT JOIN content_items ci ON c.content_id = ci.id
      WHERE a.id = ?
    `, [id]);

    res.status(201).json({ success: true, data: appeal });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/review', async (req, res) => {
  try {
    const { status, reviewer, review_notes } = req.body;
    const appealId = req.params.id;

    if (!status || !reviewer) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const existing = await db.get('SELECT * FROM creator_appeals WHERE id = ?', [appealId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '申诉不存在' });
    }

    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: '无效的状态值' });
    }

    await db.run(
      'UPDATE creator_appeals SET status = ?, reviewer = ?, review_notes = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, reviewer, review_notes, appealId]
    );

    if (status === 'approved') {
      await db.run(
        'UPDATE complaints SET current_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['reinstated', existing.complaint_id]
      );
      await db.run(
        'UPDATE content_items SET status = ? WHERE id = (SELECT content_id FROM complaints WHERE id = ?)',
        ['active', existing.complaint_id]
      );
    }

    const updated = await db.get(`
      SELECT a.*, 
             c.complaint_reason, ci.title as content_title, ci.creator_name
      FROM creator_appeals a
      LEFT JOIN complaints c ON a.complaint_id = c.id
      LEFT JOIN content_items ci ON c.content_id = ci.id
      WHERE a.id = ?
    `, [appealId]);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/materials', async (req, res) => {
  try {
    const { material_type, material_url, description, uploaded_by } = req.body;
    const appealId = req.params.id;

    if (!material_type) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const appeal = await db.get('SELECT * FROM creator_appeals WHERE id = ?', [appealId]);
    if (!appeal) {
      return res.status(404).json({ success: false, error: '申诉不存在' });
    }

    const id = uuidv4();
    await db.run(
      'INSERT INTO compliance_materials (id, appeal_id, material_type, material_url, description, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, appealId, material_type, material_url, description, uploaded_by]
    );

    const material = await db.get('SELECT * FROM compliance_materials WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: material });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
