const express = require('express');
const router = express.Router();
const db = require('../database');
const { generateId, responseSuccess, responseError, recordHistory, getHistory, validateRequiredFields } = require('../utils');

const BATCH_STATUS = ['created', 'cooking', 'completed', 'cancelled'];

router.post('/', (req, res) => {
  const { batch_code, prescription_id, operator = 'system' } = req.body;
  
  const missing = validateRequiredFields(req.body, ['batch_code', 'prescription_id']);
  if (missing.length > 0) {
    return res.status(400).json(responseError('缺少必填字段', 400, { missing_fields: missing }));
  }

  db.get(
    `SELECT * FROM prescriptions WHERE id = ? AND is_deleted = 0`,
    [prescription_id],
    (err, prescription) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!prescription) return res.status(404).json(responseError('处方不存在', 404));
      if (prescription.status === 'withdrawn') {
        return res.status(400).json(responseError('处方已撤回，无法创建煎煮批次', 400));
      }

      const id = generateId();
      const status = 'created';

      db.run(
        `INSERT INTO batches (id, batch_code, prescription_id, status, operator)
         VALUES (?, ?, ?, ?, ?)`,
        [id, batch_code, prescription_id, status, operator],
        async (err) => {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              return res.status(409).json(responseError('批次编码已存在', 409));
            }
            return res.status(500).json(responseError(err.message, 500));
          }

          const batchData = {
            id, batch_code, prescription_id, status, operator
          };

          await recordHistory('batch', id, 'create', null, batchData, operator);

          res.status(201).json(responseSuccess(batchData, '煎煮批次创建成功'));
        }
      );
    }
  );
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT * FROM batches WHERE id = ? AND is_deleted = 0`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!row) return res.status(404).json(responseError('煎煮批次不存在', 404));
      res.json(responseSuccess(row));
    }
  );
});

router.get('/', (req, res) => {
  db.all(
    `SELECT * FROM batches WHERE is_deleted = 0 ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      res.json(responseSuccess(rows));
    }
  );
});

router.post('/:id/start', (req, res) => {
  const { id } = req.params;
  const { operator = 'system' } = req.body;

  db.get(
    `SELECT * FROM batches WHERE id = ? AND is_deleted = 0`,
    [id],
    async (err, oldRow) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!oldRow) return res.status(404).json(responseError('煎煮批次不存在', 404));
      if (oldRow.status !== 'created') {
        return res.status(400).json(responseError(`非法流转：当前状态(${oldRow.status})无法开始煎煮`, 400, {
          allowed_from: ['created'],
          current_status: oldRow.status
        }));
      }

      const beforeData = { ...oldRow };
      const status = 'cooking';
      const startTime = new Date().toISOString();

      db.run(
        `UPDATE batches SET status = ?, start_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, startTime, id],
        async (err) => {
          if (err) return res.status(500).json(responseError(err.message, 500));

          const afterData = { ...beforeData, status, start_time: startTime };
          await recordHistory('batch', id, 'start', beforeData, afterData, operator);

          res.json(responseSuccess(afterData, '煎煮已开始'));
        }
      );
    }
  );
});

router.post('/:id/complete', (req, res) => {
  const { id } = req.params;
  const { operator = 'system' } = req.body;

  db.get(
    `SELECT * FROM batches WHERE id = ? AND is_deleted = 0`,
    [id],
    async (err, oldRow) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!oldRow) return res.status(404).json(responseError('煎煮批次不存在', 404));
      if (oldRow.status !== 'cooking') {
        return res.status(400).json(responseError(`非法流转：当前状态(${oldRow.status})无法完成煎煮`, 400, {
          allowed_from: ['cooking'],
          current_status: oldRow.status
        }));
      }

      const beforeData = { ...oldRow };
      const status = 'completed';
      const endTime = new Date().toISOString();

      db.run(
        `UPDATE batches SET status = ?, end_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, endTime, id],
        async (err) => {
          if (err) return res.status(500).json(responseError(err.message, 500));

          const afterData = { ...beforeData, status, end_time: endTime };
          await recordHistory('batch', id, 'complete', beforeData, afterData, operator);

          res.json(responseSuccess(afterData, '煎煮已完成'));
        }
      );
    }
  );
});

router.post('/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { operator = 'system', reason } = req.body;

  db.get(
    `SELECT * FROM batches WHERE id = ? AND is_deleted = 0`,
    [id],
    async (err, oldRow) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!oldRow) return res.status(404).json(responseError('煎煮批次不存在', 404));
      if (!['created', 'cooking'].includes(oldRow.status)) {
        return res.status(400).json(responseError(`非法流转：当前状态(${oldRow.status})无法取消`, 400, {
          allowed_from: ['created', 'cooking'],
          current_status: oldRow.status
        }));
      }

      const beforeData = { ...oldRow };
      const status = 'cancelled';

      db.run(
        `UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id],
        async (err) => {
          if (err) return res.status(500).json(responseError(err.message, 500));

          const afterData = { ...beforeData, status, cancel_reason: reason };
          await recordHistory('batch', id, 'cancel', beforeData, afterData, operator);

          res.json(responseSuccess(afterData, '煎煮批次已取消'));
        }
      );
    }
  );
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { operator = 'system', ...updateFields } = req.body;

  db.get(
    `SELECT * FROM batches WHERE id = ? AND is_deleted = 0`,
    [id],
    async (err, oldRow) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!oldRow) return res.status(404).json(responseError('煎煮批次不存在', 404));

      const beforeData = { ...oldRow };
      const newStatus = updateFields.status || oldRow.status;

      if (updateFields.status && !BATCH_STATUS.includes(newStatus)) {
        return res.status(400).json(responseError('无效的状态值', 400, { valid_statuses: BATCH_STATUS }));
      }

      const updates = [];
      const values = [];

      if (updateFields.prescription_id !== undefined) {
        updates.push('prescription_id = ?');
        values.push(updateFields.prescription_id);
      }
      if (updateFields.operator !== undefined) {
        updates.push('operator = ?');
        values.push(updateFields.operator);
      }

      if (updates.length === 0) {
        return res.json(responseSuccess(oldRow, '无更新内容'));
      }

      values.push(id);
      updates.push('updated_at = CURRENT_TIMESTAMP');

      db.run(
        `UPDATE batches SET ${updates.join(', ')} WHERE id = ?`,
        values,
        async (err) => {
          if (err) return res.status(500).json(responseError(err.message, 500));

          const afterData = { ...oldRow };
          if (updateFields.prescription_id !== undefined) afterData.prescription_id = updateFields.prescription_id;
          if (updateFields.operator !== undefined) afterData.operator = updateFields.operator;

          await recordHistory('batch', id, 'correct', beforeData, afterData, operator);

          res.json(responseSuccess(afterData, '人工修正成功'));
        }
      );
    }
  );
});

router.get('/:id/history', async (req, res) => {
  const { id } = req.params;
  
  try {
    const history = await getHistory('batch', id);
    res.json(responseSuccess(history));
  } catch (err) {
    res.status(500).json(responseError(err.message, 500));
  }
});

module.exports = router;
