const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { recordHistory, getHistory } = require('../utils/history');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { status, creator_id } = req.query;
    let sql = 'SELECT * FROM content_items WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (creator_id) {
      sql += ' AND creator_id = ?';
      params.push(creator_id);
    }
    sql += ' ORDER BY created_at DESC';

    const items = await db.all(sql, params);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await db.get('SELECT * FROM content_items WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ success: false, error: '内容条目不存在' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await getHistory('content_items', req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, content_url, creator_id, creator_name } = req.body;

    if (!title || !creator_id || !creator_name) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const id = uuidv4();
    await db.run(
      'INSERT INTO content_items (id, title, content_url, creator_id, creator_name) VALUES (?, ?, ?, ?, ?)',
      [id, title, content_url, creator_id, creator_name]
    );

    const item = await db.get('SELECT * FROM content_items WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, content_url, status, changed_by } = req.body;
    const itemId = req.params.id;

    const existing = await db.get('SELECT * FROM content_items WHERE id = ?', [itemId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '内容条目不存在' });
    }

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
      if (existing.title !== title) {
        await recordHistory('content_items', itemId, 'title', existing.title, title, changed_by);
      }
    }
    if (content_url !== undefined) {
      updates.push('content_url = ?');
      params.push(content_url);
      if (existing.content_url !== content_url) {
        await recordHistory('content_items', itemId, 'content_url', existing.content_url, content_url, changed_by);
      }
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
      if (existing.status !== status) {
        await recordHistory('content_items', itemId, 'status', existing.status, status, changed_by);
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(itemId);
      await db.run(`UPDATE content_items SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updated = await db.get('SELECT * FROM content_items WHERE id = ?', [itemId]);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
