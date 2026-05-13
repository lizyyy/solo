const express = require('express');
const router = express.Router();
const db = require('../database/db');
const moment = require('moment');

const statusMap = {
  pending: '待处理',
  scanning: '扫码中',
  sorting: '分拣中',
  weighting: '称重中',
  exception: '异常',
  reviewing: '复核中',
  rethrowing: '重新投线',
  completed: '已完成'
};

router.post('/:packageId', (req, res) => {
  const { packageId } = req.params;
  const { reviewer, review_result, review_notes, responsible_party, corrected_weight } = req.body;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');

  db.get('SELECT * FROM packages WHERE id = ?', [packageId], (err, pkg) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!pkg) {
      res.status(404).json({ error: '包裹不存在' });
      return;
    }

    const beforeData = JSON.stringify({
      weight: pkg.weight,
      status: pkg.status
    });

    let newStatus = 'reviewing';
    if (review_result === 'pass') {
      newStatus = 'completed';
    } else if (review_result === 'reject') {
      newStatus = 'rethrowing';
    }

    const afterData = JSON.stringify({
      weight: corrected_weight || pkg.weight,
      status: newStatus,
      review_result
    });

    db.run(
      'INSERT INTO manual_reviews (package_id, reviewer, review_time, review_result, review_notes, responsible_party, before_data, after_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [packageId, reviewer, now, review_result, review_notes, responsible_party, beforeData, afterData, now],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        const updateParams = [newStatus, now, afterData, packageId];
        let updateQuery = 'UPDATE packages SET status = ?, updated_at = ?, modified_data = ?';
        
        if (corrected_weight) {
          updateQuery += ', weight = ?, original_data = ?';
          updateParams.splice(3, 0, corrected_weight, beforeData);
        }
        updateQuery += ' WHERE id = ?';

        db.run(updateQuery, updateParams, (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          db.run(
            'INSERT INTO status_history (package_id, status, status_text, operator, operate_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [packageId, newStatus, statusMap[newStatus], reviewer, now, `复核结果: ${review_result === 'pass' ? '通过' : '驳回'}, 责任方: ${responsible_party}`, now],
            (err) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }
              res.json({
                success: true,
                message: '复核完成',
                reviewId: this.lastID,
                newStatus
              });
            }
          );
        });
      }
    );
  });
});

router.get('/:packageId', (req, res) => {
  const { packageId } = req.params;
  
  db.all('SELECT * FROM manual_reviews WHERE package_id = ? ORDER BY review_time DESC', [packageId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ reviews: rows });
  });
});

router.get('/stats/summary', (req, res) => {
  db.get('SELECT COUNT(*) as total FROM packages', (err, totalResult) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.get('SELECT COUNT(*) as exception FROM packages WHERE status = ?', ['exception'], (err, exceptionResult) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.get('SELECT COUNT(*) as reviewing FROM packages WHERE status = ?', ['reviewing'], (err, reviewingResult) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        db.get('SELECT COUNT(*) as reviewed FROM manual_reviews', (err, reviewedResult) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({
            total: totalResult.total,
            exception: exceptionResult.exception,
            reviewing: reviewingResult.reviewing,
            reviewed: reviewedResult.total
          });
        });
      });
    });
  });
});

module.exports = router;
