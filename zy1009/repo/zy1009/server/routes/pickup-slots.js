const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const { is_active } = req.query;
  
  let query = 'SELECT * FROM pickup_slots WHERE 1=1';
  const params = [];
  
  if (is_active !== undefined) {
    query += ' AND is_active = ?';
    params.push(is_active === 'true' || is_active === 1 ? 1 : 0);
  }
  
  query += ' ORDER BY slot_time';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM pickup_slots WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '取货时间段不存在' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { slot_time, description } = req.body;
  
  if (!slot_time) {
    return res.status(400).json({ error: '取货时间段为必填项' });
  }

  const id = uuidv4();
  const is_active = 1;
  
  db.run(
    'INSERT INTO pickup_slots (id, slot_time, description, is_active) VALUES (?, ?, ?, ?)',
    [id, slot_time, description || '', is_active],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: '取货时间段已存在' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ id, slot_time, description, is_active });
    }
  );
});

router.put('/:id', (req, res) => {
  const { slot_time, description, is_active } = req.body;
  const slotId = req.params.id;

  db.get('SELECT * FROM pickup_slots WHERE id = ?', [slotId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '取货时间段不存在' });
    }

    const updatedSlotTime = slot_time !== undefined ? slot_time : row.slot_time;
    const updatedDescription = description !== undefined ? description : row.description;
    const updatedActive = is_active !== undefined ? is_active : row.is_active;

    db.run(
      'UPDATE pickup_slots SET slot_time = ?, description = ?, is_active = ? WHERE id = ?',
      [updatedSlotTime, updatedDescription, updatedActive, slotId],
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(400).json({ error: '取货时间段已存在' });
          }
          return res.status(500).json({ error: err.message });
        }
        res.json({
          id: slotId,
          slot_time: updatedSlotTime,
          description: updatedDescription,
          is_active: updatedActive
        });
      }
    );
  });
});

router.delete('/:id', (req, res) => {
  const slotId = req.params.id;

  db.get('SELECT * FROM pickup_slots WHERE id = ?', [slotId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '取货时间段不存在' });
    }

    db.run('DELETE FROM pickup_slots WHERE id = ?', [slotId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: '取货时间段已删除', id: slotId });
    });
  });
});

module.exports = router;
