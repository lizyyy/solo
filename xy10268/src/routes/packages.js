const express = require('express');
const router = express.Router();
const db = require('../database');
const { generateId, responseSuccess, responseError, recordHistory, getHistory, validateRequiredFields } = require('../utils');

const PACKAGE_STATUS = ['created', 'bound', 'verified', 'error', 'isolated'];

router.post('/', (req, res) => {
  const { package_code, operator = 'system' } = req.body;
  
  const missing = validateRequiredFields(req.body, ['package_code']);
  if (missing.length > 0) {
    return res.status(400).json(responseError('缺少必填字段', 400, { missing_fields: missing }));
  }

  const id = generateId();
  const status = 'created';

  db.run(
    `INSERT INTO packages (id, package_code, status) VALUES (?, ?, ?)`,
    [id, package_code, status],
    async (err) => {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json(responseError('包裹编码已存在（重复提交）', 409));
        }
        return res.status(500).json(responseError(err.message, 500));
      }

      const packageData = { id, package_code, status };
      await recordHistory('package', id, 'create', null, packageData, operator);

      res.status(201).json(responseSuccess(packageData, '包裹创建成功'));
    }
  );
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT * FROM packages WHERE id = ? AND is_deleted = 0`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!row) return res.status(404).json(responseError('包裹不存在', 404));
      res.json(responseSuccess(row));
    }
  );
});

router.get('/', (req, res) => {
  db.all(
    `SELECT * FROM packages WHERE is_deleted = 0 ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      res.json(responseSuccess(rows));
    }
  );
});

router.post('/:id/bind', (req, res) => {
  const { id } = req.params;
  const { batch_id, operator = 'system' } = req.body;

  const missing = validateRequiredFields(req.body, ['batch_id']);
  if (missing.length > 0) {
    return res.status(400).json(responseError('缺少必填字段', 400, { missing_fields: missing }));
  }

  db.get(
    `SELECT * FROM packages WHERE id = ? AND is_deleted = 0`,
    [id],
    (err, packageRow) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!packageRow) return res.status(404).json(responseError('包裹不存在', 404));

      if (packageRow.status !== 'created') {
        return res.status(400).json(responseError(`非法流转：当前状态(${packageRow.status})无法绑定`, 400, {
          allowed_from: ['created'],
          current_status: packageRow.status
        }));
      }

      if (packageRow.batch_id) {
        return res.status(409).json(responseError('包裹已绑定批次，重复绑定', 409));
      }

      db.get(
        `SELECT * FROM batches WHERE id = ? AND is_deleted = 0`,
        [batch_id],
        (err, batchRow) => {
          if (err) return res.status(500).json(responseError(err.message, 500));
          if (!batchRow) return res.status(404).json(responseError('煎煮批次不存在', 404));

          if (batchRow.status !== 'completed') {
            return res.status(400).json(responseError('煎煮未完成，无法绑定包裹', 400, {
              batch_status: batchRow.status
            }));
          }

          const beforeData = { ...packageRow };
          const status = 'bound';

          db.run(
            `UPDATE packages SET batch_id = ?, prescription_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [batch_id, batchRow.prescription_id, status, id],
            async (err) => {
              if (err) return res.status(500).json(responseError(err.message, 500));

              const afterData = {
                ...beforeData,
                batch_id,
                prescription_id: batchRow.prescription_id,
                status
              };

              await recordHistory('package', id, 'bind', beforeData, afterData, operator);

              res.json(responseSuccess(afterData, '包裹绑定成功'));
            }
          );
        }
      );
    }
  );
});

router.post('/:id/verify', (req, res) => {
  const { id } = req.params;
  const { prescription_id, operator = 'system' } = req.body;

  const missing = validateRequiredFields(req.body, ['prescription_id']);
  if (missing.length > 0) {
    return res.status(400).json(responseError('缺少必填字段', 400, { missing_fields: missing }));
  }

  db.get(
    `SELECT * FROM packages WHERE id = ? AND is_deleted = 0`,
    [id],
    (err, packageRow) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!packageRow) return res.status(404).json(responseError('包裹不存在', 404));

      if (!['bound', 'error'].includes(packageRow.status)) {
        return res.status(400).json(responseError(`非法流转：当前状态(${packageRow.status})无法核验`, 400, {
          allowed_from: ['bound', 'error'],
          current_status: packageRow.status
        }));
      }

      if (!packageRow.batch_id || !packageRow.prescription_id) {
        return res.status(400).json(responseError('包裹未绑定批次，请先绑定', 400));
      }

      const beforeData = { ...packageRow };
      const verifyTime = new Date().toISOString();

      if (packageRow.prescription_id === prescription_id) {
        const status = 'verified';

        db.run(
          `UPDATE packages SET status = ?, verifier = ?, verify_time = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [status, operator, verifyTime, id],
          async (err) => {
            if (err) return res.status(500).json(responseError(err.message, 500));

            const afterData = {
              ...beforeData,
              status,
              verifier: operator,
              verify_time: verifyTime
            };

            await recordHistory('package', id, 'verify_success', beforeData, afterData, operator);

            res.json(responseSuccess({
              ...afterData,
              verify_result: 'match',
              message: '核验通过：处方匹配'
            }, '核验通过'));
          }
        );
      } else {
        const status = 'error';

        db.run(
          `UPDATE packages SET status = ?, verifier = ?, verify_time = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [status, operator, verifyTime, id],
          async (err) => {
            if (err) return res.status(500).json(responseError(err.message, 500));

            const afterData = {
              ...beforeData,
              status,
              verifier: operator,
              verify_time: verifyTime
            };

            await recordHistory('package', id, 'verify_error', beforeData, afterData, operator);

            res.status(200).json(responseSuccess({
              ...afterData,
              verify_result: 'mismatch',
              expected_prescription_id: packageRow.prescription_id,
              scanned_prescription_id: prescription_id,
              message: '核验不通过：处方不匹配，疑似错包'
            }, '核验不通过'));
          }
        );
      }
    }
  );
});

router.post('/:id/isolate', (req, res) => {
  const { id } = req.params;
  const { operator = 'system', reason } = req.body;

  db.get(
    `SELECT * FROM packages WHERE id = ? AND is_deleted = 0`,
    [id],
    async (err, oldRow) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!oldRow) return res.status(404).json(responseError('包裹不存在', 404));

      if (oldRow.status !== 'error') {
        return res.status(400).json(responseError(`非法流转：当前状态(${oldRow.status})无法隔离，只有核验错误的包裹才能隔离`, 400, {
          allowed_from: ['error'],
          current_status: oldRow.status
        }));
      }

      const beforeData = { ...oldRow };
      const status = 'isolated';

      db.run(
        `UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id],
        async (err) => {
          if (err) return res.status(500).json(responseError(err.message, 500));

          const afterData = { ...beforeData, status, isolate_reason: reason };
          await recordHistory('package', id, 'isolate', beforeData, afterData, operator);

          res.json(responseSuccess(afterData, '包裹已隔离'));
        }
      );
    }
  );
});

router.post('/:id/rebind', (req, res) => {
  const { id } = req.params;
  const { batch_id, operator = 'system' } = req.body;

  if (!batch_id) {
    return res.status(400).json(responseError('缺少必填字段: batch_id', 400));
  }

  db.get(
    `SELECT * FROM packages WHERE id = ? AND is_deleted = 0`,
    [id],
    (err, packageRow) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!packageRow) return res.status(404).json(responseError('包裹不存在', 404));

      if (packageRow.status !== 'error') {
        return res.status(400).json(responseError(`非法流转：当前状态(${packageRow.status})无法重新绑定`, 400, {
          allowed_from: ['error'],
          current_status: packageRow.status
        }));
      }

      db.get(
        `SELECT * FROM batches WHERE id = ? AND is_deleted = 0`,
        [batch_id],
        (err, batchRow) => {
          if (err) return res.status(500).json(responseError(err.message, 500));
          if (!batchRow) return res.status(404).json(responseError('煎煮批次不存在', 404));

          if (batchRow.status !== 'completed') {
            return res.status(400).json(responseError('煎煮未完成，无法绑定', 400));
          }

          const beforeData = { ...packageRow };
          const status = 'bound';

          db.run(
            `UPDATE packages SET batch_id = ?, prescription_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [batch_id, batchRow.prescription_id, status, id],
            async (err) => {
              if (err) return res.status(500).json(responseError(err.message, 500));

              const afterData = {
                ...beforeData,
                batch_id,
                prescription_id: batchRow.prescription_id,
                status
              };

              await recordHistory('package', id, 'rebind', beforeData, afterData, operator);

              res.json(responseSuccess(afterData, '包裹重新绑定成功（人工修正）'));
            }
          );
        }
      );
    }
  );
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { operator = 'system', ...updateFields } = req.body;

  db.get(
    `SELECT * FROM packages WHERE id = ? AND is_deleted = 0`,
    [id],
    async (err, oldRow) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!oldRow) return res.status(404).json(responseError('包裹不存在', 404));

      const beforeData = { ...oldRow };
      const newStatus = updateFields.status || oldRow.status;

      if (updateFields.status && !PACKAGE_STATUS.includes(newStatus)) {
        return res.status(400).json(responseError('无效的状态值', 400, { valid_statuses: PACKAGE_STATUS }));
      }

      const updates = [];
      const values = [];

      if (updateFields.batch_id !== undefined) {
        updates.push('batch_id = ?');
        values.push(updateFields.batch_id);
      }
      if (updateFields.prescription_id !== undefined) {
        updates.push('prescription_id = ?');
        values.push(updateFields.prescription_id);
      }

      if (updates.length === 0) {
        return res.json(responseSuccess(oldRow, '无更新内容'));
      }

      values.push(id);
      updates.push('updated_at = CURRENT_TIMESTAMP');

      db.run(
        `UPDATE packages SET ${updates.join(', ')} WHERE id = ?`,
        values,
        async (err) => {
          if (err) return res.status(500).json(responseError(err.message, 500));

          const afterData = { ...oldRow };
          if (updateFields.batch_id !== undefined) afterData.batch_id = updateFields.batch_id;
          if (updateFields.prescription_id !== undefined) afterData.prescription_id = updateFields.prescription_id;

          await recordHistory('package', id, 'correct', beforeData, afterData, operator);

          res.json(responseSuccess(afterData, '人工修正成功'));
        }
      );
    }
  );
});

router.get('/scan/:code', (req, res) => {
  const { code } = req.params;

  db.get(
    `SELECT p.*, 
            b.batch_code, b.status as batch_status,
            pr.patient_name, pr.patient_id, pr.medicines
     FROM packages p
     LEFT JOIN batches b ON p.batch_id = b.id
     LEFT JOIN prescriptions pr ON p.prescription_id = pr.id
     WHERE p.package_code = ? AND p.is_deleted = 0`,
    [code],
    (err, row) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!row) return res.status(404).json(responseError('包裹编码不存在', 404));

      const result = {
        ...row,
        medicines: row.medicines ? JSON.parse(row.medicines) : null
      };

      res.json(responseSuccess(result));
    }
  );
});

router.get('/:id/history', async (req, res) => {
  const { id } = req.params;
  
  try {
    const history = await getHistory('package', id);
    res.json(responseSuccess(history));
  } catch (err) {
    res.status(500).json(responseError(err.message, 500));
  }
});

module.exports = router;
