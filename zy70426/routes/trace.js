const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.get('/operator/:operator', (req, res) => {
  const { operator } = req.params;

  db.all(`
    SELECT 
      ph.id as history_id,
      ph.record_id,
      ph.action,
      ph.operator,
      ph.operator_department,
      ph.before_status,
      ph.after_status,
      ph.remark,
      ph.receipt_data,
      ph.created_at as action_time,
      tr.batch_no,
      tr.source_system,
      tr.finance_type,
      tr.amount,
      tr.transfer_date,
      tr.handler,
      tr.status as current_status
    FROM process_history ph
    LEFT JOIN transfer_records tr ON ph.record_id = tr.id
    WHERE ph.operator = ?
    ORDER BY ph.created_at DESC
  `, [operator], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    rows.forEach(row => {
      if (row.receipt_data) {
        row.receipt_data = JSON.parse(row.receipt_data);
      }
    });

    res.json({
      operator,
      total_actions: rows.length,
      actions: rows
    });
  });
});

router.get('/record/:record_id/trace', (req, res) => {
  const { record_id } = req.params;

  db.get('SELECT * FROM transfer_records WHERE id = ?', [record_id], (err, record) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    db.all('SELECT * FROM process_history WHERE record_id = ? ORDER BY created_at ASC', [record_id], (err, history) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      db.all('SELECT * FROM material_summaries WHERE record_id = ? ORDER BY created_at ASC', [record_id], (err, summaries) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        history.forEach(h => {
          if (h.receipt_data) {
            h.receipt_data = JSON.parse(h.receipt_data);
          }
        });

        res.json({
          record,
          process_history: history,
          material_summaries: summaries,
          trace_chain: buildTraceChain(record, history, summaries)
        });
      });
    });
  });
});

function buildTraceChain(record, history, summaries) {
  const chain = [];
  
  chain.push({
    type: 'record_created',
    timestamp: record.created_at,
    description: `结转记录创建: ${record.batch_no} - ${record.finance_type}`,
    status: record.status
  });

  history.forEach(h => {
    chain.push({
      type: 'process_action',
      timestamp: h.created_at,
      description: `操作: ${h.action}`,
      operator: h.operator,
      before_status: h.before_status,
      after_status: h.after_status,
      remark: h.remark
    });
  });

  summaries.forEach(s => {
    chain.push({
      type: 'material_summary',
      timestamp: s.created_at,
      description: `材料摘要: ${s.summary_type}`,
      created_by: s.created_by,
      content: s.content
    });
  });

  return chain.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

router.post('/rollback/candidates', (req, res) => {
  const { record_id, reason, candidate_data, created_by } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO rollback_candidates (id, record_id, reason, candidate_data, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, record_id, reason, JSON.stringify(candidate_data), 'pending', created_by, now],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id,
        record_id,
        reason,
        status: 'pending',
        created_by,
        created_at: now,
        message: '回滚候选已创建，待确认后执行'
      });
    }
  );
});

router.get('/rollback/candidates', (req, res) => {
  const { status, created_by } = req.query;
  
  let query = `
    SELECT 
      rc.*,
      tr.batch_no,
      tr.finance_type,
      tr.amount,
      tr.status as record_status
    FROM rollback_candidates rc
    LEFT JOIN transfer_records tr ON rc.record_id = tr.id
    WHERE 1=1
  `;
  let params = [];

  if (status) {
    query += ' AND rc.status = ?';
    params.push(status);
  }
  if (created_by) {
    query += ' AND rc.created_by = ?';
    params.push(created_by);
  }

  query += ' ORDER BY rc.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    rows.forEach(row => {
      if (row.candidate_data) {
        row.candidate_data = JSON.parse(row.candidate_data);
      }
    });
    res.json(rows);
  });
});

router.post('/rollback/execute/:candidate_id', (req, res) => {
  const { candidate_id } = req.params;
  const { operator } = req.body;

  db.get('SELECT * FROM rollback_candidates WHERE id = ?', [candidate_id], (err, candidate) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!candidate) {
      return res.status(404).json({ error: '候选记录不存在' });
    }
    if (candidate.status !== 'pending') {
      return res.status(400).json({ error: '该候选已执行或已取消' });
    }

    const candidateData = JSON.parse(candidate.candidate_data);
    const now = new Date().toISOString();

    db.run(
      'UPDATE transfer_records SET status = ?, handler = ?, handler_department = ?, updated_at = ? WHERE id = ?',
      [candidateData.status || 'rollback', candidateData.handler, candidateData.handler_department, now, candidate.record_id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        const historyId = uuidv4();
        db.run(
          'INSERT INTO process_history (id, record_id, action, operator, before_status, after_status, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [historyId, candidate.record_id, 'rollback', operator, candidateData.before_status, candidateData.status, candidate.reason, now],
          function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }

            db.run(
              'UPDATE rollback_candidates SET status = ? WHERE id = ?',
              ['executed', candidate_id],
              function(err) {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                res.json({
                  candidate_id,
                  record_id: candidate.record_id,
                  status: 'completed',
                  message: '回滚操作执行完成'
                });
              }
            );
          }
        );
      }
    );
  });
});

module.exports = router;
