const express = require('express');
const router = express.Router();
const db = require('../database');
const XLSX = require('xlsx');

router.get('/stats', (req, res) => {
  db.serialize(() => {
    const stats = {};

    db.get('SELECT COUNT(*) as count FROM residents', (err, row) => {
      stats.totalResidents = row.count;

      db.get('SELECT SUM(total_points) as total FROM residents', (err, row) => {
        stats.totalPoints = row.total || 0;

        db.get(`SELECT COUNT(*) as count FROM exchange_applications WHERE status = 'pending'`, (err, row) => {
          stats.pendingExchanges = row.count;

          db.get(`
            SELECT COUNT(*) as count 
            FROM inspection_results 
            WHERE is_qualified = 0 
            AND DATE(inspect_time) = DATE('now')
          `, (err, row) => {
            stats.todayUnqualified = row.count;

            db.get(`
              SELECT COUNT(*) as count 
              FROM complaints 
              WHERE status = 'pending'
            `, (err, row) => {
              stats.pendingComplaints = row.count;

              db.all(`
                SELECT r.name, r.total_points, r.phone
                FROM residents r
                ORDER BY r.total_points DESC
                LIMIT 10
              `, (err, rows) => {
                stats.topResidents = rows;

                db.all(`
                  SELECT garbage_type, COUNT(*) as count, SUM(weight) as total_weight
                  FROM delivery_records
                  WHERE DATE(delivery_time) >= DATE('now', '-7 days')
                  GROUP BY garbage_type
                `, (err, rows) => {
                  stats.weeklyTrend = rows;

                  res.json(stats);
                });
              });
            });
          });
        });
      });
    });
  });
});

router.get('/abnormal-inspections', (req, res) => {
  const sql = `
    SELECT ir.*, dr.garbage_type, dr.weight, dr.points, dr.delivery_time,
           r.name as resident_name, r.phone as resident_phone
    FROM inspection_results ir
    JOIN delivery_records dr ON ir.delivery_id = dr.id
    JOIN residents r ON dr.resident_id = r.id
    WHERE ir.is_qualified = 0
    ORDER BY ir.inspect_time DESC
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/pending-exchanges', (req, res) => {
  const sql = `
    SELECT ea.*, r.name as resident_name, r.phone as resident_phone,
           eg.name as gift_name, eg.description as gift_description
    FROM exchange_applications ea
    JOIN residents r ON ea.resident_id = r.id
    JOIN exchange_gifts eg ON ea.gift_id = eg.id
    WHERE ea.status = 'pending'
    ORDER BY ea.apply_time ASC
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/monthly-report/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = `${year}-${(parseInt(month) + 1).toString().padStart(2, '0')}-01`;

  const sql = `
    SELECT 
      r.id as resident_id,
      r.name as resident_name,
      r.phone,
      r.address,
      COALESCE(SUM(CASE WHEN pf.type = 'delivery' AND pf.record_time >= ? AND pf.record_time < ? THEN pf.points ELSE 0 END), 0) as earned_points,
      COALESCE(SUM(CASE WHEN pf.type = 'deduction' AND pf.record_time >= ? AND pf.record_time < ? THEN pf.points ELSE 0 END), 0) as deducted_points,
      COALESCE(SUM(CASE WHEN pf.type = 'exchange' AND pf.record_time >= ? AND pf.record_time < ? THEN pf.points ELSE 0 END), 0) as exchanged_points,
      COALESCE(SUM(CASE WHEN pf.type = 'exchange_refund' AND pf.record_time >= ? AND pf.record_time < ? THEN pf.points ELSE 0 END), 0) as refund_points,
      COALESCE(SUM(CASE WHEN pf.type = 'complaint_return' AND pf.record_time >= ? AND pf.record_time < ? THEN pf.points ELSE 0 END), 0) as complaint_return_points,
      r.total_points as current_total
    FROM residents r
    LEFT JOIN points_flow pf ON r.id = pf.resident_id
    GROUP BY r.id
    ORDER BY r.name
  `;

  db.all(sql, [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/monthly-report/:year/:month/export', (req, res) => {
  const { year, month } = req.params;
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = `${year}-${(parseInt(month) + 1).toString().padStart(2, '0')}-01`;

  const sql = `
    SELECT 
      r.name as 居民姓名,
      r.phone as 联系电话,
      r.address as 住址,
      COALESCE(SUM(CASE WHEN pf.type = 'delivery' AND pf.record_time >= ? AND pf.record_time < ? THEN pf.points ELSE 0 END), 0) as 获得积分,
      COALESCE(SUM(CASE WHEN pf.type = 'deduction' AND pf.record_time >= ? AND pf.record_time < ? THEN pf.points ELSE 0 END), 0) as 扣除积分,
      COALESCE(SUM(CASE WHEN pf.type = 'exchange' AND pf.record_time >= ? AND pf.record_time < ? THEN pf.points ELSE 0 END), 0) as 兑换积分,
      COALESCE(SUM(CASE WHEN pf.type = 'exchange_refund' AND pf.record_time >= ? AND pf.record_time < ? THEN pf.points ELSE 0 END), 0) as 返还积分,
      COALESCE(SUM(CASE WHEN pf.type = 'complaint_return' AND pf.record_time >= ? AND pf.record_time < ? THEN pf.points ELSE 0 END), 0) as 申诉返还积分,
      r.total_points as 当前积分
    FROM residents r
    LEFT JOIN points_flow pf ON r.id = pf.resident_id
    GROUP BY r.id
    ORDER BY r.name
  `;

  db.all(sql, [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${year}年${month}月积分表`);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${year}年${month}月积分表.xlsx`);
    res.send(buffer);
  });
});

module.exports = router;
