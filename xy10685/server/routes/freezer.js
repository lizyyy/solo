const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { 
  generateId, 
  recordHistory,
  validateTemperature,
  errorResponse,
  successResponse
} = require('../utils');

router.get('/', (req, res) => {
  db.all('SELECT * FROM freezers ORDER BY created_at DESC', (err, rows) => {
    if (err) return errorResponse(res, err.message);
    successResponse(res, rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM freezers WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return errorResponse(res, err.message);
    if (!row) return errorResponse(res, '冷柜不存在', 404);
    successResponse(res, row);
  });
});

router.post('/', (req, res) => {
  const { name, location, current_temperature, min_temperature, max_temperature, operator } = req.body;

  if (!name) {
    return errorResponse(res, '冷柜名称不能为空');
  }

  const tempValidation = validateTemperature(
    current_temperature, 
    min_temperature || -25, 
    max_temperature || -15
  );
  if (!tempValidation.valid) {
    return errorResponse(res, tempValidation.message);
  }

  const id = generateId();
  const status = 'normal';

  db.run(`INSERT INTO freezers 
    (id, name, location, current_temperature, min_temperature, max_temperature, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, location, current_temperature, min_temperature || -25, max_temperature || -15, status],
    async (err) => {
      if (err) return errorResponse(res, err.message);
      await recordHistory('freezer_create', id, 'all', '', JSON.stringify(req.body), operator || 'system');
      db.get('SELECT * FROM freezers WHERE id = ?', [id], (err, row) => {
        if (err) return errorResponse(res, err.message);
        successResponse(res, row, '冷柜添加成功');
      });
    }
  );
});

router.put('/:id/temperature', (req, res) => {
  const { current_temperature, operator } = req.body;
  const id = req.params.id;

  db.get('SELECT * FROM freezers WHERE id = ?', [id], async (err, oldData) => {
    if (err) return errorResponse(res, err.message);
    if (!oldData) return errorResponse(res, '冷柜不存在', 404);

    const tempValidation = validateTemperature(current_temperature, oldData.min_temperature, oldData.max_temperature);
    if (!tempValidation.valid) {
      return errorResponse(res, tempValidation.message);
    }

    const oldStatus = oldData.status;
    const newStatus = 'normal';

    db.run(`UPDATE freezers SET current_temperature = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [current_temperature, newStatus, id],
      async (err) => {
        if (err) return errorResponse(res, err.message);
        await recordHistory('freezer_temp_update', id, 'current_temperature', oldData.current_temperature, current_temperature, operator || 'system');
        if (oldStatus !== newStatus) {
          await recordHistory('freezer_status_update', id, 'status', oldStatus, newStatus, operator || 'system');
        }
        db.get('SELECT * FROM freezers WHERE id = ?', [id], (err, newData) => {
          if (err) return errorResponse(res, err.message);
          successResponse(res, newData, '温度更新成功');
        });
      }
    );
  });
});

module.exports = router;
