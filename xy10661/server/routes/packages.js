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

router.get('/', (req, res) => {
  const { status, waybill_no, page = 1, limit = 20 } = req.query;
  let query = 'SELECT * FROM packages WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (waybill_no) {
    query += ' AND waybill_no LIKE ?';
    params.push(`%${waybill_no}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.get('SELECT COUNT(*) as total FROM packages', (err, countResult) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        data: rows,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    });
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM packages WHERE id = ? OR waybill_no = ?', [id, id], (err, pkg) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!pkg) {
      res.status(404).json({ error: '包裹不存在' });
      return;
    }

    db.all('SELECT * FROM sorting_slots WHERE package_id = ?', [pkg.id], (err, slots) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.all('SELECT * FROM weight_records WHERE package_id = ?', [pkg.id], (err, weights) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        db.all('SELECT * FROM scan_logs WHERE package_id = ? ORDER BY scan_time DESC', [pkg.id], (err, scans) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          db.all('SELECT * FROM manual_reviews WHERE package_id = ? ORDER BY review_time DESC', [pkg.id], (err, reviews) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            db.all('SELECT * FROM rethrow_records WHERE package_id = ? ORDER BY rethrow_time DESC', [pkg.id], (err, rethrows) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }
              db.all('SELECT * FROM status_history WHERE package_id = ? ORDER BY operate_time DESC', [pkg.id], (err, history) => {
                if (err) {
                  res.status(500).json({ error: err.message });
                  return;
                }
                res.json({
                  package: pkg,
                  sortingSlots: slots,
                  weightRecords: weights,
                  scanLogs: scans,
                  manualReviews: reviews,
                  rethrowRecords: rethrows,
                  statusHistory: history
                });
              });
            });
          });
        });
      });
    });
  });
});

router.post('/scan', (req, res) => {
  const { waybill_no, scan_type, scanner, location, callback_id } = req.body;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');

  if (callback_id) {
    db.get('SELECT * FROM scan_logs WHERE callback_id = ?', [callback_id], (err, existing) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (existing) {
        res.json({
          success: true,
          message: '重复回调，已跳过处理',
          duplicate: true,
          scanLog: existing
        });
        return;
      }
      processScan();
    });
  } else {
    processScan();
  }

  function processScan() {
    db.get('SELECT * FROM packages WHERE waybill_no = ?', [waybill_no], (err, pkg) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (!pkg) {
        const intercepted = 1;
        const intercept_reason = '包裹面单不存在';
        
        db.run(
          'INSERT INTO scan_logs (package_id, scan_type, scan_time, scanner, location, status, intercepted, intercept_reason, callback_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [0, scan_type, now, scanner, location, 'failed', intercepted, intercept_reason, callback_id, now],
          function(err) {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            res.status(400).json({
              success: false,
              message: intercept_reason,
              intercepted: true,
              intercept_reason
            });
          }
        );
        return;
      }

      const intercepted = pkg.status === 'exception' ? 1 : 0;
      const intercept_reason = intercepted ? '包裹处于异常状态，需先复核' : null;

      db.run(
        'INSERT INTO scan_logs (package_id, scan_type, scan_time, scanner, location, status, intercepted, intercept_reason, callback_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [pkg.id, scan_type, now, scanner, location, 'success', intercepted, intercept_reason, callback_id, now],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          if (intercepted) {
            res.json({
              success: true,
              message: '扫码已拦截',
              intercepted: true,
              intercept_reason,
              packageId: pkg.id
            });
            return;
          }

          const newStatus = scan_type === 'sorting' ? 'sorting' : 
                           scan_type === 'weighting' ? 'weighting' : pkg.status;
          
          db.run(
            'UPDATE packages SET status = ?, updated_at = ? WHERE id = ?',
            [newStatus, now, pkg.id],
            (err) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }

              db.run(
                'INSERT INTO status_history (package_id, status, status_text, operator, operate_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [pkg.id, newStatus, statusMap[newStatus], scanner, now, `扫码类型: ${scan_type}`, now],
                (err) => {
                  if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                  }
                  res.json({
                    success: true,
                    message: '扫码成功',
                    packageId: pkg.id,
                    newStatus,
                    scanLogId: this.lastID
                  });
                }
              );
            }
          );
        }
      );
    });
  }
});

router.post('/:id/sorting', (req, res) => {
  const { id } = req.params;
  const { slot_code, slot_name, operator } = req.body;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');

  db.get('SELECT * FROM packages WHERE id = ?', [id], (err, pkg) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!pkg) {
      res.status(404).json({ error: '包裹不存在' });
      return;
    }

    const originalData = JSON.stringify({ status: pkg.status });

    db.run(
      'INSERT INTO sorting_slots (package_id, slot_code, slot_name, status, sorted_at, created_at, updated_at, original_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, slot_code, slot_name, 'sorted', now, now, now, originalData],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        const newStatus = 'weighting';
        const modifiedData = JSON.stringify({ status: newStatus, slot_code });

        db.run(
          'UPDATE packages SET status = ?, updated_at = ?, modified_data = ? WHERE id = ?',
          [newStatus, now, modifiedData, id],
          (err) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            db.run(
              'UPDATE sorting_slots SET modified_data = ? WHERE id = ?',
              [modifiedData, this.lastID],
              (err) => {
                if (err) {
                  res.status(500).json({ error: err.message });
                  return;
                }
              }
            );

            db.run(
              'INSERT INTO status_history (package_id, status, status_text, operator, operate_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [id, newStatus, statusMap[newStatus], operator, now, `分拣格口: ${slot_code}`, now],
              (err) => {
                if (err) {
                  res.status(500).json({ error: err.message });
                  return;
                }
                res.json({
                  success: true,
                  message: '分拣完成',
                  slotId: this.lastID,
                  newStatus
                });
              }
            );
          }
        );
      }
    );
  });
});

router.post('/:id/weight', (req, res) => {
  const { id } = req.params;
  const { weight, operator } = req.body;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');

  db.get('SELECT * FROM packages WHERE id = ?', [id], (err, pkg) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!pkg) {
      res.status(404).json({ error: '包裹不存在' });
      return;
    }

    const originalData = JSON.stringify({ weight: pkg.weight, status: pkg.status });

    db.run(
      'INSERT INTO weight_records (package_id, weight, weight_time, operator, status, created_at, updated_at, original_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, weight, now, operator, 'normal', now, now, originalData],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        const isAbnormal = weight < 0.1 || weight > 50;
        const newStatus = isAbnormal ? 'exception' : 'completed';
        const modifiedData = JSON.stringify({ weight, status: newStatus });

        db.run(
          'UPDATE packages SET weight = ?, status = ?, updated_at = ?, modified_data = ? WHERE id = ?',
          [weight, newStatus, now, modifiedData, id],
          (err) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            db.run(
              'INSERT INTO status_history (package_id, status, status_text, operator, operate_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [id, newStatus, statusMap[newStatus], operator, now, `称重: ${weight}kg${isAbnormal ? ' - 异常' : ''}`, now],
              (err) => {
                if (err) {
                  res.status(500).json({ error: err.message });
                  return;
                }
                res.json({
                  success: true,
                  message: isAbnormal ? '称重异常，需复核' : '称重完成',
                  weightId: this.lastID,
                  newStatus,
                  isAbnormal
                });
              }
            );
          }
        );
      }
    );
  });
});

router.post('/:id/rethrow', (req, res) => {
  const { id } = req.params;
  const { operator, reason } = req.body;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');

  db.get('SELECT * FROM packages WHERE id = ?', [id], (err, pkg) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!pkg) {
      res.status(404).json({ error: '包裹不存在' });
      return;
    }

    const previousStatus = pkg.status;
    const newStatus = 'scanning';
    const originalData = JSON.stringify({ status: previousStatus });
    const modifiedData = JSON.stringify({ status: newStatus });

    db.run(
      'INSERT INTO rethrow_records (package_id, rethrow_time, operator, reason, previous_status, new_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, now, operator, reason, previousStatus, newStatus, now],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        db.run(
          'UPDATE packages SET status = ?, updated_at = ?, original_data = ?, modified_data = ? WHERE id = ?',
          [newStatus, now, originalData, modifiedData, id],
          (err) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            db.run(
              'INSERT INTO status_history (package_id, status, status_text, operator, operate_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [id, newStatus, statusMap[newStatus], operator, now, `重新投线: ${reason}`, now],
              (err) => {
                if (err) {
                  res.status(500).json({ error: err.message });
                  return;
                }
                res.json({
                  success: true,
                  message: '重新投线成功',
                  rethrowId: this.lastID,
                  newStatus
                });
              }
            );
          }
        );
      }
    );
  });
});

router.get('/:id/timeline', (req, res) => {
  const { id } = req.params;
  
  db.all(`
    SELECT 
      'scan' as type,
      scan_time as time,
      scanner as operator,
      scan_type as action,
      CASE WHEN intercepted = 1 THEN '拦截' ELSE status END as result,
      intercept_reason as notes
    FROM scan_logs
    WHERE package_id = ?
    
    UNION ALL
    
    SELECT 
      'sorting' as type,
      sorted_at as time,
      '' as operator,
      '分拣' as action,
      status as result,
      slot_code as notes
    FROM sorting_slots
    WHERE package_id = ?
    
    UNION ALL
    
    SELECT 
      'weight' as type,
      weight_time as time,
      operator,
      '称重' as action,
      status as result,
      weight || 'kg' as notes
    FROM weight_records
    WHERE package_id = ?
    
    UNION ALL
    
    SELECT 
      'review' as type,
      review_time as time,
      reviewer as operator,
      '复核' as action,
      review_result as result,
      review_notes as notes
    FROM manual_reviews
    WHERE package_id = ?
    
    UNION ALL
    
    SELECT 
      'rethrow' as type,
      rethrow_time as time,
      operator,
      '重新投线' as action,
      new_status as result,
      reason as notes
    FROM rethrow_records
    WHERE package_id = ?
    
    UNION ALL
    
    SELECT 
      'status' as type,
      operate_time as time,
      operator,
      '状态变更' as action,
      status_text as result,
      notes
    FROM status_history
    WHERE package_id = ?
    
    ORDER BY time DESC
  `, [id, id, id, id, id, id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ timeline: rows });
  });
});

module.exports = router;
