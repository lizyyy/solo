const express = require('express');
const router = express.Router();
const db = require('../database');
const { generateId, addTimeline, addModificationHistory, idempotentMiddleware, formatDate } = require('../utils');

router.get('/', (req, res) => {
  const { problem_id, reviewer, is_abnormal } = req.query;
  let query = `SELECT * FROM reviews WHERE 1=1`;
  const params = [];
  
  if (problem_id) {
    query += ` AND problem_id = ?`;
    params.push(problem_id);
  }
  if (reviewer) {
    query += ` AND reviewer = ?`;
    params.push(reviewer);
  }
  if (is_abnormal !== undefined) {
    query += ` AND is_abnormal = ?`;
    params.push(is_abnormal ? 1 : 0);
  }
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

router.post('/', idempotentMiddleware, (req, res) => {
  const { problem_id, rectification_id, reviewer, reviewer_phone, result, comment, is_abnormal, abnormal_reason, operator } = req.body;
  const id = generateId();
  const reviewedAt = formatDate();
  
  db.get(`SELECT * FROM problems WHERE id = ?`, [problem_id], async (err, problem) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!problem) return res.status(404).json({ error: '问题不存在' });
    
    const isAbnormal = is_abnormal ? 1 : 0;
    
    db.run(
      `INSERT INTO reviews (id, problem_id, rectification_id, reviewer, reviewer_phone, result, comment, is_abnormal, abnormal_reason, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, problem_id, rectification_id, reviewer, reviewer_phone, result, comment, isAbnormal, abnormal_reason, reviewedAt],
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          let newStatus = problem.status;
          let timelineAction = '';
          let timelineDesc = '';
          
          if (result === 'pass') {
            newStatus = 'closed';
            timelineAction = 'review_pass';
            timelineDesc = '复查通过，问题关闭';
          } else if (result === 'fail') {
            newStatus = 'reopen';
            timelineAction = 'review_fail';
            timelineDesc = '复查不通过，问题重新打开';
          }
          
          db.run(`UPDATE problems SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, problem_id]);
          await addModificationHistory('problem', problem_id, 'status', problem.status, newStatus, operator, 'status_change', timelineDesc);
          
          const details = { result, comment, is_abnormal: isAbnormal, abnormal_reason };
          await addTimeline('problem', problem_id, timelineAction, timelineDesc, operator, details);
          
          if (isAbnormal) {
            await addTimeline('problem', problem_id, 'mark_abnormal', `标记复查异常: ${abnormal_reason}`, operator, { abnormal_reason });
          }
          
          res.status(201).json({ id, result, is_abnormal: isAbnormal });
        }
      }
    );
  });
});

module.exports = router;
