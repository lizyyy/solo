const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.post('/preview', (req, res) => {
  const { batch_no, action_type, filter_condition, created_by } = req.body;
  const id = uuidv4();
  
  let query = 'SELECT id, batch_no, source_system, finance_type, amount, handler, status FROM transfer_records WHERE 1=1';
  let params = [];

  if (batch_no) {
    query += ' AND batch_no = ?';
    params.push(batch_no);
  }

  if (filter_condition && filter_condition.status) {
    query += ' AND status = ?';
    params.push(filter_condition.status);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const affectedIds = rows.map(r => r.id).join(',');
    const previewData = JSON.stringify(rows);

    db.run(
      'INSERT INTO batch_previews (id, batch_no, action_type, affected_count, affected_ids, preview_data, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, batch_no || 'all', action_type, rows.length, affectedIds, previewData, created_by],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          preview_id: id,
          batch_no: batch_no || 'all',
          action_type,
          affected_count: rows.length,
          affected_records: rows,
          status: 'pending',
          message: '预览已生成，请确认后执行'
        });
      }
    );
  });
});

router.post('/execute/:preview_id', (req, res) => {
  const { preview_id } = req.params;
  const { operator, remark } = req.body;

  db.get('SELECT * FROM batch_previews WHERE id = ?', [preview_id], (err, preview) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!preview) {
      return res.status(404).json({ error: '预览记录不存在' });
    }
    if (preview.status !== 'pending') {
      return res.status(400).json({ error: '该预览已执行或已取消' });
    }

    const affectedIds = preview.affected_ids.split(',');
    const now = new Date().toISOString();
    let successCount = 0;

    const updatePromises = affectedIds.map(id => {
      return new Promise((resolve, reject) => {
        db.get('SELECT * FROM transfer_records WHERE id = ?', [id], (err, record) => {
          if (err) return reject(err);
          if (!record) return resolve(null);

          const beforeStatus = record.status;
          let afterStatus = beforeStatus;
          
          if (preview.action_type === 'reprocess') {
            afterStatus = 'processing';
          } else if (preview.action_type === 'mark_resolved') {
            afterStatus = 'success';
          }

          db.run(
            'UPDATE transfer_records SET status = ?, updated_at = ? WHERE id = ?',
            [afterStatus, now, id],
            function(err) {
              if (err) return reject(err);
              
              const historyId = uuidv4();
              db.run(
                'INSERT INTO process_history (id, record_id, action, operator, before_status, after_status, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [historyId, id, preview.action_type, operator, beforeStatus, afterStatus, remark, now],
                function(err) {
                  if (err) return reject(err);
                  successCount++;
                  resolve(id);
                }
              );
            }
          );
        });
      });
    });

    Promise.all(updatePromises)
      .then(() => {
        db.run(
          'UPDATE batch_previews SET status = ? WHERE id = ?',
          ['executed', preview_id],
          function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            res.json({
              preview_id,
              action_type: preview.action_type,
              total_affected: preview.affected_count,
              success_count: successCount,
              status: 'completed',
              message: '批量操作执行完成'
            });
          }
        );
      })
      .catch(err => {
        res.status(500).json({ error: err.message });
      });
  });
});

router.get('/previews', (req, res) => {
  db.all('SELECT * FROM batch_previews ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    rows.forEach(row => {
      if (row.preview_data) {
        row.preview_data = JSON.parse(row.preview_data);
      }
    });
    res.json(rows);
  });
});

module.exports = router;
