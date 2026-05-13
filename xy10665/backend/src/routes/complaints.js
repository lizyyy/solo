const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { recordHistory, getHistory } = require('../utils/history');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { current_status, content_id, holder_id, handler, start_date, end_date } = req.query;
    let sql = `
      SELECT c.*, 
             ci.title as content_title, ci.creator_name,
             rh.name as holder_name
      FROM complaints c
      LEFT JOIN content_items ci ON c.content_id = ci.id
      LEFT JOIN rights_holders rh ON c.holder_id = rh.id
      WHERE 1=1
    `;
    const params = [];

    if (current_status) {
      sql += ' AND c.current_status = ?';
      params.push(current_status);
    }
    if (content_id) {
      sql += ' AND c.content_id = ?';
      params.push(content_id);
    }
    if (holder_id) {
      sql += ' AND c.holder_id = ?';
      params.push(holder_id);
    }
    if (handler) {
      sql += ' AND c.handler = ?';
      params.push(handler);
    }
    if (start_date) {
      sql += ' AND c.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND c.created_at <= ?';
      params.push(end_date);
    }
    sql += ' ORDER BY c.created_at DESC';

    const complaints = await db.all(sql, params);
    res.json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const complaint = await db.get(`
      SELECT c.*, 
             ci.title as content_title, ci.creator_name, ci.creator_id,
             rh.name as holder_name
      FROM complaints c
      LEFT JOIN content_items ci ON c.content_id = ci.id
      LEFT JOIN rights_holders rh ON c.holder_id = rh.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!complaint) {
      return res.status(404).json({ success: false, error: '投诉不存在' });
    }

    const evidences = await db.all('SELECT * FROM complaint_evidences WHERE complaint_id = ?', [req.params.id]);
    const statusHistory = await db.all('SELECT * FROM takedown_status WHERE complaint_id = ? ORDER BY created_at DESC', [req.params.id]);

    res.json({ success: true, data: { ...complaint, evidences, statusHistory } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await getHistory('complaints', req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { content_id, holder_id, complaint_reason, complaint_details } = req.body;

    if (!content_id || !holder_id || !complaint_reason) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const holder = await db.get('SELECT * FROM rights_holders WHERE id = ?', [holder_id]);
    if (!holder) {
      return res.status(400).json({ success: false, error: '权利人不存在' });
    }
    if (holder.verification_status !== 'verified') {
      return res.status(400).json({ success: false, error: '权利人未通过验证，无法提交投诉' });
    }

    const content = await db.get('SELECT * FROM content_items WHERE id = ?', [content_id]);
    if (!content) {
      return res.status(400).json({ success: false, error: '内容条目不存在' });
    }

    const id = uuidv4();
    await db.run(
      'INSERT INTO complaints (id, content_id, holder_id, complaint_reason, complaint_details) VALUES (?, ?, ?, ?, ?)',
      [id, content_id, holder_id, complaint_reason, complaint_details]
    );

    const statusId = uuidv4();
    await db.run(
      'INSERT INTO takedown_status (id, complaint_id, status) VALUES (?, ?, ?)',
      [statusId, id, 'pending']
    );

    const complaint = await db.get(`
      SELECT c.*, 
             ci.title as content_title, ci.creator_name,
             rh.name as holder_name
      FROM complaints c
      LEFT JOIN content_items ci ON c.content_id = ci.id
      LEFT JOIN rights_holders rh ON c.holder_id = rh.id
      WHERE c.id = ?
    `, [id]);

    res.status(201).json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status, handler, notes } = req.body;
    const complaintId = req.params.id;

    const existing = await db.get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '投诉不存在' });
    }

    const validStatuses = ['pending', 'reviewing', 'takedown', 'rejected', 'appealed', 'reinstated'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: '无效的状态值' });
    }

    await db.run(
      'UPDATE complaints SET current_status = ?, handler = ?, handled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, handler, complaintId]
    );

    await recordHistory('complaints', complaintId, 'current_status', existing.current_status, status, handler);

    const statusId = uuidv4();
    await db.run(
      'INSERT INTO takedown_status (id, complaint_id, status, handler, notes) VALUES (?, ?, ?, ?, ?)',
      [statusId, complaintId, status, handler, notes]
    );

    if (status === 'takedown') {
      await db.run('UPDATE content_items SET status = ? WHERE id = (SELECT content_id FROM complaints WHERE id = ?)', ['taken_down', complaintId]);
    } else if (status === 'reinstated') {
      await db.run('UPDATE content_items SET status = ? WHERE id = (SELECT content_id FROM complaints WHERE id = ?)', ['active', complaintId]);
    }

    const updated = await db.get(`
      SELECT c.*, 
             ci.title as content_title, ci.creator_name,
             rh.name as holder_name
      FROM complaints c
      LEFT JOIN content_items ci ON c.content_id = ci.id
      LEFT JOIN rights_holders rh ON c.holder_id = rh.id
      WHERE c.id = ?
    `, [complaintId]);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/evidences', async (req, res) => {
  try {
    const { evidence_type, evidence_url, description, uploaded_by } = req.body;
    const complaintId = req.params.id;

    if (!evidence_type) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const complaint = await db.get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!complaint) {
      return res.status(404).json({ success: false, error: '投诉不存在' });
    }

    const id = uuidv4();
    await db.run(
      'INSERT INTO complaint_evidences (id, complaint_id, evidence_type, evidence_url, description, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, complaintId, evidence_type, evidence_url, description, uploaded_by]
    );

    const evidence = await db.get('SELECT * FROM complaint_evidences WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: evidence });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/evidences/:evidenceId/history', async (req, res) => {
  try {
    const history = await getHistory('complaint_evidences', req.params.evidenceId);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
