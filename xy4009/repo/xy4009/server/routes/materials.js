const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

router.get('/', (req, res, next) => {
  const { code, name, page = 1, pageSize = 100 } = req.query;
  let sql = 'SELECT * FROM materials WHERE 1=1';
  const params = [];

  if (code) {
    sql += ' AND code LIKE ?';
    params.push(`%${code}%`);
  }
  if (name) {
    sql += ' AND name LIKE ?';
    params.push(`%${name}%`);
  }

  sql += ' ORDER BY created_at DESC';

  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  sql += ` LIMIT ${parseInt(pageSize)} OFFSET ${offset}`;

  db.all(sql, params, (err, rows) => {
    if (err) return next(err);
    res.json({ success: true, data: rows });
  });
});

router.get('/:id', (req, res, next) => {
  db.get('SELECT * FROM materials WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return next(err);
    if (!row) {
      return next(new NotFoundError('物料不存在'));
    }
    res.json({ success: true, data: row });
  });
});

router.post('/', (req, res, next) => {
  const { code, name, spec, unit } = req.body;

  if (!code || !name) {
    return next(new ValidationError('物料编码和名称不能为空'));
  }

  db.run(
    'INSERT INTO materials (code, name, spec, unit) VALUES (?, ?, ?, ?)',
    [code, name, spec, unit],
    function (err) {
      if (err) return next(err);
      res.status(201).json({
        success: true,
        data: { id: this.lastID, code, name, spec, unit }
      });
    }
  );
});

router.put('/:id', (req, res, next) => {
  const { code, name, spec, unit } = req.body;
  const id = req.params.id;

  if (!code || !name) {
    return next(new ValidationError('物料编码和名称不能为空'));
  }

  db.run(
    'UPDATE materials SET code = ?, name = ?, spec = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [code, name, spec, unit, id],
    function (err) {
      if (err) return next(err);
      if (this.changes === 0) {
        return next(new NotFoundError('物料不存在'));
      }
      res.json({ success: true, message: '更新成功' });
    }
  );
});

router.delete('/:id', (req, res, next) => {
  db.get(
    'SELECT COUNT(*) as count FROM quotation_items WHERE material_id = ?',
    [req.params.id],
    (err, row) => {
      if (err) return next(err);
      if (row.count > 0) {
        return next(new ValidationError('该物料已被引用，无法删除'));
      }

      db.run('DELETE FROM materials WHERE id = ?', [req.params.id], function (err) {
        if (err) return next(err);
        if (this.changes === 0) {
          return next(new NotFoundError('物料不存在'));
        }
        res.json({ success: true, message: '删除成功' });
      });
    }
  );
});

module.exports = router;
