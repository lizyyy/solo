const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { recordHistory, getHistory } = require('../utils/history');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { verification_status } = req.query;
    let sql = 'SELECT * FROM rights_holders WHERE 1=1';
    const params = [];

    if (verification_status) {
      sql += ' AND verification_status = ?';
      params.push(verification_status);
    }
    sql += ' ORDER BY created_at DESC';

    const holders = await db.all(sql, params);
    res.json({ success: true, data: holders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const holder = await db.get('SELECT * FROM rights_holders WHERE id = ?', [req.params.id]);
    if (!holder) {
      return res.status(404).json({ success: false, error: '权利人不存在' });
    }
    res.json({ success: true, data: holder });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await getHistory('rights_holders', req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, contact_person, phone, email, id_card, company_name, business_license } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '缺少必填字段: name' });
    }

    const id = uuidv4();
    await db.run(
      'INSERT INTO rights_holders (id, name, contact_person, phone, email, id_card, company_name, business_license) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, contact_person, phone, email, id_card, company_name, business_license]
    );

    const holder = await db.get('SELECT * FROM rights_holders WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: holder });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, contact_person, phone, email, id_card, company_name, business_license, verification_status, changed_by } = req.body;
    const holderId = req.params.id;

    const existing = await db.get('SELECT * FROM rights_holders WHERE id = ?', [holderId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '权利人不存在' });
    }

    const updates = [];
    const params = [];
    const fields = { name, contact_person, phone, email, id_card, company_name, business_license, verification_status };

    for (const [field, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${field} = ?`);
        params.push(value);
        if (existing[field] !== value) {
          await recordHistory('rights_holders', holderId, field, existing[field], value, changed_by);
        }
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(holderId);
      await db.run(`UPDATE rights_holders SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updated = await db.get('SELECT * FROM rights_holders WHERE id = ?', [holderId]);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/verify', async (req, res) => {
  try {
    const holderId = req.params.id;
    const { changed_by } = req.body;

    const existing = await db.get('SELECT * FROM rights_holders WHERE id = ?', [holderId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '权利人不存在' });
    }

    if (!existing.id_card && !existing.business_license) {
      return res.status(400).json({ success: false, error: '请先上传身份证或营业执照' });
    }

    await db.run(
      'UPDATE rights_holders SET verification_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['verified', holderId]
    );

    await recordHistory('rights_holders', holderId, 'verification_status', existing.verification_status, 'verified', changed_by);

    const updated = await db.get('SELECT * FROM rights_holders WHERE id = ?', [holderId]);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
