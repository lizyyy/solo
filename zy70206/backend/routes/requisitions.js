const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, STATUSES, STATUS_INFO } = require('../models/database');
const { 
  validateRequiredFields, 
  validateQuantity, 
  checkStatusTransition, 
  checkBatchAvailability,
  getNextSteps,
  getStatusWarning
} = require('../middleware/validation');

const router = express.Router();

function getRequisitionDetail(id, callback) {
  db.get(`
    SELECT r.*, 
           c.name as chemical_name, c.cas_no, c.category, c.unit,
           b.batch_no, b.manufacturer, b.available_quantity as batch_available, b.location as batch_location,
           ur.name as requester_name, ua.name as advisor_name
    FROM requisitions r
    JOIN chemicals c ON r.chemical_id = c.id
    JOIN chemical_batches b ON r.batch_id = b.id
    JOIN users ur ON r.requester_id = ur.id
    LEFT JOIN users ua ON r.advisor_id = ua.id
    WHERE r.id = ?
  `, [id], callback);
}

router.get('/', (req, res) => {
  const { status, requester_id } = req.query;
  let query = `
    SELECT r.*, c.name as chemical_name, c.category, c.unit,
           b.batch_no,
           ur.name as requester_name, ua.name as advisor_name
    FROM requisitions r
    JOIN chemicals c ON r.chemical_id = c.id
    JOIN chemical_batches b ON r.batch_id = b.id
    JOIN users ur ON r.requester_id = ur.id
    LEFT JOIN users ua ON r.advisor_id = ua.id
  `;
  const params = [];
  const where = [];
  
  if (status) {
    where.push('r.status = ?');
    params.push(status);
  }
  if (requester_id) {
    where.push('r.requester_id = ?');
    params.push(requester_id);
  }
  if (where.length > 0) query += ' WHERE ' + where.join(' AND ');
  query += ' ORDER BY r.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const enriched = rows.map(row => ({
      ...row,
      status_info: STATUS_INFO[row.status],
      next_steps: getNextSteps(row.status, row),
      warnings: getStatusWarning(row.status, row),
      close_ratio: row.approved_quantity 
        ? Math.round((row.returned_quantity / row.approved_quantity) * 100) 
        : 0
    }));
    
    res.json(enriched);
  });
});

router.get('/:id', (req, res) => {
  getRequisitionDetail(req.params.id, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '领用单不存在' });
    
    db.all(`
      SELECT * FROM status_logs 
      WHERE requisition_id = ? 
      ORDER BY changed_at ASC
    `, [req.params.id], (err, logs) => {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({
        ...row,
        status_info: STATUS_INFO[row.status],
        next_steps: getNextSteps(row.status, row),
        warnings: getStatusWarning(row.status, row),
        close_ratio: row.approved_quantity 
          ? Math.round((row.returned_quantity / row.approved_quantity) * 100) 
          : 0,
        status_history: logs
      });
    });
  });
});

router.post('/', (req, res) => {
  const { requester_id, chemical_id, batch_id, requested_quantity, purpose, lab_location } = req.body;
  
  const errors = validateRequiredFields(
    { requester_id, chemical_id, batch_id, requested_quantity },
    ['requester_id', 'chemical_id', 'batch_id', 'requested_quantity']
  );
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: '必填字段缺失', 
      details: errors,
      suggestion: '请完整填写领用人、化学品、批号和数量'
    });
  }
  
  const qtyCheck = validateQuantity(requested_quantity, 0);
  if (!qtyCheck.valid) {
    return res.status(400).json({ error: qtyCheck.message });
  }
  
  db.serialize(() => {
    db.get('SELECT * FROM chemical_batches WHERE id = ?', [batch_id], (err, batch) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!batch) return res.status(400).json({ error: '批号不存在' });
      if (batch.available_quantity < qtyCheck.value) {
        return res.status(400).json({ 
          error: '库存不足',
          suggestion: `当前批号库存为 ${batch.available_quantity}，请减少领用数量或选择其他批号`
        });
      }
      
      const id = uuidv4();
      const now = new Date().toISOString();
      
      db.run(
        `INSERT INTO requisitions 
         (id, requester_id, chemical_id, batch_id, requested_quantity, status, purpose, lab_location, created_at, updated_at, returned_quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [id, requester_id, chemical_id, batch_id, qtyCheck.value, STATUSES.DRAFT, purpose, lab_location, now, now],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          const logId = uuidv4();
          db.run(
            `INSERT INTO status_logs (id, requisition_id, to_status, comment, changed_at)
             VALUES (?, ?, ?, ?, ?)`,
            [logId, id, STATUSES.DRAFT, '创建领用单草稿', now],
            () => {
              res.json({ 
                id, 
                message: '领用单已创建（草稿状态）',
                next_step: '补充完善信息后可提交审批'
              });
            }
          );
        }
      );
    });
  });
});

function transitionStatus(req, res, requisitionId, newStatus, options = {}) {
  getRequisitionDetail(requisitionId, (err, reqn) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!reqn) return res.status(404).json({ error: '领用单不存在' });
    
    if (!checkStatusTransition(reqn.status, newStatus)) {
      return res.status(400).json({ 
        error: '非法状态转换',
        current: reqn.status,
        attempted: newStatus,
        suggestion: `当前状态"${STATUS_INFO[reqn.status].label}"不允许直接转换到"${STATUS_INFO[newStatus].label}"`
      });
    }
    
    const now = new Date().toISOString();
    const { operator_id, operator_name, comment, approved_quantity, returned_quantity, rejection_reason } = options;
    
    db.serialize(() => {
      let updateQuery = 'UPDATE requisitions SET status = ?, updated_at = ?';
      const updateParams = [newStatus, now];
      
      if (newStatus === STATUSES.APPROVED && approved_quantity !== undefined) {
        updateQuery += ', approved_quantity = ?, approved_at = ?, approved_by = ?';
        updateParams.push(approved_quantity, now, operator_id);
      }
      if (newStatus === STATUSES.REJECTED && rejection_reason) {
        updateQuery += ', rejection_reason = ?';
        updateParams.push(rejection_reason);
      }
      if (returned_quantity !== undefined) {
        const newReturned = (reqn.returned_quantity || 0) + parseFloat(returned_quantity);
        updateQuery += ', returned_quantity = ?';
        updateParams.push(newReturned);
      }
      
      updateQuery += ' WHERE id = ?';
      updateParams.push(requisitionId);
      
      db.run(updateQuery, updateParams, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        if (newStatus === STATUSES.OUTBOUND) {
          const deductQty = reqn.approved_quantity || reqn.requested_quantity;
          db.run(
            'UPDATE chemical_batches SET available_quantity = available_quantity - ? WHERE id = ?',
            [deductQty, reqn.batch_id]
          );
        }
        
        if (newStatus === STATUSES.FULL_RETURN || newStatus === STATUSES.PARTIAL_RETURN) {
          const returnQty = parseFloat(returned_quantity) || 0;
          if (returnQty > 0) {
            db.run(
              'UPDATE chemical_batches SET available_quantity = available_quantity + ? WHERE id = ?',
              [returnQty, reqn.batch_id]
            );
          }
        }
        
        const logId = uuidv4();
        db.run(
          `INSERT INTO status_logs 
           (id, requisition_id, from_status, to_status, operator_id, operator_name, comment, changed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [logId, requisitionId, reqn.status, newStatus, operator_id, operator_name, comment, now],
          () => {
            res.json({
              message: `状态已更新为"${STATUS_INFO[newStatus].label}"`,
              from: reqn.status,
              to: newStatus,
              next_steps: getNextSteps(newStatus)
            });
          }
        );
      });
    });
  });
}

router.post('/:id/submit', (req, res) => {
  const { advisor_id } = req.body;
  
  if (!advisor_id) {
    return res.status(400).json({ 
      error: '未选择审批导师',
      suggestion: '提交审批前必须选择负责导师'
    });
  }
  
  db.run(
    'UPDATE requisitions SET advisor_id = ? WHERE id = ?',
    [advisor_id, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      transitionStatus(req, res, req.params.id, STATUSES.PENDING_APPROVAL, {
        ...req.body,
        comment: '提交导师审批'
      });
    }
  );
});

router.post('/:id/approve', (req, res) => {
  const { approved_quantity, operator_id, operator_name, comment } = req.body;
  
  if (approved_quantity === undefined || approved_quantity === null) {
    return res.status(400).json({ 
      error: '必须指定审批数量',
      suggestion: '审批时需确认同意领用的具体数量'
    });
  }
  
  getRequisitionDetail(req.params.id, (err, reqn) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (parseFloat(approved_quantity) > reqn.requested_quantity) {
      return res.status(400).json({ 
        error: '审批数量不能超过申请数量',
        requested: reqn.requested_quantity,
        approved: approved_quantity
      });
    }
    
    transitionStatus(req, res, req.params.id, STATUSES.APPROVED, {
      operator_id, operator_name, comment,
      approved_quantity: parseFloat(approved_quantity)
    });
  });
});

router.post('/:id/reject', (req, res) => {
  const { operator_id, operator_name, rejection_reason } = req.body;
  
  if (!rejection_reason) {
    return res.status(400).json({ 
      error: '必须填写拒绝原因',
      suggestion: '拒绝审批时需说明原因，便于申请人修改'
    });
  }
  
  transitionStatus(req, res, req.params.id, STATUSES.REJECTED, {
    operator_id, operator_name, rejection_reason,
    comment: `拒绝原因：${rejection_reason}`
  });
});

router.post('/:id/outbound', (req, res) => {
  transitionStatus(req, res, req.params.id, STATUSES.OUTBOUND, {
    ...req.body,
    comment: '办理出库'
  });
});

router.post('/:id/return', (req, res) => {
  const { returned_quantity, operator_id, operator_name } = req.body;
  
  const qtyCheck = validateQuantity(returned_quantity, 0);
  if (!qtyCheck.valid) {
    return res.status(400).json({ error: qtyCheck.message });
  }
  
  getRequisitionDetail(req.params.id, (err, reqn) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const approved = reqn.approved_quantity || reqn.requested_quantity;
    const currentReturned = reqn.returned_quantity || 0;
    const totalAfter = currentReturned + qtyCheck.value;
    
    if (totalAfter > approved) {
      return res.status(400).json({ 
        error: '回收量超过出库量',
        approved: approved,
        already_returned: currentReturned,
        attempting_to_return: qtyCheck.value,
        suggestion: `最多还可回收 ${approved - currentReturned}`
      });
    }
    
    const newStatus = totalAfter >= approved ? STATUSES.FULL_RETURN : STATUSES.PARTIAL_RETURN;
    
    transitionStatus(req, res, req.params.id, newStatus, {
      operator_id, operator_name,
      returned_quantity: qtyCheck.value,
      comment: `登记回收 ${qtyCheck.value} ${reqn.unit}`
    });
  });
});

router.post('/:id/close', (req, res) => {
  getRequisitionDetail(req.params.id, (err, reqn) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const approved = reqn.approved_quantity || reqn.requested_quantity;
    if ((reqn.returned_quantity || 0) < approved) {
      return res.status(400).json({ 
        error: '回收未闭环，无法关闭',
        approved: approved,
        returned: reqn.returned_quantity || 0,
        suggestion: '必须回收全部危化品后方可关闭申请'
      });
    }
    
    transitionStatus(req, res, req.params.id, STATUSES.CLOSED, {
      ...req.body,
      comment: '确认闭环，申请关闭'
    });
  });
});

router.put('/:id/correct', (req, res) => {
  const { field, oldValue, newValue, reason, operator_id, operator_name } = req.body;
  
  db.get('SELECT * FROM requisitions WHERE id = ?', [req.params.id], (err, reqn) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!reqn) return res.status(404).json({ error: '领用单不存在' });
    
    if (STATUS_INFO[reqn.status]?.canEdit === false && field !== 'returned_quantity') {
      return res.status(400).json({ 
        error: '当前状态不允许修改',
        status: reqn.status,
        suggestion: '只有草稿和拒绝状态允许修改内容'
      });
    }
    
    if (!['purpose', 'lab_location', 'requested_quantity', 'returned_quantity'].includes(field)) {
      return res.status(400).json({ 
        error: '不允许修改的字段',
        suggestion: '仅允许人工修正：用途、实验室位置、数量'
      });
    }
    
    const now = new Date().toISOString();
    const oldVal = reqn[field];
    
    db.run(
      `UPDATE requisitions SET ${field} = ?, updated_at = ? WHERE id = ?`,
      [newValue, now, req.params.id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const logId = uuidv4();
        db.run(
          `INSERT INTO audit_logs 
           (id, entity_type, entity_id, action, old_values, new_values, operator_id, operator_name, changed_at)
           VALUES (?, 'REQUISITION', ?, 'MANUAL_CORRECTION', ?, ?, ?, ?, ?)`,
          [logId, req.params.id, JSON.stringify({ [field]: oldVal }), JSON.stringify({ [field]: newValue, reason }), operator_id, operator_name, now],
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

router.get('/:id/audit', (req, res) => {
  db.all(`
    SELECT * FROM audit_logs 
    WHERE entity_type = 'REQUISITION' AND entity_id = ?
    ORDER BY changed_at DESC
  `, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
