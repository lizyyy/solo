const express = require('express');
const router = express.Router();
const db = require('../database/database');

router.get('/', async (req, res) => {
  try {
    const { layer_id, status } = req.query;
    
    let sql = 'SELECT * FROM reviews WHERE 1=1';
    const params = [];
    
    if (layer_id) {
      sql += ' AND layer_id = ?';
      params.push(layer_id);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY review_date DESC';
    
    const reviews = await db.all(sql, params);
    res.json({ success: true, data: reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const review = await db.get('SELECT * FROM reviews WHERE id = ?', [req.params.id]);
    
    if (!review) {
      return res.status(404).json({ success: false, error: '复核记录不存在' });
    }
    
    res.json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { layer_id, process_type, reviewer_name, review_date, signature, status, comments, issues_found } = req.body;
    
    if (!layer_id) {
      return res.status(400).json({ success: false, error: '漆层ID为必填项' });
    }
    
    const layer = await db.get('SELECT id FROM layers WHERE id = ?', [layer_id]);
    if (!layer) {
      return res.status(400).json({ success: false, error: '漆层不存在' });
    }
    
    const result = await db.run(`
      INSERT INTO reviews 
      (layer_id, process_type, reviewer_name, review_date, signature, status, comments, issues_found)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [layer_id, process_type, reviewer_name, review_date, signature, status || 'pending', comments, issues_found]);
    
    res.json({ success: true, data: { id: result.lastID } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { reviewer_name, review_date, signature, status, comments, issues_found } = req.body;
    
    const existing = await db.get('SELECT id FROM reviews WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '复核记录不存在' });
    }
    
    const updates = [];
    const values = [];
    
    if (reviewer_name !== undefined) { updates.push('reviewer_name = ?'); values.push(reviewer_name); }
    if (review_date !== undefined) { updates.push('review_date = ?'); values.push(review_date); }
    if (signature !== undefined) { updates.push('signature = ?'); values.push(signature); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (comments !== undefined) { updates.push('comments = ?'); values.push(comments); }
    if (issues_found !== undefined) { updates.push('issues_found = ?'); values.push(issues_found); }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有需要更新的字段' });
    }
    
    values.push(req.params.id);
    
    await db.run(`UPDATE reviews SET ${updates.join(', ')} WHERE id = ?`, values);
    
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
