const db = require('../config/database');
const { success, error, serverError } = require('../utils/responseHandler');

exports.getAllLossReasons = (req, res) => {
  const sql = `SELECT * FROM loss_reasons ORDER BY created_at DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return serverError(res, err);
    success(res, rows);
  });
};

exports.createLossReason = (req, res) => {
  const { name, description } = req.body;
  if (!name) return error(res, '损耗原因名称不能为空');
  
  const sql = `INSERT INTO loss_reasons (name, description) VALUES (?, ?)`;
  db.run(sql, [name, description || null], function(err) {
    if (err) return serverError(res, err);
    db.get('SELECT * FROM loss_reasons WHERE id = ?', [this.lastID], (err, row) => {
      if (err) return serverError(res, err);
      success(res, row, '损耗原因创建成功');
    });
  });
};

exports.updateLossReason = (req, res) => {
  const { id } = req.params;
  const { name, description, status } = req.body;
  
  const sql = `UPDATE loss_reasons SET name = ?, description = ?, status = ? WHERE id = ?`;
  db.run(sql, [name, description || null, status || 'active', id], function(err) {
    if (err) return serverError(res, err);
    if (this.changes === 0) return error(res, '损耗原因不存在', 404);
    db.get('SELECT * FROM loss_reasons WHERE id = ?', [id], (err, row) => {
      if (err) return serverError(res, err);
      success(res, row, '损耗原因更新成功');
    });
  });
};

exports.deleteLossReason = (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM loss_reasons WHERE id = ?', [id], function(err) {
    if (err) return serverError(res, err);
    if (this.changes === 0) return error(res, '损耗原因不存在', 404);
    success(res, null, '损耗原因删除成功');
  });
};
