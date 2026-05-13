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
  db.all('SELECT * FROM appointments ORDER BY created_at DESC', (err, rows) => {
    if (err) return errorResponse(res, err.message);
    successResponse(res, rows);
  });
});

router.post('/', async (req, res) => {
  const { vaccine_id, batch_number, patient_name, patient_id, appointment_date, quantity, operator } = req.body;
  
  const requestHash = hashRequest(req.body);
  const cached = await checkIdempotency(requestHash);
  if (cached) {
    return successResponse(res, cached, '请求已处理（幂等）');
  }

  if (!vaccine_id || !patient_name || !patient_id || !appointment_date) {
    return errorResponse(res, '疫苗ID、患者信息和预约时间不能为空');
  }

  db.get('SELECT available_count FROM vaccines WHERE id = ?', [vaccine_id], async (err, vaccine) => {
    if (err) return errorResponse(res, err.message);
    if (!vaccine) return errorResponse(res, '疫苗不存在');
    if (vaccine.available_count < (quantity || 1)) {
      return errorResponse(res, '疫苗库存不足');
    }

    const id = generateId();
    const status = 'pending';

    db.run(`INSERT INTO appointments 
      (id, vaccine_id, batch_number, patient_name, patient_id, appointment_date, quantity, status, operator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, vaccine_id, batch_number, patient_name, patient_id, appointment_date, quantity || 1, status, operator || 'system'],
      async (err) => {
        if (err) return errorResponse(res, err.message);

        await recordHistory('appointment_create', id, 'all', '', JSON.stringify(req.body), operator || 'system');

        const result = { id, ...req.body, status };
        await saveIdempotency(requestHash, result);
        successResponse(res, result, '预约成功');
      }
    );
  });
});

router.put('/:id/status', (req, res) => {
  const { status, operator } = req.body;
  const id = req.params.id;

  if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
    return errorResponse(res, '无效的状态值');
  }

  db.get('SELECT * FROM appointments WHERE id = ?', [id], async (err, oldData) => {
    if (err) return errorResponse(res, err.message);
    if (!oldData) return errorResponse(res, '预约记录不存在', 404);

    db.run(`UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id],
      async (err) => {
        if (err) return errorResponse(res, err.message);
        await recordHistory('appointment_status', id, 'status', oldData.status, status, operator || 'system');
        db.get('SELECT * FROM appointments WHERE id = ?', [id], (err, newData) => {
          if (err) return errorResponse(res, err.message);
          successResponse(res, newData, '状态更新成功');
        });
      }
    );
  });
});

module.exports = router;
