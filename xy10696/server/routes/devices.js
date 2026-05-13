const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logAudit, logFlow, logException } = require('../utils/audit');

router.get('/', (req, res) => {
  const { device_number, language_pack, status } = req.query;
  let query = 'SELECT * FROM devices WHERE 1=1';
  const params = [];

  if (device_number) {
    query += ' AND device_number LIKE ?';
    params.push(`%${device_number}%`);
  }
  if (language_pack) {
    query += ' AND language_pack = ?';
    params.push(language_pack);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM devices WHERE id = ?', [req.params.id], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else if (!row) res.status(404).json({ error: '设备不存在' });
    else res.json(row);
  });
});

router.post('/', (req, res) => {
  const { device_number, language_pack, operator } = req.body;
  const id = uuidv4();

  db.run(
    'INSERT INTO devices (id, device_number, language_pack) VALUES (?, ?, ?)',
    [id, device_number, language_pack],
    async function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: '设备编号已存在' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      await logFlow(id, device_number, null, 'create', null, { device_number, language_pack }, operator);
      
      db.get('SELECT * FROM devices WHERE id = ?', [id], (err, row) => {
        if (err) res.status(500).json({ error: err.message });
        else res.status(201).json(row);
      });
    }
  );
});

router.put('/:id', async (req, res) => {
  const { device_number, language_pack, status, battery_level, operator } = req.body;
  
  try {
    const oldDevice = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM devices WHERE id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!oldDevice) {
      return res.status(404).json({ error: '设备不存在' });
    }

    const updates = [];
    const params = [];

    if (device_number !== undefined) {
      updates.push('device_number = ?');
      params.push(device_number);
      if (oldDevice.device_number !== device_number) {
        await logAudit('devices', req.params.id, 'device_number', oldDevice.device_number, device_number, operator);
      }
    }
    if (language_pack !== undefined) {
      updates.push('language_pack = ?');
      params.push(language_pack);
      if (oldDevice.language_pack !== language_pack) {
        await logAudit('devices', req.params.id, 'language_pack', oldDevice.language_pack, language_pack, operator);
      }
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
      if (oldDevice.status !== status) {
        await logAudit('devices', req.params.id, 'status', oldDevice.status, status, operator);
      }
    }
    if (battery_level !== undefined) {
      updates.push('battery_level = ?');
      params.push(battery_level);
      if (oldDevice.battery_level !== battery_level) {
        await logAudit('devices', req.params.id, 'battery_level', oldDevice.battery_level, battery_level, operator);
        if (battery_level < 20) {
          await logException(req.params.id, oldDevice.device_number, null, 'low_battery', `电量过低: ${battery_level}%`, operator, operator);
        }
      }
    }

    if (updates.length === 0) {
      return res.json(oldDevice);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    db.run(
      `UPDATE devices SET ${updates.join(', ')} WHERE id = ?`,
      params,
      async function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          await logFlow(req.params.id, oldDevice.device_number, null, 'update', oldDevice, { ...oldDevice, ...req.body }, operator);
          db.get('SELECT * FROM devices WHERE id = ?', [req.params.id], (err, row) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json(row);
          });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
