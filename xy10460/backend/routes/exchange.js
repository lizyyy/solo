const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/gifts', (req, res) => {
  db.all('SELECT * FROM exchange_gifts', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/gifts', (req, res) => {
  const { name, points_required, stock, description, image_url } = req.body;

  if (!name || !points_required) {
    return res.status(400).json({ error: '礼品名称和所需积分为必填' });
  }

  db.run(`
    INSERT INTO exchange_gifts (name, points_required, stock, description, image_url)
    VALUES (?, ?, ?, ?, ?)
  `, [name, points_required, stock || 0, description || '', image_url || ''], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, message: '礼品添加成功' });
  });
});

router.get('/applications', (req, res) => {
  const sql = `
    SELECT ea.*, r.name as resident_name, r.phone as resident_phone,
           eg.name as gift_name
    FROM exchange_applications ea
    JOIN residents r ON ea.resident_id = r.id
    JOIN exchange_gifts eg ON ea.gift_id = eg.id
    ORDER BY ea.apply_time DESC
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/applications', (req, res) => {
  const { resident_id, gift_id } = req.body;

  if (!resident_id || !gift_id) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  db.get('SELECT * FROM exchange_gifts WHERE id = ?', [gift_id], (err, gift) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!gift) return res.status(404).json({ error: '礼品不存在' });

    db.get('SELECT total_points FROM residents WHERE id = ?', [resident_id], (err, resident) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!resident) return res.status(404).json({ error: '居民不存在' });

      if (resident.total_points < gift.points_required) {
        return res.status(400).json({ 
          error: '积分不足',
          details: `您当前拥有${resident.total_points}积分，兑换${gift.name}需要${gift.points_required}积分，还差${gift.points_required - resident.total_points}积分`
        });
      }

      if (gift.stock <= 0) {
        return res.status(400).json({
          error: '库存不足',
          details: `${gift.name}当前库存不足，请稍后再试或选择其他礼品`
        });
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(`
          INSERT INTO exchange_applications (resident_id, gift_id, points_cost)
          VALUES (?, ?, ?)
        `, [resident_id, gift_id, gift.points_required], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          const applicationId = this.lastID;

          db.run('UPDATE residents SET total_points = total_points - ? WHERE id = ?',
            [gift.points_required, resident_id], (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }

              db.run(`
                INSERT INTO points_flow (resident_id, type, points, description, related_id)
                VALUES (?, 'exchange', ?, ?, ?)
              `, [resident_id, -gift.points_required, `申请兑换${gift.name}`, applicationId], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }

                db.run('COMMIT', (err) => {
                  if (err) return res.status(500).json({ error: err.message });
                  res.json({ 
                    message: '兑换申请已提交',
                    application_id: applicationId,
                    points_cost: gift.points_required
                  });
                });
              });
            });
        });
      });
    });
  });
});

router.put('/applications/:id/process', (req, res) => {
  const { status, reject_reason } = req.body;
  const id = req.params.id;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '无效的处理状态' });
  }

  db.get('SELECT * FROM exchange_applications WHERE id = ?', [id], (err, application) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!application) return res.status(404).json({ error: '申请不存在' });

    if (application.status !== 'pending') {
      return res.status(400).json({ error: '该申请已处理，无法再次修改' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(`
        UPDATE exchange_applications 
        SET status = ?, reject_reason = ?, process_time = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, reject_reason || null, id], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }

        if (status === 'rejected') {
          db.run('UPDATE residents SET total_points = total_points + ? WHERE id = ?',
            [application.points_cost, application.resident_id], (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }

              db.run(`
                INSERT INTO points_flow (resident_id, type, points, description, related_id)
                VALUES (?, 'exchange_refund', ?, ?, ?)
              `, [application.resident_id, application.points_cost, `兑换申请被驳回，积分返还`, id], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }

                db.run('COMMIT', (err) => {
                  if (err) return res.status(500).json({ error: err.message });
                  res.json({ 
                    message: '申请已驳回，积分已返还',
                    points_returned: application.points_cost
                  });
                });
              });
            });
        } else {
          db.get('SELECT * FROM exchange_gifts WHERE id = ?', [application.gift_id], (err, gift) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            if (gift.stock <= 0) {
              db.run('ROLLBACK');
              return res.status(400).json({ 
                error: '库存不足',
                details: `${gift.name}当前库存不足，无法完成兑换`
              });
            }

            db.run('UPDATE exchange_gifts SET stock = stock - 1 WHERE id = ?', [application.gift_id], (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }

              db.run('COMMIT', (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: '兑换申请已通过' });
              });
            });
          });
        }
      });
    });
  });
});

module.exports = router;
