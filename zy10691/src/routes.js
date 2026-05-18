const express = require('express');
const router = express.Router();
const { db } = require('./database');

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

router.post('/scan-results', async (req, res) => {
  try {
    const { repository_id, rule_id, file_path, line_number, commit_hash } = req.body;
    
    const existingClosed = await queryAsync(`
      SELECT sr.*, vr.version as current_rule_version
      FROM scan_results sr
      JOIN vulnerability_rules vr ON sr.rule_id = vr.rule_id
      WHERE sr.repository_id = ? 
        AND sr.rule_id = ? 
        AND sr.status = 'FALSE_POSITIVE'
      ORDER BY sr.created_at DESC
      LIMIT 1
    `, [repository_id, rule_id]);

    let status = 'OPEN';
    if (existingClosed.length > 0) {
      const closedResult = existingClosed[0];
      if (closedResult.file_path === file_path && closedResult.commit_hash === commit_hash) {
        return res.json({ 
          message: '同一漏洞在相同条件下已被标记为误报，保持原有状态',
          scan_result_id: closedResult.id,
          status: 'FALSE_POSITIVE'
        });
      }
    }

    const result = await runAsync(`
      INSERT INTO scan_results (repository_id, rule_id, file_path, line_number, commit_hash, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [repository_id, rule_id, file_path, line_number, commit_hash, status]);

    res.status(201).json({ id: result.lastID, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/scan-results/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewer, review_type, comment } = req.body;

    const scanResults = await queryAsync('SELECT * FROM scan_results WHERE id = ?', [id]);
    if (scanResults.length === 0) {
      return res.status(404).json({ error: '扫描结果不存在' });
    }

    const scanResult = scanResults[0];
    const previousStatus = scanResult.status;
    
    let newStatus;
    switch (review_type) {
      case 'SUBMIT':
        newStatus = 'REVIEWING';
        break;
      case 'CLOSE':
        newStatus = 'FALSE_POSITIVE';
        break;
      case 'REOPEN':
        newStatus = 'OPEN';
        break;
      default:
        return res.status(400).json({ error: '无效的复核类型' });
    }

    const rules = await queryAsync('SELECT version FROM vulnerability_rules WHERE rule_id = ?', [scanResult.rule_id]);
    const ruleVersion = rules.length > 0 ? rules[0].version : 'unknown';

    await runAsync(`
      INSERT INTO review_records 
      (scan_result_id, reviewer, review_type, comment, previous_status, new_status, rule_version_at_review, file_path_at_review)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, reviewer, review_type, comment, previousStatus, newStatus, ruleVersion, scanResult.file_path]);

    await runAsync('UPDATE scan_results SET status = ? WHERE id = ?', [newStatus, id]);

    res.json({
      scan_result_id: id,
      previous_status: previousStatus,
      new_status: newStatus,
      reviewer,
      review_type,
      comment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/scan-results', async (req, res) => {
  try {
    const { repository_id, rule_id, status, file_path, page = 1, limit = 20 } = req.query;
    
    let sql = `
      SELECT sr.*, r.name as repository_name, vr.name as rule_name, vr.severity, vr.version as rule_version
      FROM scan_results sr
      JOIN repositories r ON sr.repository_id = r.id
      JOIN vulnerability_rules vr ON sr.rule_id = vr.rule_id
      WHERE 1=1
    `;
    let params = [];

    if (repository_id) {
      sql += ' AND sr.repository_id = ?';
      params.push(repository_id);
    }
    if (rule_id) {
      sql += ' AND sr.rule_id = ?';
      params.push(rule_id);
    }
    if (status) {
      sql += ' AND sr.status = ?';
      params.push(status);
    }
    if (file_path) {
      sql += ' AND sr.file_path LIKE ?';
      params.push(`%${file_path}%`);
    }

    sql += ' ORDER BY sr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const results = await queryAsync(sql, params);

    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY.*LIMIT.*/, '');
    const countResult = await queryAsync(countSql, params.slice(0, -2));

    res.json({
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/scan-results/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const reviews = await queryAsync(`
      SELECT * FROM review_records 
      WHERE scan_result_id = ? 
      ORDER BY created_at DESC
    `, [id]);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/repositories', async (req, res) => {
  try {
    const repos = await queryAsync('SELECT * FROM repositories ORDER BY created_at DESC');
    res.json(repos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/vulnerability-rules', async (req, res) => {
  try {
    const rules = await queryAsync('SELECT * FROM vulnerability_rules ORDER BY created_at DESC');
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
