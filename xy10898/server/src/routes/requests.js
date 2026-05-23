const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getQuery, allQuery, runQuery } = require('../database');
const { generateRequestHash, detectSensitiveFields, maskSensitiveData } = require('../utils/maskUtils');
const { validateStatusChange, getAvailableTransitions } = require('../utils/statusMachine');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, method, url, headers, body, environment_id, created_by } = req.body;
    
    if (!name || !method || !url) {
      return res.status(400).json({ error: 'Missing required fields: name, method, url' });
    }

    const requestHash = generateRequestHash(method, url, headers, body);
    
    const existing = await getQuery(
      'SELECT * FROM requests WHERE request_hash = ? ORDER BY created_at DESC LIMIT 1',
      [requestHash]
    );

    if (existing) {
      return res.status(409).json({
        error: 'Duplicate request',
        existing_id: existing.id,
        message: 'An identical request was already submitted'
      });
    }

    const detectedSensitive = detectSensitiveFields(headers, body);
    const maskedHeaders = maskSensitiveData(headers || {}, detectedSensitive.filter(f => f.field_path.startsWith('headers.')), 'headers');
    const maskedBody = maskSensitiveData(body || {}, detectedSensitive.filter(f => f.field_path.startsWith('body.')), 'body');

    const id = uuidv4();
    await runQuery(
      `INSERT INTO requests (id, name, method, url, headers, body, sensitive_fields, environment_id, created_by, request_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, name, method, url,
        JSON.stringify(maskedHeaders),
        JSON.stringify(maskedBody),
        JSON.stringify(detectedSensitive),
        environment_id || null,
        created_by || 'anonymous',
        requestHash,
        'pending'
      ]
    );

    detectedSensitive.forEach(async (field) => {
      await runQuery(
        'INSERT INTO sensitive_fields (id, request_id, field_path, mask_type) VALUES (?, ?, ?, ?)',
        [uuidv4(), id, field.field_path, field.mask_type]
      );
    });

    const request = await getQuery('SELECT * FROM requests WHERE id = ?', [id]);
    
    res.status(201).json({
      ...request,
      headers: JSON.parse(request.headers || '{}'),
      body: JSON.parse(request.body || '{}'),
      sensitive_fields: JSON.parse(request.sensitive_fields || '[]'),
      available_transitions: getAvailableTransitions(request.status)
    });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { environment_id, status, search, limit = 50, offset = 0 } = req.query;
    
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

    if (search) {
      whereClauses.push('(r.name LIKE ? OR r.url LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const requests = await allQuery(
      `SELECT r.*, e.name as environment_name, 
              (SELECT COUNT(*) FROM responses WHERE request_id = r.id) as response_count,
              (SELECT COUNT(*) FROM favorites WHERE request_id = r.id) as favorite_count
       FROM requests r
       LEFT JOIN environments e ON r.environment_id = e.id
       ${whereSql}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const total = await getQuery(
      `SELECT COUNT(*) as count FROM requests r ${whereSql}`,
      params
    );

    res.json({
      data: requests.map(r => ({
        ...r,
        headers: JSON.parse(r.headers || '{}'),
        body: JSON.parse(r.body || '{}'),
        sensitive_fields: JSON.parse(r.sensitive_fields || '[]'),
        available_transitions: getAvailableTransitions(r.status)
      })),
      total: total.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const request = await getQuery('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const responses = await allQuery('SELECT * FROM responses WHERE request_id = ? ORDER BY created_at DESC', [req.params.id]);
    const reviews = await allQuery('SELECT * FROM reviews WHERE request_id = ? ORDER BY created_at DESC', [req.params.id]);

    res.json({
      ...request,
      headers: JSON.parse(request.headers || '{}'),
      body: JSON.parse(request.body || '{}'),
      sensitive_fields: JSON.parse(request.sensitive_fields || '[]'),
      responses: responses.map(r => ({
        ...r,
        headers: JSON.parse(r.headers || '{}'),
        body: JSON.parse(r.body || '{}')
      })),
      reviews,
      available_transitions: getAvailableTransitions(request.status)
    });
  } catch (error) {
    console.error('Get request detail error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { new_status, comment, reviewer_id } = req.body;
    const request = await getQuery('SELECT * FROM requests WHERE id = ?', [req.params.id]);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    validateStatusChange(request.status, new_status, req.body.action);

    await runQuery(
      'UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [new_status, req.params.id]
    );

    await runQuery(
      `INSERT INTO reviews (id, request_id, reviewer_id, action, comment, previous_status, new_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), req.params.id, reviewer_id || 'anonymous', 'status_change', comment || '', request.status, new_status]
    );

    const updated = await getQuery('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    
    res.json({
      ...updated,
      headers: JSON.parse(updated.headers || '{}'),
      body: JSON.parse(updated.body || '{}'),
      available_transitions: getAvailableTransitions(updated.status)
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/response', async (req, res) => {
  try {
    const { status_code, headers, body, response_time, is_error, error_message } = req.body;
    const request = await getQuery('SELECT * FROM requests WHERE id = ?', [req.params.id]);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const id = uuidv4();
    await runQuery(
      `INSERT INTO responses (id, request_id, status_code, headers, body, response_time, is_error, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, req.params.id, status_code || 200,
        JSON.stringify(headers || {}),
        JSON.stringify(body || {}),
        response_time || 0,
        is_error ? 1 : 0,
        error_message || null
      ]
    );

    const response = await getQuery('SELECT * FROM responses WHERE id = ?', [id]);
    
    res.status(201).json({
      ...response,
      headers: JSON.parse(response.headers || '{}'),
      body: JSON.parse(response.body || '{}')
    });
  } catch (error) {
    console.error('Add response error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const reviews = await allQuery(
      'SELECT * FROM reviews WHERE request_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    
    res.json(reviews);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
