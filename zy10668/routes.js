const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');
const db = require('./database');
const { 
  REWORK_STATUSES, 
  STATUS_LABELS,
  OPERATION_TYPES,
  generateReworkNo,
  generateBatchNo,
  updateReworkStatus,
  validateStatusTransition
} = require('./utils');

router.get('/work-orders', (req, res) => {
  const sql = `SELECT * FROM work_orders ORDER BY created_at DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

router.post('/work-orders', (req, res) => {
  const { work_order_no, product_name, quantity, status = 'pending' } = req.body;
  const id = uuidv4();
  const sql = `INSERT INTO work_orders (id, work_order_no, product_name, quantity, status) 
               VALUES (?, ?, ?, ?, ?)`;
  
  db.run(sql, [id, work_order_no, product_name, quantity, status], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, work_order_no, product_name, quantity, status });
  });
});

router.get('/processes', (req, res) => {
  const sql = `SELECT * FROM processes ORDER BY sequence`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

router.post('/processes', (req, res) => {
  const { process_code, process_name, sequence } = req.body;
  const id = uuidv4();
  const sql = `INSERT INTO processes (id, process_code, process_name, sequence) 
               VALUES (?, ?, ?, ?)`;
  
  db.run(sql, [id, process_code, process_name, sequence], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, process_code, process_name, sequence });
  });
});

router.get('/rework-reasons', (req, res) => {
  const sql = `SELECT * FROM rework_reasons ORDER BY created_at DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

router.post('/rework-reasons', (req, res) => {
  const { reason_code, reason_name, description } = req.body;
  const id = uuidv4();
  const sql = `INSERT INTO rework_reasons (id, reason_code, reason_name, description) 
               VALUES (?, ?, ?, ?)`;
  
  db.run(sql, [id, reason_code, reason_name, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, reason_code, reason_name, description });
  });
});

router.get('/responsibility-teams', (req, res) => {
  const sql = `SELECT * FROM responsibility_teams ORDER BY created_at DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

router.post('/responsibility-teams', (req, res) => {
  const { team_code, team_name, leader } = req.body;
  const id = uuidv4();
  const sql = `INSERT INTO responsibility_teams (id, team_code, team_name, leader) 
               VALUES (?, ?, ?, ?)`;
  
  db.run(sql, [id, team_code, team_name, leader], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, team_code, team_name, leader });
  });
});

router.get('/rework-tasks', (req, res) => {
  const { status, work_order_no, page = 1, page_size = 20 } = req.query;
  const offset = (page - 1) * page_size;
  
  let whereClauses = [];
  let params = [];
  
  if (status) {
    whereClauses.push('rt.status = ?');
    params.push(status);
  }
  
  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  
  const sql = `
    SELECT 
      rt.id,
      rt.rework_no,
      rt.work_order_id,
      wo.work_order_no,
      wo.product_name,
      rt.process_id,
      p.process_code,
      p.process_name,
      rt.rework_reason_id,
      rr.reason_name,
      rt.responsibility_team_id,
      rtm.team_name,
      rt.quantity,
      rt.status,
      rt.remark,
      rt.manual_remark,
      rt.is_manual_override,
      rt.created_by,
      rt.reviewed_by,
      rt.created_at,
      rt.updated_at
    FROM rework_tasks rt
    LEFT JOIN work_orders wo ON rt.work_order_id = wo.id
    LEFT JOIN processes p ON rt.process_id = p.id
    LEFT JOIN rework_reasons rr ON rt.rework_reason_id = rr.id
    LEFT JOIN responsibility_teams rtm ON rt.responsibility_team_id = rtm.id
    ${whereSql}
    ORDER BY rt.created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  params.push(parseInt(page_size), offset);
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const countSql = `SELECT COUNT(*) as total FROM rework_tasks rt ${whereSql}`;
    db.get(countSql, params.slice(0, -2), (err, countResult) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const dataWithLabels = rows.map(row => ({
        ...row,
        status_label: STATUS_LABELS[row.status] || row.status
      }));
      
      res.json({
        data: dataWithLabels,
        pagination: {
          page: parseInt(page),
          page_size: parseInt(page_size),
          total: countResult.total
        }
      });
    });
  });
});

router.get('/rework-tasks/:id', (req, res) => {
  const sql = `
    SELECT 
      rt.id,
      rt.rework_no,
      rt.work_order_id,
      wo.work_order_no,
      wo.product_name,
      rt.process_id,
      p.process_code,
      p.process_name,
      rt.rework_reason_id,
      rr.reason_code,
      rr.reason_name,
      rt.responsibility_team_id,
      rtm.team_code,
      rtm.team_name,
      rt.quantity,
      rt.status,
      rt.remark,
      rt.manual_remark,
      rt.is_manual_override,
      rt.created_by,
      rt.reviewed_by,
      rt.created_at,
      rt.updated_at
    FROM rework_tasks rt
    LEFT JOIN work_orders wo ON rt.work_order_id = wo.id
    LEFT JOIN processes p ON rt.process_id = p.id
    LEFT JOIN rework_reasons rr ON rt.rework_reason_id = rr.id
    LEFT JOIN responsibility_teams rtm ON rt.responsibility_team_id = rtm.id
    WHERE rt.id = ?
  `;
  
  db.get(sql, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '返工任务不存在' });
    
    res.json({
      data: {
        ...row,
        status_label: STATUS_LABELS[row.status] || row.status
      }
    });
  });
});

router.get('/rework-tasks/:id/history', (req, res) => {
  const sql = `
    SELECT 
      id,
      from_status,
      to_status,
      operation_type,
      operator,
      remark,
      created_at
    FROM rework_status_history
    WHERE rework_task_id = ?
    ORDER BY created_at ASC
  `;
  
  db.all(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const historyWithLabels = rows.map(row => ({
      ...row,
      from_status_label: STATUS_LABELS[row.from_status] || row.from_status,
      to_status_label: STATUS_LABELS[row.to_status] || row.to_status
    }));
    
    res.json({ data: historyWithLabels });
  });
});

router.post('/rework-tasks', (req, res) => {
  const {
    work_order_id,
    process_id,
    rework_reason_id,
    responsibility_team_id,
    quantity,
    remark,
    created_by
  } = req.body;
  
  const id = uuidv4();
  const reworkNo = generateReworkNo();
  const status = REWORK_STATUSES.PENDING_PRODUCTION;
  
  const sql = `INSERT INTO rework_tasks 
    (id, rework_no, work_order_id, process_id, rework_reason_id, 
     responsibility_team_id, quantity, status, remark, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [
    id, reworkNo, work_order_id, process_id, rework_reason_id,
    responsibility_team_id, quantity, status, remark, created_by
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    const historyId = uuidv4();
    db.run(`INSERT INTO rework_status_history 
      (id, rework_task_id, from_status, to_status, operation_type, operator, remark) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [historyId, id, null, status, OPERATION_TYPES.CREATE, created_by, '创建返工任务']
    );
    
    res.json({
      id,
      rework_no: reworkNo,
      status,
      status_label: STATUS_LABELS[status]
    });
  });
});

router.post('/rework-tasks/:id/start', (req, res) => {
  const { operator, remark } = req.body;
  const reworkTaskId = req.params.id;
  
  db.get('SELECT status FROM rework_tasks WHERE id = ?', [reworkTaskId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '返工任务不存在' });
    
    const newStatus = REWORK_STATUSES.IN_REWORK;
    if (!validateStatusTransition(row.status, newStatus)) {
      return res.status(400).json({ error: '状态流转不合法' });
    }
    
    updateReworkStatus(reworkTaskId, newStatus, operator, remark, OPERATION_TYPES.START, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        id: reworkTaskId,
        status: newStatus,
        status_label: STATUS_LABELS[newStatus]
      });
    });
  });
});

router.post('/rework-tasks/:id/submit-review', (req, res) => {
  const { operator, remark } = req.body;
  const reworkTaskId = req.params.id;
  
  db.get('SELECT status FROM rework_tasks WHERE id = ?', [reworkTaskId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '返工任务不存在' });
    
    const newStatus = REWORK_STATUSES.PENDING_REVIEW;
    if (!validateStatusTransition(row.status, newStatus)) {
      return res.status(400).json({ error: '状态流转不合法' });
    }
    
    updateReworkStatus(reworkTaskId, newStatus, operator, remark, OPERATION_TYPES.SUBMIT, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        id: reworkTaskId,
        status: newStatus,
        status_label: STATUS_LABELS[newStatus]
      });
    });
  });
});

router.post('/rework-tasks/:id/review', (req, res) => {
  const { operator, passed, remark } = req.body;
  const reworkTaskId = req.params.id;
  
  db.get('SELECT status FROM rework_tasks WHERE id = ?', [reworkTaskId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '返工任务不存在' });
    
    const newStatus = passed ? REWORK_STATUSES.COMPLETED : REWORK_STATUSES.REJECTED;
    if (!validateStatusTransition(row.status, newStatus)) {
      return res.status(400).json({ error: '状态流转不合法' });
    }
    
    updateReworkStatus(reworkTaskId, newStatus, operator, remark, 
      passed ? OPERATION_TYPES.REVIEW : OPERATION_TYPES.REJECT, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (passed) {
        db.get('SELECT work_order_id FROM rework_tasks WHERE id = ?', [reworkTaskId], (err, task) => {
          if (!err && task) {
            db.run('UPDATE work_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
              ['rework_completed', task.work_order_id]);
          }
        });
      }
      
      res.json({
        id: reworkTaskId,
        status: newStatus,
        status_label: STATUS_LABELS[newStatus],
        passed
      });
    });
  });
});

router.post('/rework-tasks/:id/reject', (req, res) => {
  const { operator, remark } = req.body;
  const reworkTaskId = req.params.id;
  
  db.get('SELECT status FROM rework_tasks WHERE id = ?', [reworkTaskId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '返工任务不存在' });
    
    const newStatus = REWORK_STATUSES.REJECTED;
    if (!validateStatusTransition(row.status, newStatus)) {
      return res.status(400).json({ error: '状态流转不合法' });
    }
    
    updateReworkStatus(reworkTaskId, newStatus, operator, remark, OPERATION_TYPES.REJECT, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        id: reworkTaskId,
        status: newStatus,
        status_label: STATUS_LABELS[newStatus]
      });
    });
  });
});

router.post('/rework-tasks/:id/rework-again', (req, res) => {
  const { operator, remark } = req.body;
  const reworkTaskId = req.params.id;
  
  db.get('SELECT status FROM rework_tasks WHERE id = ?', [reworkTaskId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '返工任务不存在' });
    
    const newStatus = REWORK_STATUSES.IN_REWORK;
    if (!validateStatusTransition(row.status, newStatus)) {
      return res.status(400).json({ error: '状态流转不合法' });
    }
    
    updateReworkStatus(reworkTaskId, newStatus, operator, remark, OPERATION_TYPES.START, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        id: reworkTaskId,
        status: newStatus,
        status_label: STATUS_LABELS[newStatus]
      });
    });
  });
});

router.post('/rework-tasks/:id/manual-override', (req, res) => {
  const { operator, manual_remark, target_status } = req.body;
  const reworkTaskId = req.params.id;
  
  db.get('SELECT status FROM rework_tasks WHERE id = ?', [reworkTaskId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '返工任务不存在' });
    
    const newStatus = target_status || REWORK_STATUSES.PENDING_REVIEW;
    
    db.run(`UPDATE rework_tasks 
            SET status = ?, manual_remark = ?, is_manual_override = 1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
      [newStatus, manual_remark, reworkTaskId],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const historyId = uuidv4();
        db.run(`INSERT INTO rework_status_history 
          (id, rework_task_id, from_status, to_status, operation_type, operator, remark) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [historyId, reworkTaskId, row.status, newStatus, OPERATION_TYPES.MANUAL_OVERRIDE, 
           operator, `人工干预: ${manual_remark}`]
        );
        
        res.json({
          id: reworkTaskId,
          status: newStatus,
          status_label: STATUS_LABELS[newStatus],
          manual_remark,
          is_manual_override: 1
        });
      }
    );
  });
});

router.get('/rework-tasks/export/csv', (req, res) => {
  const { status } = req.query;
  
  let whereClauses = [];
  let params = [];
  
  if (status) {
    whereClauses.push('rt.status = ?');
    params.push(status);
  }
  
  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  
  const sql = `
    SELECT 
      rt.rework_no as '返工单号',
      wo.work_order_no as '工单号',
      wo.product_name as '产品名称',
      p.process_name as '工序名称',
      rr.reason_name as '返工原因',
      rtm.team_name as '责任班组',
      rt.quantity as '数量',
      CASE rt.status
        WHEN 'pending_production' THEN '待生产'
        WHEN 'in_rework' THEN '返工中'
        WHEN 'pending_review' THEN '待复检'
        WHEN 'rejected' THEN '已驳回'
        WHEN 'completed' THEN '已完成'
        WHEN 'conflict' THEN '状态冲突'
        ELSE rt.status
      END as '状态',
      rt.remark as '备注',
      rt.created_by as '创建人',
      rt.created_at as '创建时间',
      rt.updated_at as '更新时间'
    FROM rework_tasks rt
    LEFT JOIN work_orders wo ON rt.work_order_id = wo.id
    LEFT JOIN processes p ON rt.process_id = p.id
    LEFT JOIN rework_reasons rr ON rt.rework_reason_id = rr.id
    LEFT JOIN responsibility_teams rtm ON rt.responsibility_team_id = rtm.id
    ${whereSql}
    ORDER BY rt.created_at DESC
  `;
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(rows);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rework_tasks_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  });
});

router.post('/import/batch', (req, res) => {
  const { items, created_by, file_name } = req.body;
  const batchNo = generateBatchNo();
  const importRecordId = uuidv4();
  
  db.run(`INSERT INTO import_records 
    (id, batch_no, file_name, total_count, created_by) 
    VALUES (?, ?, ?, ?, ?)`,
    [importRecordId, batchNo, file_name, items.length, created_by],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      let successCount = 0;
      let failedCount = 0;
      const errors = [];
      
      items.forEach((item, index) => {
        const { work_order_no, process_code, reason_code, team_code, quantity, remark } = item;
        
        db.get('SELECT id FROM work_orders WHERE work_order_no = ?', [work_order_no], (err, wo) => {
          if (err || !wo) {
            failedCount++;
            errors.push({ row: index + 1, data: item, error: `工单不存在: ${work_order_no}` });
            checkComplete();
            return;
          }
          
          db.get('SELECT id FROM processes WHERE process_code = ?', [process_code], (err, proc) => {
            if (err || !proc) {
              failedCount++;
              errors.push({ row: index + 1, data: item, error: `工序不存在: ${process_code}` });
              checkComplete();
              return;
            }
            
            db.get('SELECT id FROM rework_reasons WHERE reason_code = ?', [reason_code], (err, reason) => {
              if (err || !reason) {
                failedCount++;
                errors.push({ row: index + 1, data: item, error: `返工原因不存在: ${reason_code}` });
                checkComplete();
                return;
              }
              
              db.get('SELECT id FROM responsibility_teams WHERE team_code = ?', [team_code], (err, team) => {
                if (err || !team) {
                  failedCount++;
                  errors.push({ row: index + 1, data: item, error: `责任班组不存在: ${team_code}` });
                  checkComplete();
                  return;
                }
                
                const id = uuidv4();
                const reworkNo = generateReworkNo();
                const status = REWORK_STATUSES.PENDING_PRODUCTION;
                
                db.run(`INSERT INTO rework_tasks 
                  (id, rework_no, work_order_id, process_id, rework_reason_id, 
                   responsibility_team_id, quantity, status, remark, created_by) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [id, reworkNo, wo.id, proc.id, reason.id, team.id, 
                   quantity || 1, status, remark, created_by],
                  (err) => {
                    if (err) {
                      failedCount++;
                      errors.push({ row: index + 1, data: item, error: err.message });
                    } else {
                      successCount++;
                      const historyId = uuidv4();
                      db.run(`INSERT INTO rework_status_history 
                        (id, rework_task_id, from_status, to_status, operation_type, operator, remark) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [historyId, id, null, status, OPERATION_TYPES.CREATE, 
                         created_by, `批量导入创建: ${batchNo}`]
                      );
                    }
                    checkComplete();
                  }
                );
              });
            });
          });
        });
      });
      
      function checkComplete() {
        if (successCount + failedCount === items.length) {
          db.run(`UPDATE import_records 
                  SET success_count = ?, failed_count = ?, status = 'completed' 
                  WHERE id = ?`,
            [successCount, failedCount, importRecordId]
          );
          
          errors.forEach(err => {
            const errorId = uuidv4();
            db.run(`INSERT INTO import_errors 
              (id, import_record_id, row_data, error_message, row_number) 
              VALUES (?, ?, ?, ?, ?)`,
              [errorId, importRecordId, JSON.stringify(err.data), err.error, err.row]
            );
          });
          
          res.json({
            batch_no: batchNo,
            total: items.length,
            success: successCount,
            failed: failedCount,
            errors: errors
          });
        }
      }
    }
  );
});

router.get('/import/records', (req, res) => {
  const sql = `SELECT * FROM import_records ORDER BY created_at DESC LIMIT 50`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

router.get('/import/records/:id/errors', (req, res) => {
  const sql = `SELECT * FROM import_errors WHERE import_record_id = ? ORDER BY row_number`;
  db.all(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

router.get('/statuses', (req, res) => {
  res.json({
    data: Object.entries(STATUS_LABELS).map(([code, label]) => ({
      code,
      label
    }))
  });
});

module.exports = router;
