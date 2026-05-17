const db = require('../config/database');

function generateItemNo(batchId) {
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ITEM-${batchId}-${random}`;
}

exports.createItem = (req, res, next) => {
  const { batch_id, check_content, risk_level_id, rectifier, rectify_deadline, source_type, source_ref, raw_input } = req.body;
  const item_no = generateItemNo(batch_id);

  db.get(`SELECT id FROM inspection_batches WHERE id = ?`, [batch_id], (batchErr, batch) => {
    if (batchErr) return next(batchErr);
    if (!batch) {
      return res.status(400).json({ success: false, message: '关联的批次不存在' });
    }

    db.run(
      `INSERT INTO inspection_items (item_no, batch_id, check_content, risk_level_id, rectifier, rectify_deadline, source_type, source_ref, raw_input, current_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [item_no, batch_id, check_content, risk_level_id, rectifier, rectify_deadline, source_type, source_ref, raw_input],
      function(err) {
        if (err) return next(err);
        
        db.run(
          `INSERT INTO status_history (item_id, to_status, operator, reason)
           VALUES (?, ?, ?, ?)`,
          [this.lastID, 'pending', 'system', '检查项创建'],
          (historyErr) => {
            if (historyErr) console.error('记录状态历史失败:', historyErr);
          }
        );

        res.status(201).json({
          success: true,
          message: '检查项创建成功',
          data: { id: this.lastID, item_no }
        });
      }
    );
  });
};

exports.getItems = (req, res, next) => {
  const { batch_id, status, risk_level, rectifier, overdue, page = 1, pageSize = 20 } = req.query;
  let sql = `
    SELECT i.*, r.level_name, r.level_code, r.severity, b.batch_name
    FROM inspection_items i
    JOIN risk_levels r ON i.risk_level_id = r.id
    JOIN inspection_batches b ON i.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (batch_id) {
    sql += ` AND i.batch_id = ?`;
    params.push(batch_id);
  }
  if (status) {
    sql += ` AND i.current_status = ?`;
    params.push(status);
  }
  if (risk_level) {
    sql += ` AND r.level_code = ?`;
    params.push(risk_level);
  }
  if (rectifier) {
    sql += ` AND i.rectifier = ?`;
    params.push(rectifier);
  }
  if (overdue === 'true') {
    sql += ` AND i.rectify_deadline < DATE('now') AND i.current_status != 'closed'`;
  }

  sql += ` ORDER BY r.severity DESC, i.rectify_deadline ASC LIMIT ? OFFSET ?`;
  params.push(Number(pageSize), (page - 1) * pageSize);

  db.all(sql, params, (err, items) => {
    if (err) return next(err);
    
    db.get(`SELECT COUNT(*) as total FROM inspection_items WHERE current_status != 'closed'`, (countErr, result) => {
      if (countErr) return next(countErr);
      res.json({
        success: true,
        data: items,
        pagination: { total: result.total, page: Number(page), pageSize: Number(pageSize) }
      });
    });
  });
};

exports.getItemDetail = (req, res, next) => {
  const { id } = req.params;

  db.get(`
    SELECT i.*, r.level_name, r.level_code, r.severity, b.batch_name
    FROM inspection_items i
    JOIN risk_levels r ON i.risk_level_id = r.id
    JOIN inspection_batches b ON i.batch_id = b.id
    WHERE i.id = ?
  `, [id], (err, item) => {
    if (err) return next(err);
    if (!item) {
      return res.status(404).json({ success: false, message: '检查项不存在' });
    }

    db.all(`SELECT * FROM status_history WHERE item_id = ? ORDER BY operation_time DESC`, [id], (historyErr, history) => {
      if (historyErr) return next(historyErr);
      
      db.all(`SELECT * FROM rectification_records WHERE item_id = ? ORDER BY created_at DESC`, [id], (rectErr, rectRecords) => {
        if (rectErr) return next(rectErr);
        
        db.all(`SELECT * FROM review_records WHERE item_id = ? ORDER BY created_at DESC`, [id], (reviewErr, reviewRecords) => {
          if (reviewErr) return next(reviewErr);
          
          db.all(`SELECT * FROM manual_corrections WHERE item_id = ? ORDER BY created_at DESC`, [id], (corrErr, corrections) => {
            if (corrErr) return next(corrErr);
            
            item.status_history = history;
            item.rectification_records = rectRecords;
            item.review_records = reviewRecords;
            item.manual_corrections = corrections;
            
            res.json({ success: true, data: item });
          });
        });
      });
    });
  });
};

exports.updateItemStatus = (req, res, next) => {
  const { id } = req.params;
  const { status, operator, reason } = req.body;

  db.get(`SELECT current_status FROM inspection_items WHERE id = ?`, [id], (err, item) => {
    if (err) return next(err);
    if (!item) {
      return res.status(404).json({ success: false, message: '检查项不存在' });
    }

    const validTransitions = {
      pending: ['in_rectification'],
      in_rectification: ['rectified'],
      rectified: ['reviewing', 'closed'],
      reviewing: ['closed', 'reopened'],
      closed: ['reopened'],
      reopened: ['in_rectification']
    };

    if (!validTransitions[item.current_status]?.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `不允许从 ${item.current_status} 转换到 ${status}` 
      });
    }

    db.run(
      `UPDATE inspection_items SET current_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id],
      function(updateErr) {
        if (updateErr) return next(updateErr);
        
        db.run(
          `INSERT INTO status_history (item_id, from_status, to_status, operator, reason)
           VALUES (?, ?, ?, ?, ?)`,
          [id, item.current_status, status, operator, reason || '状态更新']
        );

        res.json({ success: true, message: '状态更新成功' });
      }
    );
  });
};

exports.submitRectification = (req, res, next) => {
  const { item_id, rectify_content, rectifier, rectify_date, evidences } = req.body;

  db.get(`SELECT current_status FROM inspection_items WHERE id = ?`, [item_id], (err, item) => {
    if (err) return next(err);
    if (!item) {
      return res.status(404).json({ success: false, message: '检查项不存在' });
    }

    if (item.current_status !== 'in_rectification') {
      return res.status(400).json({ success: false, message: '只有整改中状态的检查项才能提交整改' });
    }

    db.run(
      `INSERT INTO rectification_records (item_id, rectify_content, rectifier, rectify_date, evidences)
       VALUES (?, ?, ?, ?, ?)`,
      [item_id, rectify_content, rectifier, rectify_date, evidences],
      function(insertErr) {
        if (insertErr) return next(insertErr);

        db.run(
          `UPDATE inspection_items SET current_status = 'rectified', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [item_id],
          function(updateErr) {
            if (updateErr) return next(updateErr);

            db.run(
              `INSERT INTO status_history (item_id, from_status, to_status, operator, reason)
               VALUES (?, ?, ?, ?, ?)`,
              [item_id, 'in_rectification', 'rectified', rectifier, '提交整改申请']
            );

            res.json({ success: true, message: '整改提交成功，待复查' });
          }
        );
      }
    );
  });
};

exports.submitReview = (req, res, next) => {
  const { item_id, reviewer, review_date, review_conclusion, review_opinion } = req.body;

  db.get(`SELECT current_status FROM inspection_items WHERE id = ?`, [item_id], (err, item) => {
    if (err) return next(err);
    if (!item) {
      return res.status(404).json({ success: false, message: '检查项不存在' });
    }

    if (!['rectified', 'reviewing'].includes(item.current_status)) {
      return res.status(400).json({ success: false, message: '当前状态不允许提交复查' });
    }

    db.run(
      `INSERT INTO review_records (item_id, reviewer, review_date, review_conclusion, review_opinion)
       VALUES (?, ?, ?, ?, ?)`,
      [item_id, reviewer, review_date, review_conclusion, review_opinion],
      function(insertErr) {
        if (insertErr) return next(insertErr);

        const newStatus = review_conclusion === 'passed' ? 'closed' : 'reopened';

        db.run(
          `UPDATE inspection_items SET current_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [newStatus, item_id],
          function(updateErr) {
            if (updateErr) return next(updateErr);

            db.run(
              `INSERT INTO status_history (item_id, from_status, to_status, operator, reason)
               VALUES (?, ?, ?, ?, ?)`,
              [item_id, item.current_status, newStatus, reviewer, `复查${review_conclusion === 'passed' ? '通过' : '不通过'}`]
            );

            res.json({ 
              success: true, 
              message: `复查${review_conclusion === 'passed' ? '通过，问题已关闭' : '不通过，请重新整改'}` 
            });
          }
        );
      }
    );
  });
};
