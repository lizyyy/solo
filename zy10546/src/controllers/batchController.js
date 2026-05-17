const db = require('../config/database');

function generateBatchNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INS-${year}${month}-${random}`;
}

exports.createBatch = (req, res, next) => {
  const { batch_name, inspection_type, start_date, end_date, inspector, remarks } = req.body;
  const batch_no = generateBatchNo();

  db.run(
    `INSERT INTO inspection_batches (batch_no, batch_name, inspection_type, start_date, end_date, inspector, remarks, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`,
    [batch_no, batch_name, inspection_type, start_date, end_date, inspector, remarks],
    function(err) {
      if (err) {
        return next(err);
      }
      res.status(201).json({
        success: true,
        message: '巡检批次创建成功',
        data: { id: this.lastID, batch_no }
      });
    }
  );
};

exports.getBatches = (req, res, next) => {
  const { status, type, page = 1, pageSize = 10 } = req.query;
  let sql = `
    SELECT b.*, 
           COUNT(i.id) as total_items,
           SUM(CASE WHEN i.current_status = 'closed' THEN 1 ELSE 0 END) as closed_items,
           SUM(CASE WHEN i.current_status IN ('pending', 'in_rectification', 'rectified') THEN 1 ELSE 0 END) as open_items
    FROM inspection_batches b
    LEFT JOIN inspection_items i ON b.id = i.batch_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += ` AND b.status = ?`;
    params.push(status);
  }
  if (type) {
    sql += ` AND b.inspection_type = ?`;
    params.push(type);
  }

  sql += ` GROUP BY b.id ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(pageSize), (page - 1) * pageSize);

  db.all(sql, params, (err, batches) => {
    if (err) return next(err);
    
    db.get(`SELECT COUNT(*) as total FROM inspection_batches`, (countErr, result) => {
      if (countErr) return next(countErr);
      res.json({
        success: true,
        data: batches,
        pagination: { total: result.total, page: Number(page), pageSize: Number(pageSize) }
      });
    });
  });
};

exports.getBatchDetail = (req, res, next) => {
  const { id } = req.params;
  
  db.get(`SELECT * FROM inspection_batches WHERE id = ?`, [id], (err, batch) => {
    if (err) return next(err);
    if (!batch) {
      return res.status(404).json({ success: false, message: '批次不存在' });
    }

    db.all(`
      SELECT i.*, r.level_name, r.level_code, r.severity
      FROM inspection_items i
      JOIN risk_levels r ON i.risk_level_id = r.id
      WHERE i.batch_id = ?
      ORDER BY r.severity DESC, i.created_at DESC
    `, [id], (itemsErr, items) => {
      if (itemsErr) return next(itemsErr);
      batch.items = items;
      res.json({ success: true, data: batch });
    });
  });
};

exports.updateBatchStatus = (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  db.run(
    `UPDATE inspection_batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, id],
    function(err) {
      if (err) return next(err);
      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: '批次不存在' });
      }
      res.json({ success: true, message: '批次状态更新成功' });
    }
  );
};
