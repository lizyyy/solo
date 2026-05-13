const express = require('express');
const router = express.Router();
const { get, run, all } = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const TimelineService = require('../services/timelineService');

router.post('/', async (req, res) => {
  try {
    const { name, phone, id_card, skills, experience_years } = req.body;
    const ayiId = `AYI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    await run(
      `INSERT INTO ayi_profiles (ayi_id, name, phone, id_card, skills, experience_years) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ayiId, name, phone, id_card, skills, experience_years]
    );

    await TimelineService.record(
      'ayi_create',
      'ayi',
      ayiId,
      'success',
      'success',
      `创建阿姨档案: ${name}`,
      req.body.operator || 'system',
      { name, phone }
    );

    res.json({ success: true, ayi_id: ayiId });
  } catch (err) {
    await TimelineService.record(
      'ayi_create',
      'ayi',
      null,
      'failed',
      'failed',
      '创建阿姨档案失败',
      'system',
      req.body,
      err.message
    );
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, keyword, limit, offset } = req.query;
    let sql = 'SELECT * FROM ayi_profiles WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (keyword) {
      sql += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC';

    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset) || 0);
    }

    const ayis = await all(sql, params);
    res.json({ success: true, data: ayis });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:ayiId', async (req, res) => {
  try {
    const ayi = await get('SELECT * FROM ayi_profiles WHERE ayi_id = ?', [req.params.ayiId]);
    if (!ayi) {
      return res.status(404).json({ success: false, error: '阿姨档案不存在' });
    }
    res.json({ success: true, data: ayi });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:ayiId', async (req, res) => {
  try {
    const { name, phone, id_card, skills, experience_years, status } = req.body;
    await run(
      `UPDATE ayi_profiles 
       SET name = ?, phone = ?, id_card = ?, skills = ?, experience_years = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE ayi_id = ?`,
      [name, phone, id_card, skills, experience_years, status, req.params.ayiId]
    );

    await TimelineService.record(
      'ayi_update',
      'ayi',
      req.params.ayiId,
      'success',
      'success',
      `更新阿姨档案: ${name}`,
      req.body.operator || 'system',
      req.body
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;