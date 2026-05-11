const db = require('../config/database');
const { success, error, serverError } = require('../utils/responseHandler');

exports.getAllGrades = (req, res) => {
  const sql = `SELECT * FROM grades ORDER BY sort_order ASC, created_at DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return serverError(res, err);
    success(res, rows);
  });
};

exports.createGrade = (req, res) => {
  const { name, code, description, sort_order } = req.body;
  if (!name) return error(res, '等级名称不能为空');
  
  const sql = `INSERT INTO grades (name, code, description, sort_order) VALUES (?, ?, ?, ?)`;
  db.run(sql, [name, code || null, description || null, sort_order || 0], function(err) {
    if (err) return serverError(res, err);
    db.get('SELECT * FROM grades WHERE id = ?', [this.lastID], (err, row) => {
      if (err) return serverError(res, err);
      success(res, row, '分拣等级创建成功');
    });
  });
};

exports.updateGrade = (req, res) => {
  const { id } = req.params;
  const { name, code, description, sort_order, status } = req.body;
  
  const sql = `UPDATE grades SET name = ?, code = ?, description = ?, sort_order = ?, status = ? WHERE id = ?`;
  db.run(sql, [name, code || null, description || null, sort_order || 0, status || 'active', id], function(err) {
    if (err) return serverError(res, err);
    if (this.changes === 0) return error(res, '等级不存在', 404);
    db.get('SELECT * FROM grades WHERE id = ?', [id], (err, row) => {
      if (err) return serverError(res, err);
      success(res, row, '分拣等级更新成功');
    });
  });
};

exports.deleteGrade = (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM grades WHERE id = ?', [id], function(err) {
    if (err) return serverError(res, err);
    if (this.changes === 0) return error(res, '等级不存在', 404);
    success(res, null, '分拣等级删除成功');
  });
};
