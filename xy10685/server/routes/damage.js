const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { 
  generateId, 
  recordHistory,
  errorResponse,
  successResponse
} = require('../utils');

router.get('/', (req, res) => {
  db.all('SELECT * FROM damage_reports ORDER BY created_at DESC', (err, rows) => {
    if (err) return errorResponse(res, err.message);
    successResponse(res, rows);
  });
});

router.post('/', (req, res) => {
  const { batch_number, vaccine_name, quantity, reason, reporter } = req.body;

  if (!batch_number || !vaccine_name || !quantity || !reason || !reporter) {
    return errorResponse(res, '批号、疫苗名称、数量、报损原因和上报人不能为空');
  }

  const id = generateId();
  const status = 'pending';

  db.run(`INSERT INTO damage_reports 
    (id, batch_number, vaccine_name, quantity, reason, reporter, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, batch_number, vaccine_name, quantity, reason, reporter, status],
    async (err) => {
      if (err) return errorResponse(res, err.message);
      await recordHistory('damage_create', id, 'all', '', JSON.stringify(req.body), reporter);
      db.get('SELECT * FROM damage_reports WHERE id = ?', [id], (err, row) => {
        if (err) return errorResponse(res, err.message);
        successResponse(res, row, '报损申请提交成功');
      });
    }
  );
});

router.put('/:id/approve', (req, res) => {
  const { status, approver, approval_remarks } = req.body;
  const id = req.params.id;

  if (!['approved', 'rejected'].includes(status)) {
    return errorResponse(res, '无效的审批状态');
  }
  if (!approver) {
    return errorResponse(res, '审批人不能为空');
  }

  db.get('SELECT * FROM damage_reports WHERE id = ?', [id], async (err, oldData) => {
    if (err) return errorResponse(res, err.message);
    if (!oldData) return errorResponse(res, '报损记录不存在', 404);

    db.run(`UPDATE damage_reports SET status = ?, approver = ?, approval_time = CURRENT_TIMESTAMP, approval_remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, approver, approval_remarks, id],
      async (err) => {
        if (err) return errorResponse(res, err.message);
        await recordHistory('damage_approve', id, 'status', oldData.status, status, approver);
        db.get('SELECT * FROM damage_reports WHERE id = ?', [id], (err, newData) => {
          if (err) return errorResponse(res, err.message);
          successResponse(res, newData, '审批完成');
        });
      }
    );
  });
});

module.exports = router;
