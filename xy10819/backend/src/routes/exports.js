const express = require('express');
const router = express.Router();
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const db = require('../config/database');
const { saveExport } = require('../utils/file-utils');

router.get('/batch/:batchId/csv', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const batch = await db.get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const results = await db.all(`
      SELECT er.*, s.name as step_name, s.method, s.url
      FROM execution_results er
      LEFT JOIN steps s ON er.step_id = s.id
      WHERE er.batch_id = ?
      ORDER BY er.executed_at ASC
    `, [batchId]);

    const filename = `batch-${batchId}-${Date.now()}.csv`;
    const csvPath = require('path').join(__dirname, '../../data/exports', filename);
    
    const csvWriter = createCsvWriter({
      path: csvPath,
      header: [
        { id: 'step_name', title: 'Step Name' },
        { id: 'method', title: 'Method' },
        { id: 'url', title: 'URL' },
        { id: 'status', title: 'Status' },
        { id: 'response_status', title: 'Response Status' },
        { id: 'response_time', title: 'Response Time (ms)' },
        { id: 'error_message', title: 'Error Message' },
        { id: 'executed_at', title: 'Executed At' }
      ]
    });

    await csvWriter.writeRecords(results);
    
    res.json({
      downloadUrl: `/exports/${filename}`,
      filename,
      recordCount: results.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/batch/:batchId/json', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const batch = await db.get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const results = await db.all(`
      SELECT er.*, s.name as step_name, s.method, s.url
      FROM execution_results er
      LEFT JOIN steps s ON er.step_id = s.id
      WHERE er.batch_id = ?
      ORDER BY er.executed_at ASC
    `, [batchId]);

    const formattedResults = results.map(r => ({
      ...r,
      request_data: JSON.parse(r.request_data || '{}'),
      response_data: JSON.parse(r.response_data || '{}'),
      assertions_result: JSON.parse(r.assertions_result || '[]')
    }));

    const filename = `batch-${batchId}-${Date.now()}.json`;
    const content = JSON.stringify({
      batch,
      results: formattedResults
    }, null, 2);

    const downloadUrl = await saveExport(content, filename);

    res.json({
      downloadUrl,
      filename,
      recordCount: results.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        b.id,
        b.collection_id,
        c.name as collection_name,
        b.status,
        b.total_steps,
        b.passed_steps,
        b.failed_steps,
        b.started_at,
        b.completed_at,
        b.created_at
      FROM batches b
      LEFT JOIN collections c ON b.collection_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      query += ' AND b.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND b.created_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY b.created_at DESC LIMIT 100';

    const batches = await db.all(query, params);

    const summary = {
      total: batches.length,
      completed: batches.filter(b => b.status === 'completed').length,
      failed: batches.filter(b => b.status === 'failed').length,
      running: batches.filter(b => b.status === 'running').length,
      successRate: batches.length > 0 
        ? Math.round((batches.filter(b => b.status === 'completed').length / batches.length) * 100) 
        : 0,
      batches
    };

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
