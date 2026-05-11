const db = require('../config/database');
const { success, error, serverError } = require('../utils/responseHandler');

exports.getAllPlots = (req, res) => {
  const sql = `SELECT * FROM plots ORDER BY created_at DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return serverError(res, err);
    success(res, rows);
  });
};

exports.getPlotById = (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM plots WHERE id = ?', [id], (err, row) => {
    if (err) return serverError(res, err);
    if (!row) return error(res, '地块不存在', 404);
    success(res, row);
  });
};

exports.createPlot = (req, res) => {
  const { name, area, crop_type, location, status } = req.body;
  if (!name) return error(res, '地块名称不能为空');
  
  const sql = `INSERT INTO plots (name, area, crop_type, location, status) VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [name, area || null, crop_type || null, location || null, status || 'active'], function(err) {
    if (err) return serverError(res, err);
    db.get('SELECT * FROM plots WHERE id = ?', [this.lastID], (err, row) => {
      if (err) return serverError(res, err);
      success(res, row, '地块创建成功');
    });
  });
};

exports.updatePlot = (req, res) => {
  const { id } = req.params;
  const { name, area, crop_type, location, status } = req.body;
  
  const sql = `UPDATE plots SET name = ?, area = ?, crop_type = ?, location = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  db.run(sql, [name, area || null, crop_type || null, location || null, status || 'active', id], function(err) {
    if (err) return serverError(res, err);
    if (this.changes === 0) return error(res, '地块不存在', 404);
    db.get('SELECT * FROM plots WHERE id = ?', [id], (err, row) => {
      if (err) return serverError(res, err);
      success(res, row, '地块更新成功');
    });
  });
};

exports.deletePlot = (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM plots WHERE id = ?', [id], function(err) {
    if (err) return serverError(res, err);
    if (this.changes === 0) return error(res, '地块不存在', 404);
    success(res, null, '地块删除成功');
  });
};
