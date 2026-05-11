const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { success, error, serverError } = require('../utils/responseHandler');

function generateBatchNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `HC-${dateStr}-${random}`;
}

exports.getAllBatches = (req, res) => {
  const sql = `
    SELECT 
      ib.*,
      ht.harvest_date,
      ht.plot_id,
      p.name as plot_name,
      hm.id as manager_id,
      hm.name as manager_name,
      g.name as grade_name,
      g.code as grade_code,
      lr.name as loss_reason_name
    FROM inventory_batches ib
    LEFT JOIN harvest_tasks ht ON ib.harvest_task_id = ht.id
    LEFT JOIN plots p ON ht.plot_id = p.id
    LEFT JOIN harvest_managers hm ON ht.manager_id = hm.id
    LEFT JOIN grades g ON ib.grade_id = g.id
    LEFT JOIN loss_reasons lr ON ib.loss_reason_id = lr.id
    ORDER BY ib.created_at DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return serverError(res, err);
    success(res, rows);
  });
};

exports.getBatchById = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT 
      ib.*,
      ht.harvest_date,
      ht.plot_id,
      p.name as plot_name,
      hm.id as manager_id,
      hm.name as manager_name,
      g.name as grade_name,
      g.code as grade_code,
      lr.name as loss_reason_name
    FROM inventory_batches ib
    LEFT JOIN harvest_tasks ht ON ib.harvest_task_id = ht.id
    LEFT JOIN plots p ON ht.plot_id = p.id
    LEFT JOIN harvest_managers hm ON ht.manager_id = hm.id
    LEFT JOIN grades g ON ib.grade_id = g.id
    LEFT JOIN loss_reasons lr ON ib.loss_reason_id = lr.id
    WHERE ib.id = ?
  `;
  db.get(sql, [id], (err, row) => {
    if (err) return serverError(res, err);
    if (!row) return error(res, '入库批次不存在', 404);
    success(res, row);
  });
};

exports.createBatch = (req, res) => {
  const { harvest_task_id, grade_id, quantity, loss_quantity, loss_reason_id, unit, storage_location, notes } = req.body;
  
  if (!harvest_task_id || quantity == null) {
    return error(res, '采收任务和入库数量不能为空');
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.get('SELECT * FROM harvest_tasks WHERE id = ?', [harvest_task_id], (err, task) => {
      if (err) {
        db.run('ROLLBACK');
        return serverError(res, err);
      }
      if (!task) {
        db.run('ROLLBACK');
        return error(res, '采收任务不存在', 404);
      }

      const harvestQuantity = task.actual_quantity || task.estimated_quantity || 0;
      const totalLoss = loss_quantity || 0;
      const netQuantity = parseFloat(quantity);
      
      if (netQuantity + totalLoss > harvestQuantity) {
        db.run('ROLLBACK');
        return error(res, '入库数量加损耗数量不能超过采收数量');
      }

      db.all('SELECT * FROM inventory_batches WHERE harvest_task_id = ?', [harvest_task_id], (err, existingBatches) => {
        if (err) {
          db.run('ROLLBACK');
          return serverError(res, err);
        }

        const existingTotal = existingBatches.reduce((sum, b) => sum + (b.quantity || 0) + (b.loss_quantity || 0), 0);
        if (existingTotal + netQuantity + totalLoss > harvestQuantity) {
          db.run('ROLLBACK');
          return error(res, `该采收任务已有入库 ${existingTotal.toFixed(2)}，剩余可入库 ${(harvestQuantity - existingTotal).toFixed(2)}`);
        }

        const batchNo = generateBatchNo();
        const sql = `
          INSERT INTO inventory_batches 
          (batch_no, harvest_task_id, grade_id, quantity, loss_quantity, loss_reason_id, unit, storage_location, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(sql, [batchNo, harvest_task_id, grade_id || null, netQuantity, totalLoss, loss_reason_id || null, unit || 'kg', storage_location || null, notes || null], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return serverError(res, err);
          }

          const newActual = (task.actual_quantity || 0) + netQuantity + totalLoss;
          db.run('UPDATE harvest_tasks SET actual_quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
            [Math.max(newActual, harvestQuantity), 'in_progress', harvest_task_id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return serverError(res, err);
            }

            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                return serverError(res, err);
              }

              db.get(`
                SELECT ib.*, ht.harvest_date, p.name as plot_name, hm.name as manager_name, g.name as grade_name
                FROM inventory_batches ib
                LEFT JOIN harvest_tasks ht ON ib.harvest_task_id = ht.id
                LEFT JOIN plots p ON ht.plot_id = p.id
                LEFT JOIN harvest_managers hm ON ht.manager_id = hm.id
                LEFT JOIN grades g ON ib.grade_id = g.id
                WHERE ib.id = ?
              `, [this.lastID], (err, row) => {
                if (err) return serverError(res, err);
                success(res, row, '入库批次创建成功');
              });
            });
          });
        });
      });
    });
  });
};

exports.updateBatch = (req, res) => {
  const { id } = req.params;
  const { grade_id, storage_location, notes } = req.body;
  
  db.get('SELECT * FROM inventory_batches WHERE id = ?', [id], (err, batch) => {
    if (err) return serverError(res, err);
    if (!batch) return error(res, '入库批次不存在', 404);

    if (grade_id && grade_id !== batch.grade_id) {
      db.run(`
        INSERT INTO grade_adjustment_history 
        (batch_id, old_grade_id, new_grade_id, adjusted_by, adjustment_reason)
        VALUES (?, ?, ?, ?, ?)
      `, [id, batch.grade_id, grade_id, 'system', '等级调整'], (err) => {
        if (err) return serverError(res, err);
      });
    }

    const sql = `
      UPDATE inventory_batches SET 
        grade_id = ?, storage_location = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    db.run(sql, [grade_id || null, storage_location || null, notes || null, id], function(err) {
      if (err) return serverError(res, err);
      db.get(`
        SELECT ib.*, ht.harvest_date, p.name as plot_name, hm.name as manager_name, g.name as grade_name
        FROM inventory_batches ib
        LEFT JOIN harvest_tasks ht ON ib.harvest_task_id = ht.id
        LEFT JOIN plots p ON ht.plot_id = p.id
        LEFT JOIN harvest_managers hm ON ht.manager_id = hm.id
        LEFT JOIN grades g ON ib.grade_id = g.id
        WHERE ib.id = ?
      `, [id], (err, row) => {
        if (err) return serverError(res, err);
        success(res, row, '入库批次更新成功');
      });
    });
  });
};

exports.getBatchHistory = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT 
      gah.*,
      g1.name as old_grade_name,
      g2.name as new_grade_name
    FROM grade_adjustment_history gah
    LEFT JOIN grades g1 ON gah.old_grade_id = g1.id
    LEFT JOIN grades g2 ON gah.new_grade_id = g2.id
    WHERE gah.batch_id = ?
    ORDER BY gah.adjusted_at DESC
  `;
  db.all(sql, [id], (err, rows) => {
    if (err) return serverError(res, err);
    success(res, rows);
  });
};

exports.adjustBatchGrade = (req, res) => {
  const { id } = req.params;
  const { new_grade_id, adjusted_by, adjustment_reason } = req.body;
  
  if (!new_grade_id) return error(res, '新等级不能为空');

  db.get('SELECT * FROM inventory_batches WHERE id = ?', [id], (err, batch) => {
    if (err) return serverError(res, err);
    if (!batch) return error(res, '入库批次不存在', 404);

    db.run(`
      INSERT INTO grade_adjustment_history 
      (batch_id, old_grade_id, new_grade_id, adjusted_by, adjustment_reason)
      VALUES (?, ?, ?, ?, ?)
    `, [id, batch.grade_id, new_grade_id, adjusted_by || 'system', adjustment_reason || '等级调整'], (err) => {
      if (err) return serverError(res, err);

      db.run('UPDATE inventory_batches SET grade_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [new_grade_id, id], function(err) {
        if (err) return serverError(res, err);
        success(res, null, '等级调整成功，历史记录已保存');
      });
    });
  });
};

exports.deleteBatch = (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM quality_inspections WHERE batch_id = ?', [id], (err, inspection) => {
    if (err) return serverError(res, err);
    if (inspection) return error(res, '该批次已有质检记录，无法删除');
    
    db.run('DELETE FROM inventory_batches WHERE id = ?', [id], function(err) {
      if (err) return serverError(res, err);
      if (this.changes === 0) return error(res, '入库批次不存在', 404);
      success(res, null, '入库批次删除成功');
    });
  });
};
