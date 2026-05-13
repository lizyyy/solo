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
  db.all('SELECT * FROM inventory_records ORDER BY created_at DESC', (err, rows) => {
    if (err) return errorResponse(res, err.message);
    successResponse(res, rows);
  });
});

router.post('/', (req, res) => {
  const { freezer_id, batch_number, expected_count, actual_count, operator, remarks } = req.body;

  if (!freezer_id || !batch_number || expected_count === undefined || actual_count === undefined) {
    return errorResponse(res, '冷柜ID、批号、预期数量和实际数量不能为空');
  }

  const id = generateId();
  const difference = actual_count - expected_count;
  const status = difference === 0 ? 'matched' : 'pending';

  db.run(`INSERT INTO inventory_records 
    (id, freezer_id, batch_number, expected_count, actual_count, difference, status, operator, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, freezer_id, batch_number, expected_count, actual_count, difference, status, operator || 'system', remarks],
    async (err) => {
      if (err) return errorResponse(res, err.message);
      await recordHistory('inventory_create', id, 'all', '', JSON.stringify(req.body), operator || 'system');
      db.get('SELECT * FROM inventory_records WHERE id = ?', [id], (err, row) => {
        if (err) return errorResponse(res, err.message);
        successResponse(res, row, '盘点记录创建成功');
      });
    }
  );
});

router.put('/:id/review', (req, res) => {
  const { status, reviewer, remarks } = req.body;
  const id = req.params.id;

  if (!['matched', 'discrepancy', 'resolved'].includes(status)) {
    return errorResponse(res, '无效的状态值');
  }

  db.get('SELECT * FROM inventory_records WHERE id = ?', [id], async (err, oldData) => {
    if (err) return errorResponse(res, err.message);
    if (!oldData) return errorResponse(res, '盘点记录不存在', 404);

    db.run(`UPDATE inventory_records SET status = ?, reviewer = ?, review_time = CURRENT_TIMESTAMP, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, reviewer, remarks, id],
      async (err) => {
        if (err) return errorResponse(res, err.message);
        await recordHistory('inventory_review', id, 'status', oldData.status, status, reviewer || 'system');
        db.get('SELECT * FROM inventory_records WHERE id = ?', [id], (err, newData) => {
          if (err) return errorResponse(res, err.message);
          successResponse(res, newData, '复核完成');
        });
      }
    );
  });
});

module.exports = router;
