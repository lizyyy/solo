const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const sql = `
    SELECT c.*, r.name as resident_name, r.phone as resident_phone
    FROM complaints c
    JOIN residents r ON c.resident_id = r.id
    ORDER BY c.created_at DESC
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { resident_id, related_id, related_type, reason } = req.body;

  if (!resident_id || !related_id || !related_type || !reason) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  if (!['inspection', 'exchange'].includes(related_type)) {
    return res.status(400).json({ error: '无效的申诉类型' });
  }

  if (related_type === 'inspection') {
    db.get('SELECT * FROM inspection_results WHERE id = ?', [related_id], (err, inspection) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!inspection) return res.status(404).json({ error: '抽检记录不存在' });

      if (inspection.is_qualified === 1) {
        return res.status(400).json({ error: '该抽检结果合格，无需申诉' });
      }

      db.get('SELECT * FROM complaints WHERE related_id = ? AND related_type = ?', 
        [related_id, related_type], (err, existing) => {
          if (err) return res.status(500).json({ error: err.message });
          
          if (existing && existing.status !== 'rejected') {
            return res.status(400).json({ error: '该记录已有申诉，无法重复申诉' });
          }

          createComplaint(resident_id, related_id, related_type, reason, res);
        });
    });
  } else {
    db.get('SELECT * FROM exchange_applications WHERE id = ?', [related_id], (err, application) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!application) return res.status(404).json({ error: '兑换申请不存在' });

      db.get('SELECT * FROM complaints WHERE related_id = ? AND related_type = ?', 
        [related_id, related_type], (err, existing) => {
          if (err) return res.status(500).json({ error: err.message });
          
          if (existing && existing.status !== 'rejected') {
            return res.status(400).json({ error: '该记录已有申诉，无法重复申诉' });
          }

          createComplaint(resident_id, related_id, related_type, reason, res);
        });
    });
  }
});

function createComplaint(resident_id, related_id, related_type, reason, res) {
  db.run(`
    INSERT INTO complaints (resident_id, related_id, related_type, reason)
    VALUES (?, ?, ?, ?)
  `, [resident_id, related_id, related_type, reason], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, message: '申诉已提交' });
  });
}

router.put('/:id/process', (req, res) => {
  const { status, process_result } = req.body;
  const id = req.params.id;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '无效的处理状态' });
  }

  db.get('SELECT * FROM complaints WHERE id = ?', [id], (err, complaint) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!complaint) return res.status(404).json({ error: '申诉不存在' });

    if (complaint.status !== 'pending') {
      return res.status(400).json({ error: '该申诉已处理，无法再次修改' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(`
        UPDATE complaints 
        SET status = ?, process_result = ?, process_time = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, process_result || '', id], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }

        if (status === 'approved' && complaint.related_type === 'inspection') {
          db.get('SELECT * FROM inspection_results WHERE id = ?', [complaint.related_id], (err, inspection) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            db.get('SELECT * FROM delivery_records WHERE id = ?', [inspection.delivery_id], (err, delivery) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }

              const returnPoints = Math.round(delivery.points * 0.5);

              db.run('UPDATE residents SET total_points = total_points + ? WHERE id = ?',
                [returnPoints, complaint.resident_id], (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                  }

                  db.run(`
                    INSERT INTO points_flow (resident_id, type, points, description, related_id)
                    VALUES (?, 'complaint_return', ?, ?, ?)
                  `, [complaint.resident_id, returnPoints, `申诉成功返还积分`, id], (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return res.status(500).json({ error: err.message });
                    }

                    db.run('COMMIT', (err) => {
                      if (err) return res.status(500).json({ error: err.message });
                      res.json({ 
                        message: '申诉已处理成功，积分已返还',
                        points_returned: returnPoints
                      });
                    });
                  });
                });
            });
          });
        } else {
          db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: status === 'approved' ? '申诉已批准' : '申诉已驳回' });
          });
        }
      });
    });
  });
});

module.exports = router;
