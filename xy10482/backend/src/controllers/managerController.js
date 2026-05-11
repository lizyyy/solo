const db = require('../config/database');
const { success, error, serverError } = require('../utils/responseHandler');

exports.getAllManagers = (req, res) => {
  const sql = `SELECT * FROM harvest_managers ORDER BY created_at DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return serverError(res, err);
    success(res, rows);
  });
};

exports.createManager = (req, res) => {
  const { name, phone } = req.body;
  if (!name) return error(res, '负责人姓名不能为空');
  
  const sql = `INSERT INTO harvest_managers (name, phone) VALUES (?, ?)`;
  db.run(sql, [name, phone || null], function(err) {
    if (err) return serverError(res, err);
    db.get('SELECT * FROM harvest_managers WHERE id = ?', [this.lastID], (err, row) => {
      if (err) return serverError(res, err);
      success(res, row, '采收负责人创建成功');
    });
  });
};

exports.updateManager = (req, res) => {
  const { id } = req.params;
  const { name, phone, status } = req.body;
  
  const sql = `UPDATE harvest_managers SET name = ?, phone = ?, status = ? WHERE id = ?`;
  db.run(sql, [name, phone || null, status || 'active', id], function(err) {
    if (err) return serverError(res, err);
    if (this.changes === 0) return error(res, '负责人不存在', 404);
    db.get('SELECT * FROM harvest_managers WHERE id = ?', [id], (err, row) => {
      if (err) return serverError(res, err);
      success(res, row, '采收负责人更新成功');
    });
  });
};

exports.deleteManager = (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM harvest_managers WHERE id = ?', [id], function(err) {
    if (err) return serverError(res, err);
    if (this.changes === 0) return error(res, '负责人不存在', 404);
    success(res, null, '采收负责人删除成功');
  });
};
