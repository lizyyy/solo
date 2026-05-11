const db = require('../config/database');
const { success, error, serverError } = require('../utils/responseHandler');

exports.getAllInspections = (req, res) => {
  const sql = `
    SELECT 
      qi.*,
      ib.batch_no,
      ib.quantity as batch_quantity,
      p.name as plot_name,
      g.name as grade_name
    FROM quality_inspections qi
    LEFT JOIN inventory_batches ib ON qi.batch_id = ib.id
    LEFT JOIN harvest_tasks ht ON ib.harvest_task_id = ht.id
    LEFT JOIN plots p ON ht.plot_id = p.id
    LEFT JOIN grades g ON ib.grade_id = g.id
    ORDER BY qi.inspection_date DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return serverError(res, err);
    success(res, rows);
  });
};

exports.getInspectionsByBatch = (req, res) => {
  const { batchId } = req.params;
  const sql = `
    SELECT 
      qi.*,
      ib.batch_no,
      ib.quantity as batch_quantity,
      p.name as plot_name,
      g.name as grade_name
    FROM quality_inspections qi
    LEFT JOIN inventory_batches ib ON qi.batch_id = ib.id
    LEFT JOIN harvest_tasks ht ON ib.harvest_task_id = ht.id
    LEFT JOIN plots p ON ht.plot_id = p.id
    LEFT JOIN grades g ON ib.grade_id = g.id
    WHERE qi.batch_id = ?
    ORDER BY qi.inspection_date DESC
  `;
  db.all(sql, [batchId], (err, rows) => {
    if (err) return serverError(res, err);
    success(res, rows);
  });
};

exports.createInspection = (req, res) => {
  const { batch_id, inspector, result, score, defects, notes } = req.body;
  
  if (!batch_id || !result) {
    return error(res, '批次和质检结果不能为空');
  }

  const validResults = ['passed', 'failed', 'pending'];
  if (!validResults.includes(result)) {
    return error(res, '质检结果只能是 passed, failed 或 pending');
  }

  db.get('SELECT * FROM inventory_batches WHERE id = ?', [batch_id], (err, batch) => {
    if (err) return serverError(res, err);
    if (!batch) return error(res, '入库批次不存在', 404);

    const sql = `
      INSERT INTO quality_inspections 
      (batch_id, inspector, result, score, defects, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.run(sql, [batch_id, inspector || null, result, score || null, defects || null, notes || null], function(err) {
      if (err) return serverError(res, err);

      let qualityStatus = 'pending';
      let batchStatus = batch.status;
      
      if (result === 'passed') {
        qualityStatus = 'passed';
        batchStatus = 'available';
      } else if (result === 'failed') {
        qualityStatus = 'failed';
        batchStatus = 'quarantined';
      }

      db.run('UPDATE inventory_batches SET quality_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
        [qualityStatus, batchStatus, batch_id], (err) => {
        if (err) return serverError(res, err);

        db.get(`
          SELECT 
            qi.*,
            ib.batch_no,
            ib.quantity as batch_quantity,
            p.name as plot_name,
            g.name as grade_name
          FROM quality_inspections qi
          LEFT JOIN inventory_batches ib ON qi.batch_id = ib.id
          LEFT JOIN harvest_tasks ht ON ib.harvest_task_id = ht.id
          LEFT JOIN plots p ON ht.plot_id = p.id
          LEFT JOIN grades g ON ib.grade_id = g.id
          WHERE qi.id = ?
        `, [this.lastID], (err, row) => {
          if (err) return serverError(res, err);
          const msg = result === 'passed' ? '质检通过，批次已上架可售' : 
                      result === 'failed' ? '质检不通过，批次已隔离' : '质检记录创建成功';
          success(res, row, msg);
        });
      });
    });
  });
};

exports.updateInspection = (req, res) => {
  const { id } = req.params;
  const { inspector, result, score, defects, notes } = req.body;
  
  db.get('SELECT * FROM quality_inspections WHERE id = ?', [id], (err, inspection) => {
    if (err) return serverError(res, err);
    if (!inspection) return error(res, '质检记录不存在', 404);

    const sql = `
      UPDATE quality_inspections SET 
        inspector = ?, result = ?, score = ?, defects = ?, notes = ?
      WHERE id = ?
    `;
    db.run(sql, [inspector || null, result || inspection.result, score || null, defects || null, notes || null, id], function(err) {
      if (err) return serverError(res, err);

      if (result && result !== inspection.result) {
        db.get('SELECT * FROM inventory_batches WHERE id = ?', [inspection.batch_id], (err, batch) => {
          if (err) return serverError(res, err);
          
          let qualityStatus = 'pending';
          let batchStatus = batch.status;
          
          if (result === 'passed') {
            qualityStatus = 'passed';
            batchStatus = 'available';
          } else if (result === 'failed') {
            qualityStatus = 'failed';
            batchStatus = 'quarantined';
          }

          db.run('UPDATE inventory_batches SET quality_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
            [qualityStatus, batchStatus, inspection.batch_id], (err) => {
            if (err) return serverError(res, err);
          });
        });
      }

      success(res, null, '质检记录更新成功');
    });
  });
};
