const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logFlow } = require('../utils/audit');

router.get('/', (req, res) => {
  const { device_number, repair_status, responsible_person } = req.query;
  let query = 'SELECT * FROM repair_records WHERE 1=1';
  const params = [];

  if (device_number) {
    query += ' AND device_number LIKE ?';
    params.push(`%${device_number}%`);
  }
  if (repair_status) {
    query += ' AND repair_status = ?';
    params.push(repair_status);
  }
  if (responsible_person) {
    query += ' AND responsible_person LIKE ?';
    params.push(`%${responsible_person}%`);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/', async (req, res) => {
  const { device_id, device_number, issue_description, responsible_person, operator } = req.body;
  const id = uuidv4();

  try {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO repair_records (id, device_id, device_number, issue_description, responsible_person, operator) VALUES (?, ?, ?, ?, ?, ?)',
        [id, device_id, device_number, issue_description, responsible_person, operator],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await logFlow(device_id, device_number, null, 'repair_create',
      null, { issue_description, responsible_person }, operator);

    db.get('SELECT * FROM repair_records WHERE id = ?', [id], (err, row) => {
      if (err) res.status(500).json({ error: err.message });
      else res.status(201).json(row);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const { repair_status, operator } = req.body;

  try {
    const oldRepair = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM repair_records WHERE id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!oldRepair) {
      return res.status(404).json({ error: '维修记录不存在' });
    }

    const repairTime = repair_status === 'completed' ? new Date().toISOString() : oldRepair.repair_time;

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE repair_records SET repair_status = ?, repair_time = ? WHERE id = ?',
        [repair_status, repairTime, req.params.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    if (repair_status === 'completed') {
      await logFlow(oldRepair.device_id, oldRepair.device_number, null, 'repair_complete',
        { status: oldRepair.repair_status }, { status: 'completed' }, operator, '维修完成');

      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE devices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['available', oldRepair.device_id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    db.get('SELECT * FROM repair_records WHERE id = ?', [req.params.id], (err, row) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(row);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
