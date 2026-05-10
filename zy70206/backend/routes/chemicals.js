const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, STATUSES } = require('../models/database');
const { validateRequiredFields, checkDuplicateBatch } = require('../middleware/validation');

const router = express.Router();

router.get('/', (req, res) => {
  db.all(`
    SELECT c.*, 
           COUNT(DISTINCT b.id) as batch_count,
           SUM(b.available_quantity) as total_available
    FROM chemicals c
    LEFT JOIN chemical_batches b ON c.id = b.chemical_id
    GROUP BY c.id
    ORDER BY c.name
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM chemicals WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '化学品不存在' });
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name, cas_no, category, unit } = req.body;
  const errors = validateRequiredFields({ name, unit }, ['name', 'unit']);
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: '必填字段缺失', 
      details: errors,
      suggestion: '请填写化学品名称和计量单位'
    });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.run(
    'INSERT INTO chemicals (id, name, cas_no, category, unit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, name, cas_no, category, unit, now, now],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json({ 
            error: '数据重复', 
            type: 'DUPLICATE',
            suggestion: '该化学品已存在，请检查台账后再添加'
          });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ id, message: '化学品已添加到台账' });
    }
  );
});

router.get('/:id/batches', (req, res) => {
  db.all(`
    SELECT b.*, c.name as chemical_name, c.unit
    FROM chemical_batches b
    JOIN chemicals c ON b.chemical_id = c.id
    WHERE b.chemical_id = ?
    ORDER BY b.created_at DESC
  `, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/:id/batches', async (req, res) => {
  const { batch_no, manufacturer, production_date, expiry_date, initial_quantity, location } = req.body;
  const chemicalId = req.params.id;
  
  const errors = validateRequiredFields(
    { batch_no, initial_quantity }, 
    ['batch_no', 'initial_quantity']
  );
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: '必填字段缺失', 
      details: errors,
      suggestion: '批号和初始数量为必填项'
    });
  }

  try {
    const isDuplicate = await checkDuplicateBatch(chemicalId, batch_no);
    if (isDuplicate) {
      return res.status(409).json({ 
        error: '批号重复', 
        type: 'DUPLICATE_BATCH',
        suggestion: '该化学品下已存在相同批号，请检查是否重复入库'
      });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.run(
    `INSERT INTO chemical_batches 
     (id, chemical_id, batch_no, manufacturer, production_date, expiry_date, initial_quantity, available_quantity, location, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, chemicalId, batch_no, manufacturer, production_date, expiry_date, initial_quantity, initial_quantity, location, now, now],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, message: '批号库存已入库' });
    }
  );
});

router.get('/batches/all', (req, res) => {
  db.all(`
    SELECT b.*, c.name as chemical_name, c.category, c.unit
    FROM chemical_batches b
    JOIN chemicals c ON b.chemical_id = c.id
    ORDER BY b.created_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.put('/batches/:batchId/correct', (req, res) => {
  const { field, oldValue, newValue, reason } = req.body;
  const batchId = req.params.batchId;
  
  if (!['initial_quantity', 'available_quantity', 'location', 'expiry_date'].includes(field)) {
    return res.status(400).json({ 
      error: '不允许修改的字段',
      suggestion: '仅允许人工修正：数量、位置、有效期'
    });
  }

  db.serialize(() => {
    db.get('SELECT * FROM chemical_batches WHERE id = ?', [batchId], (err, batch) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!batch) return res.status(404).json({ error: '批号不存在' });

      const oldVal = batch[field];
      const now = new Date().toISOString();

      db.run(
        `UPDATE chemical_batches SET ${field} = ?, updated_at = ? WHERE id = ?`,
        [newValue, now, batchId],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          const logId = uuidv4();
          db.run(
            `INSERT INTO audit_logs (id, entity_type, entity_id, action, old_values, new_values, changed_at)
             VALUES (?, 'BATCH', ?, 'MANUAL_CORRECTION', ?, ?, ?)`,
            [logId, batchId, JSON.stringify({ [field]: oldVal }), JSON.stringify({ [field]: newValue, reason }), now],
            () => {
              res.json({ 
                message: '人工修正已记录', 
                correction: { field, oldValue: oldVal, newValue, reason }
              });
            }
          );
        }
      );
    });
  });
});

router.get('/batches/:batchId/audit', (req, res) => {
  db.all(`
    SELECT * FROM audit_logs 
    WHERE entity_type = 'BATCH' AND entity_id = ?
    ORDER BY changed_at DESC
  `, [req.params.batchId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
