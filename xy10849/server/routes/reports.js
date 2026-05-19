const express = require('express');
const router = express.Router();
const db = require('../db');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

router.get('/overview', (req, res) => {
  const result = {};

  db.get('SELECT COUNT(*) as count FROM data_sources WHERE status = "active"', (err, row) => {
    result.active_data_sources = row.count;

    db.get('SELECT COUNT(*) as count FROM snippets', (err, row) => {
      result.total_snippets = row.count;

      db.get('SELECT COUNT(*) as count FROM snippets WHERE is_expired = 1', (err, row) => {
        result.expired_snippets = row.count;

        db.get('SELECT COUNT(*) as count FROM refresh_tasks WHERE status = "pending"', (err, row) => {
          result.pending_tasks = row.count;

          db.get('SELECT COUNT(*) as count FROM refresh_tasks WHERE status = "running"', (err, row) => {
            result.running_tasks = row.count;

            db.get('SELECT COUNT(*) as count FROM refresh_tasks WHERE status = "failed"', (err, row) => {
              result.failed_tasks = row.count;

              db.get('SELECT COUNT(*) as count FROM alerts WHERE is_resolved = 0', (err, row) => {
                result.active_alerts = row.count;

                const fresh_snippets = result.total_snippets - result.expired_snippets;
                result.freshness_rate = result.total_snippets > 0 ? (fresh_snippets / result.total_snippets * 100).toFixed(2) : 100;

                res.json(result);
              });
            });
          });
        });
      });
    });
  });
});

router.get('/freshness', (req, res) => {
  db.all(`
    SELECT 
      ds.id,
      ds.name,
      ds.type,
      COUNT(s.id) as total_snippets,
      SUM(CASE WHEN s.is_expired = 1 THEN 1 ELSE 0 END) as expired_snippets,
      AVG(s.freshness_score) as avg_freshness_score
    FROM data_sources ds
    LEFT JOIN snippets s ON ds.id = s.data_source_id
    WHERE ds.status = 'active'
    GROUP BY ds.id
    ORDER BY avg_freshness_score ASC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/export', (req, res) => {
  const exportDir = path.join(__dirname, '..', '..', 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const filename = `freshness-report-${Date.now()}.csv`;
  const filePath = path.join(exportDir, filename);

  db.all(`
    SELECT 
      s.id as snippet_id,
      ds.name as data_source_name,
      ds.type as data_source_type,
      s.content,
      s.freshness_score,
      s.is_expired,
      s.last_modified_at,
      s.created_at as snippet_created_at
    FROM snippets s
    JOIN data_sources ds ON s.data_source_id = ds.id
    ORDER BY s.freshness_score ASC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'snippet_id', title: 'Snippet ID' },
        { id: 'data_source_name', title: 'Data Source' },
        { id: 'data_source_type', title: 'Type' },
        { id: 'content', title: 'Content' },
        { id: 'freshness_score', title: 'Freshness Score' },
        { id: 'is_expired', title: 'Is Expired' },
        { id: 'last_modified_at', title: 'Last Modified' },
        { id: 'snippet_created_at', title: 'Created At' }
      ]
    });

    csvWriter.writeRecords(rows)
      .then(() => {
        res.json({ 
          success: true, 
          filename, 
          record_count: rows.length,
          download_url: `/exports/${filename}`
        });
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });
});

module.exports = router;
