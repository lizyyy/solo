const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

router.get('/', (req, res, next) => {
  db.all('SELECT * FROM exchange_rates ORDER BY currency', (err, rows) => {
    if (err) return next(err);
    res.json({ success: true, data: rows });
  });
});

router.get('/:currency', (req, res, next) => {
  db.get(
    'SELECT * FROM exchange_rates WHERE currency = ?',
    [req.params.currency.toUpperCase()],
    (err, row) => {
      if (err) return next(err);
      if (!row) {
        return next(new NotFoundError('汇率不存在'));
      }
      res.json({ success: true, data: row });
    }
  );
});

router.post('/', (req, res, next) => {
  const { currency, rate } = req.body;

  if (!currency || rate === undefined || rate === null) {
    return next(new ValidationError('币种和汇率不能为空'));
  }

  if (rate <= 0) {
    return next(new ValidationError('汇率必须大于0'));
  }

  db.run(
    'INSERT INTO exchange_rates (currency, rate) VALUES (?, ?)',
    [currency.toUpperCase(), parseFloat(rate)],
    function (err) {
      if (err) return next(err);
      res.status(201).json({
        success: true,
        data: { id: this.lastID, currency: currency.toUpperCase(), rate: parseFloat(rate) }
      });
    }
  );
});

router.put('/:id', (req, res, next) => {
  const { rate } = req.body;
  const id = req.params.id;

  if (rate === undefined || rate === null) {
    return next(new ValidationError('汇率不能为空'));
  }

  if (rate <= 0) {
    return next(new ValidationError('汇率必须大于0'));
  }

  db.run(
    'UPDATE exchange_rates SET rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [parseFloat(rate), id],
    function (err) {
      if (err) return next(err);
      if (this.changes === 0) {
        return next(new NotFoundError('汇率不存在'));
      }
      res.json({ success: true, message: '更新成功' });
    }
  );
});

router.delete('/:id', (req, res, next) => {
  db.get(
    'SELECT currency FROM exchange_rates WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) return next(err);
      if (!row) {
        return next(new NotFoundError('汇率不存在'));
      }
      if (row.currency === 'CNY') {
        return next(new ValidationError('人民币汇率不能删除'));
      }

      db.run('DELETE FROM exchange_rates WHERE id = ?', [req.params.id], function (err) {
        if (err) return next(err);
        res.json({ success: true, message: '删除成功' });
      });
    }
  );
});

module.exports = router;
