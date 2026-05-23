const express = require('express');
const { Parser } = require('json2csv');
const { allQuery } = require('../database');

const router = express.Router();

router.get('/requests', async (req, res) => {
  try {
    const { environment_id, status, format = 'json' } = req.query;
    
    let whereClauses = [];
    let params = [];

    if (environment_id) {
      whereClauses.push('r.environment_id = ?');
      params.push(environment_id);
    }

    if (status) {
      whereClauses.push('r.status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const requests = await allQuery(
      `SELECT r.*, e.name as environment_name
       FROM requests r
       LEFT JOIN environments e ON r.environment_id = e.id
       ${whereSql}
       ORDER BY r.created_at DESC`,
      params
    );

    const data = requests.map(r => ({
      id: r.id,
      name: r.name,
      method: r.method,
      url: r.url,
      status: r.status,
      environment: r.environment_name || 'Default',
      created_by: r.created_by,
      created_at: r.created_at
    }));

    if (format === 'csv') {
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(data);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=requests.csv');
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=requests.json');
      res.json(data);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;

    const request = await allQuery(
      `SELECT r.*, e.name as environment_name
       FROM requests r
       LEFT JOIN environments e ON r.environment_id = e.id
       WHERE r.id = ?`,
      [id]
    );

    if (request.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const responses = await allQuery(
      'SELECT * FROM responses WHERE request_id = ? ORDER BY created_at ASC',
      [id]
    );

    const reviews = await allQuery(
      'SELECT * FROM reviews WHERE request_id = ? ORDER BY created_at ASC',
      [id]
    );

    const exportData = {
      request: {
        id: request[0].id,
        name: request[0].name,
        method: request[0].method,
        url: request[0].url,
        status: request[0].status,
        environment: request[0].environment_name || 'Default',
        created_by: request[0].created_by,
        created_at: request[0].created_at
      },
      responses: responses.map(r => ({
        status_code: r.status_code,
        response_time: r.response_time,
        is_error: r.is_error,
        error_message: r.error_message,
        created_at: r.created_at
      })),
      reviews: reviews.map(r => ({
        action: r.action,
        previous_status: r.previous_status,
        new_status: r.new_status,
        comment: r.comment,
        reviewer_id: r.reviewer_id,
        created_at: r.created_at
      }))
    };

    if (format === 'csv') {
      const flatData = [];
      exportData.responses.forEach((r, i) => {
        flatData.push({
          type: 'response',
          sequence: i + 1,
          status_code: r.status_code,
          response_time: r.response_time,
          is_error: r.is_error,
          created_at: r.created_at
        });
      });
      exportData.reviews.forEach((r, i) => {
        flatData.push({
          type: 'review',
          sequence: i + 1,
          action: r.action,
          previous_status: r.previous_status,
          new_status: r.new_status,
          created_at: r.created_at
        });
      });

      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(flatData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=request_${id}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=request_${id}.json`);
      res.json(exportData);
    }
  } catch (error) {
    console.error('Export detail error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
