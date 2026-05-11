const express = require('express');
const router = express.Router();
const db = require('../database');

const POINTS_CONFIG = {
  '可回收物': 2,
  '厨余垃圾': 1,
  '其他垃圾': 0.5,
  '有害垃圾': 5
};

router.get('/', (req, res) => {
  const sql = `
    SELECT dr.*, r.name as resident_name, 
           CASE WHEN ir.id IS NOT NULL THEN 1 ELSE 0 END as has_inspection,
           ir.is_qualified, ir.problem_description
    FROM delivery_records dr
    JOIN residents r ON dr.resident_id = r.id
    LEFT JOIN inspection_results ir ON dr.id = ir.delivery_id
    ORDER BY dr.delivery_time DESC
  `;
  
  db.all(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { resident_id, garbage_type, weight } = req.body;
  
  if (!resident_id || !garbage_type || !weight) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  if (!POINTS_CONFIG[garbage_type]) {
    return res.status(400).json({ error: '未知的垃圾类型' });
  }

  const checkSql = `
    SELECT * FROM delivery_records 
    WHERE resident_id = ? AND garbage_type = ? 
    AND DATE(delivery_time) = DATE('now')
    LIMIT 1
  `;

  db.get(checkSql, [resident_id, garbage_type], (err, existingRecord) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (existingRecord) {
      return res.status(400).json({ 
        error: '重复投递',
        details: `该居民今日已投递过${garbage_type}，请勿重复投递`
      });
    }

    const points = Math.round(POINTS_CONFIG[garbage_type] * weight);

    db.serialize(() => {
      const beginStmt = db.prepare('BEGIN TRANSACTION');
      beginStmt.run();

      const insertDelivery = db.prepare(`
        INSERT INTO delivery_records (resident_id, garbage_type, weight, points)
        VALUES (?, ?, ?, ?)
      `);

      insertDelivery.run([resident_id, garbage_type, weight, points], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }

        const deliveryId = this.lastID;

        db.run('UPDATE residents SET total_points = total_points + ? WHERE id = ?',
          [points, resident_id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            const insertFlow = db.prepare(`
              INSERT INTO points_flow (resident_id, type, points, description, related_id)
              VALUES (?, 'delivery', ?, ?, ?)
            `);

            insertFlow.run([resident_id, points, `投递${garbage_type} ${weight}kg`, deliveryId], (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }

              db.run('COMMIT', (err) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                res.json({ 
                  message: '投递成功',
                  delivery_id: deliveryId,
                  points_earned: points
                });
              });
            });
          });
      });
    });
  });
});

router.post('/inspection', (req, res) => {
  const { delivery_id, is_qualified, problem_description } = req.body;

  if (!delivery_id || is_qualified === undefined) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  db.get('SELECT * FROM delivery_records WHERE id = ?', [delivery_id], (err, delivery) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!delivery) return res.status(404).json({ error: '投递记录不存在' });

    db.get('SELECT * FROM inspection_results WHERE delivery_id = ?', [delivery_id], (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });

      if (existing) {
        return res.status(400).json({ error: '该投递记录已有抽检结果' });
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(`
          INSERT INTO inspection_results (delivery_id, is_qualified, problem_description)
          VALUES (?, ?, ?)
        `, [delivery_id, is_qualified ? 1 : 0, problem_description || ''], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          if (!is_qualified) {
            const deductPoints = Math.round(delivery.points * 0.5);
            
            db.run('UPDATE residents SET total_points = total_points - ? WHERE id = ?',
              [deductPoints, delivery.resident_id], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }

                db.run(`
                  INSERT INTO points_flow (resident_id, type, points, description, related_id)
                  VALUES (?, 'deduction', ?, ?, ?)
                `, [delivery.resident_id, -deductPoints, `抽检不合格扣除积分: ${problem_description || '混投'}`, delivery_id], (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                  }

                  db.run('COMMIT', (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ 
                      message: '抽检结果已记录，已扣除混投积分',
                      points_deducted: deductPoints
                    });
                  });
                });
              });
          } else {
            db.run('COMMIT', (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ message: '抽检结果已记录，投递合格' });
            });
          }
        });
      });
    });
  });
});

router.get('/points-config', (req, res) => {
  res.json(POINTS_CONFIG);
});

module.exports = router;
