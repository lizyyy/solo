const express = require('express');
const router = express.Router();
const db = require('../database');
const { generateId, responseSuccess, responseError, recordHistory, getHistory, validateRequiredFields } = require('../utils');

router.post('/', (req, res) => {
  const { patient_name, patient_id, medicines, operator = 'system' } = req.body;
  
  const missing = validateRequiredFields(req.body, ['patient_name', 'patient_id', 'medicines']);
  if (missing.length > 0) {
    return res.status(400).json(responseError('缺少必填字段', 400, { missing_fields: missing }));
  }

  const id = generateId();
  const medicinesJson = typeof medicines === 'string' ? medicines : JSON.stringify(medicines);
  const status = 'pending';

  db.run(
    `INSERT INTO prescriptions (id, patient_name, patient_id, medicines, status)
     VALUES (?, ?, ?, ?, ?)`,
    [id, patient_name, patient_id, medicinesJson, status],
    async (err) => {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json(responseError('处方已存在', 409));
        }
        return res.status(500).json(responseError(err.message, 500));
      }

      await recordHistory('prescription', id, 'create', null, {
        id, patient_name, patient_id, medicines, status
      }, operator);

      res.status(201).json(responseSuccess({ id, patient_name, patient_id, medicines, status }, '处方创建成功'));
    }
  );
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT * FROM prescriptions WHERE id = ? AND is_deleted = 0`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!row) return res.status(404).json(responseError('处方不存在', 404));
      
      res.json(responseSuccess({
        ...row,
        medicines: row.medicines ? JSON.parse(row.medicines) : null
      }));
    }
  );
});

router.get('/', (req, res) => {
  db.all(
    `SELECT * FROM prescriptions WHERE is_deleted = 0 ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      res.json(responseSuccess(rows.map(row => ({
        ...row,
        medicines: row.medicines ? JSON.parse(row.medicines) : null
      }))));
    }
  );
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { patient_name, patient_id, medicines, status, operator = 'system' } = req.body;

  db.get(
    `SELECT * FROM prescriptions WHERE id = ? AND is_deleted = 0`,
    [id],
    async (err, oldRow) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!oldRow) return res.status(404).json(responseError('处方不存在', 404));

      const beforeData = {
        ...oldRow,
        medicines: oldRow.medicines ? JSON.parse(oldRow.medicines) : null
      };

      const newPatientName = patient_name || oldRow.patient_name;
      const newPatientId = patient_id || oldRow.patient_id;
      const newMedicines = medicines ? (typeof medicines === 'string' ? medicines : JSON.stringify(medicines)) : oldRow.medicines;
      const newStatus = status || oldRow.status;

      db.run(
        `UPDATE prescriptions SET patient_name = ?, patient_id = ?, medicines = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newPatientName, newPatientId, newMedicines, newStatus, id],
        async (err) => {
          if (err) return res.status(500).json(responseError(err.message, 500));

          const afterData = {
            id,
            patient_name: newPatientName,
            patient_id: newPatientId,
            medicines: newMedicines ? JSON.parse(newMedicines) : null,
            status: newStatus
          };

          await recordHistory('prescription', id, 'update', beforeData, afterData, operator);

          res.json(responseSuccess(afterData, '处方更新成功'));
        }
      );
    }
  );
});

router.post('/:id/withdraw', (req, res) => {
  const { id } = req.params;
  const { operator = 'system', reason } = req.body;

  db.get(
    `SELECT * FROM prescriptions WHERE id = ? AND is_deleted = 0`,
    [id],
    async (err, oldRow) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!oldRow) return res.status(404).json(responseError('处方不存在', 404));

      const beforeData = {
        ...oldRow,
        medicines: oldRow.medicines ? JSON.parse(oldRow.medicines) : null
      };

      db.run(
        `UPDATE prescriptions SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id],
        async (err) => {
          if (err) return res.status(500).json(responseError(err.message, 500));

          const afterData = {
            ...beforeData,
            status: 'withdrawn',
            withdraw_reason: reason
          };

          await recordHistory('prescription', id, 'withdraw', beforeData, afterData, operator);

          res.json(responseSuccess(afterData, '处方已撤回'));
        }
      );
    }
  );
});

router.post('/:id/supplement', (req, res) => {
  const { id } = req.params;
  const { medicines, operator = 'system' } = req.body;

  if (!medicines) {
    return res.status(400).json(responseError('缺少补录内容', 400));
  }

  db.get(
    `SELECT * FROM prescriptions WHERE id = ? AND is_deleted = 0`,
    [id],
    async (err, oldRow) => {
      if (err) return res.status(500).json(responseError(err.message, 500));
      if (!oldRow) return res.status(404).json(responseError('处方不存在', 404));

      const beforeData = {
        ...oldRow,
        medicines: oldRow.medicines ? JSON.parse(oldRow.medicines) : null
      };

      const newMedicines = typeof medicines === 'string' ? medicines : JSON.stringify(medicines);

      db.run(
        `UPDATE prescriptions SET medicines = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newMedicines, id],
        async (err) => {
          if (err) return res.status(500).json(responseError(err.message, 500));

          const afterData = {
            ...beforeData,
            medicines: JSON.parse(newMedicines)
          };

          await recordHistory('prescription', id, 'supplement', beforeData, afterData, operator);

          res.json(responseSuccess(afterData, '处方补录成功'));
        }
      );
    }
  );
});

router.get('/:id/history', async (req, res) => {
  const { id } = req.params;
  
  try {
    const history = await getHistory('prescription', id);
    res.json(responseSuccess(history));
  } catch (err) {
    res.status(500).json(responseError(err.message, 500));
  }
});

module.exports = router;
