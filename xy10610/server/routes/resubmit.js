const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const { review_status, page = 1, limit = 20 } = req.query;
    let sql = `
      SELECT r.*, p.tracking_number, p.receiver_name, p.declared_value
      FROM re_submissions r
      LEFT JOIN packages p ON r.package_id = p.id
      WHERE 1=1
    `;
    let params = [];

    if (review_status) {
      sql += ' AND r.review_status = ?';
      params.push(review_status);
    }

    sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const resubmissions = await allQuery(sql, params);

    const countSql = sql.replace('SELECT r.*, p.tracking_number, p.receiver_name, p.declared_value', 'SELECT COUNT(*) as total').split(' ORDER BY ')[0].split(' LIMIT ')[0];
    const countResult = await getQuery(countSql, params.slice(0, params.length - 2));

    res.json({
      data: resubmissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/review', async (req, res) => {
  try {
    const { review_status, reviewed_by, notes } = req.body;
    const resubmit = await getQuery('SELECT * FROM re_submissions WHERE id = ?', [req.params.id]);
    
    if (!resubmit) {
      return res.status(404).json({ error: '重提申请不存在' });
    }

    await runQuery(
      'UPDATE re_submissions SET review_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, notes = ? WHERE id = ?',
      [review_status, reviewed_by || 'system', notes || '', req.params.id]
    );

    await runQuery(
      `INSERT INTO operation_logs (id, package_id, operation_type, operator, details)
       VALUES (?, ?, 'resubmit_review', ?, ?)`,
      [uuidv4(), resubmit.package_id, reviewed_by || 'system', JSON.stringify({ 
        resubmit_id: req.params.id, 
        review_status, 
        notes 
      })]
    );

    if (review_status === 'approved') {
      await runQuery(
        'UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['resubmitted', resubmit.package_id]
      );
    } else if (review_status === 'rejected') {
      await runQuery(
        'UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['resubmit_rejected', resubmit.package_id]
      );
    }

    const updatedResubmit = await getQuery('SELECT * FROM re_submissions WHERE id = ?', [req.params.id]);
    res.json(updatedResubmit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
