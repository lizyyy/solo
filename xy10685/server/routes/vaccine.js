const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { 
  generateId, 
  hashRequest, 
  checkIdempotency, 
  saveIdempotency,
  recordHistory,
  errorResponse,
  successResponse
} = require('../utils');

router.get('/', (req, res) => {
  db.all('SELECT * FROM vaccines ORDER BY created_at DESC', (err, rows) => {
    if (err) return errorResponse(res, err.message);
    successResponse(res, rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM vaccines WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return errorResponse(res, err.message);
    if (!row) return errorResponse(res, '疫苗不存在', 404);
    successResponse(res, row);
  });
});

router.post('/', async (req, res) => {
  const { batch_number, name, manufacturer, production_date, expiry_date, total_count, freezer_id, operator } = req.body;
  
  const requestHash = hashRequest(req.body);
  const cached = await checkIdempotency(requestHash);
  if (cached) {
    return successResponse(res, cached, '请求已处理（幂等）');
  }

  if (!batch_number || !name) {
    return errorResponse(res, '批号和疫苗名称不能为空');
  }

  const id = generateId();
  const available_count = total_count || 0;

  db.run(`INSERT INTO vaccines 
    (id, batch_number, name, manufacturer, production_date, expiry_date, total_count, available_count, freezer_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, batch_number, name, manufacturer, production_date, expiry_date, total_count, available_count, freezer_id],
    async (err) => {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return errorResponse(res, '该疫苗批号已存在');
        }
        return errorResponse(res, err.message);
      }

      await recordHistory('vaccine_create', id, 'all', '', JSON.stringify(req.body), operator || 'system');

      const result = { id, ...req.body, available_count };
      await saveIdempotency(requestHash, result);
      successResponse(res, result, '疫苗添加成功');
    }
  );
});

router.put('/:id', (req, res) => {
  const { batch_number, name, manufacturer, production_date, expiry_date, total_count, freezer_id, status, operator } = req.body;
  const id = req.params.id;

  db.get('SELECT * FROM vaccines WHERE id = ?', [id], async (err, oldData) => {
    if (err) return errorResponse(res, err.message);
    if (!oldData) return errorResponse(res, '疫苗不存在', 404);

    const updates = [];
    const values = [];

    const fields = { batch_number, name, manufacturer, production_date, expiry_date, total_count, freezer_id, status };
    
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
        
        if (oldData[key] !== value) {
          await recordHistory('vaccine_update', id, key, oldData[key], value, operator || 'system');
        }
      }
    }

    if (updates.length === 0) {
      return successResponse(res, oldData, '无更新');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.run(`UPDATE vaccines SET ${updates.join(', ')} WHERE id = ?`, values, (err) => {
      if (err) return errorResponse(res, err.message);
      db.get('SELECT * FROM vaccines WHERE id = ?', [id], (err, newData) => {
        if (err) return errorResponse(res, err.message);
        successResponse(res, newData, '疫苗更新成功');
      });
    });
  });
});

module.exports = router;
