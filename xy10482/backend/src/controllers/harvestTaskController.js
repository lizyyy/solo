const db = require('../config/database');
const { success, error, serverError } = require('../utils/responseHandler');

exports.getAllHarvestTasks = (req, res) => {
  const sql = `
    SELECT 
      ht.*,
      p.name as plot_name,
      hm.name as manager_name
    FROM harvest_tasks ht
    LEFT JOIN plots p ON ht.plot_id = p.id
    LEFT JOIN harvest_managers hm ON ht.manager_id = hm.id
    ORDER BY ht.harvest_date DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return serverError(res, err);
    success(res, rows);
  });
};

exports.getHarvestTaskById = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT 
      ht.*,
      p.name as plot_name,
      hm.name as manager_name
    FROM harvest_tasks ht
    LEFT JOIN plots p ON ht.plot_id = p.id
    LEFT JOIN harvest_managers hm ON ht.manager_id = hm.id
    WHERE ht.id = ?
  `;
  db.get(sql, [id], (err, row) => {
    if (err) return serverError(res, err);
    if (!row) return error(res, '采收任务不存在', 404);
    success(res, row);
  });
};

exports.createHarvestTask = (req, res) => {
  const { plot_id, manager_id, harvest_date, crop_type, estimated_quantity, notes } = req.body;
  
  if (!plot_id || !harvest_date) {
    return error(res, '地块和采收日期不能为空');
  }

  db.get('SELECT * FROM plots WHERE id = ?', [plot_id], (err, plot) => {
    if (err) return serverError(res, err);
    if (!plot) return error(res, '地块不存在', 404);

    const sql = `
      INSERT INTO harvest_tasks 
      (plot_id, manager_id, harvest_date, crop_type, estimated_quantity, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.run(sql, [plot_id, manager_id || null, harvest_date, crop_type || plot.crop_type, estimated_quantity || null, notes || null], function(err) {
      if (err) return serverError(res, err);
      db.get(`
        SELECT ht.*, p.name as plot_name, hm.name as manager_name
        FROM harvest_tasks ht
        LEFT JOIN plots p ON ht.plot_id = p.id
        LEFT JOIN harvest_managers hm ON ht.manager_id = hm.id
        WHERE ht.id = ?
      `, [this.lastID], (err, row) => {
        if (err) return serverError(res, err);
        success(res, row, '采收任务创建成功');
      });
    });
  });
};

exports.updateHarvestTask = (req, res) => {
  const { id } = req.params;
  const { plot_id, manager_id, harvest_date, crop_type, estimated_quantity, actual_quantity, status, notes } = req.body;
  
  const sql = `
    UPDATE harvest_tasks SET 
      plot_id = ?, manager_id = ?, harvest_date = ?, crop_type = ?,
      estimated_quantity = ?, actual_quantity = ?, status = ?, notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  db.run(sql, [plot_id, manager_id || null, harvest_date, crop_type, estimated_quantity || null, actual_quantity || 0, status || 'pending', notes || null, id], function(err) {
    if (err) return serverError(res, err);
    if (this.changes === 0) return error(res, '采收任务不存在', 404);
    db.get(`
      SELECT ht.*, p.name as plot_name, hm.name as manager_name
      FROM harvest_tasks ht
      LEFT JOIN plots p ON ht.plot_id = p.id
      LEFT JOIN harvest_managers hm ON ht.manager_id = hm.id
      WHERE ht.id = ?
    `, [id], (err, row) => {
      if (err) return serverError(res, err);
      success(res, row, '采收任务更新成功');
    });
  });
};

exports.deleteHarvestTask = (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM inventory_batches WHERE harvest_task_id = ?', [id], (err, batch) => {
    if (err) return serverError(res, err);
    if (batch) return error(res, '该采收任务已有入库批次，无法删除');
    
    db.run('DELETE FROM harvest_tasks WHERE id = ?', [id], function(err) {
      if (err) return serverError(res, err);
      if (this.changes === 0) return error(res, '采收任务不存在', 404);
      success(res, null, '采收任务删除成功');
    });
  });
};
