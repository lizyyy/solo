const express = require('express');
const router = express.Router();
const db = require('../database/database');

router.get('/', async (req, res) => {
  try {
    const { artwork_id } = req.query;
    
    let sql = 'SELECT * FROM layers WHERE 1=1';
    const params = [];
    
    if (artwork_id) {
      sql += ' AND artwork_id = ?';
      params.push(artwork_id);
    }
    sql += ' ORDER BY artwork_id, layer_number';
    
    const layers = await db.all(sql, params);
    res.json({ success: true, data: layers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const layer = await db.get('SELECT * FROM layers WHERE id = ?', [req.params.id]);
    
    if (!layer) {
      return res.status(404).json({ success: false, error: '漆层不存在' });
    }
    
    const processes = await db.all(`
      SELECT * FROM processes WHERE layer_id = ? ORDER BY start_time
    `, [req.params.id]);
    
    const reviews = await db.all(`
      SELECT * FROM reviews WHERE layer_id = ? ORDER BY review_date
    `, [req.params.id]);
    
    res.json({
      success: true,
      data: {
        ...layer,
        processes,
        reviews
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { artwork_id, layer_number, lacquer_type, thickness, color, notes } = req.body;
    
    if (!artwork_id || layer_number === undefined) {
      return res.status(400).json({ success: false, error: '作品ID和层数为必填项' });
    }
    
    const existing = await db.get(
      'SELECT id FROM layers WHERE artwork_id = ? AND layer_number = ?',
      [artwork_id, layer_number]
    );
    if (existing) {
      return res.status(400).json({ success: false, error: '该作品的该层数已存在' });
    }
    
    const result = await db.run(`
      INSERT INTO layers 
      (artwork_id, layer_number, lacquer_type, thickness, color, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [artwork_id, layer_number, lacquer_type, thickness, color, notes]);
    
    res.json({ success: true, data: { id: result.lastID } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { lacquer_type, thickness, color, notes, status } = req.body;
    
    const existing = await db.get('SELECT id FROM layers WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '漆层不存在' });
    }
    
    const updates = [];
    const values = [];
    
    if (lacquer_type !== undefined) { updates.push('lacquer_type = ?'); values.push(lacquer_type); }
    if (thickness !== undefined) { updates.push('thickness = ?'); values.push(thickness); }
    if (color !== undefined) { updates.push('color = ?'); values.push(color); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有需要更新的字段' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);
    
    await db.run(`UPDATE layers SET ${updates.join(', ')} WHERE id = ?`, values);
    
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
