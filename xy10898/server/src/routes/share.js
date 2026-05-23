const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getQuery, allQuery, runQuery } = require('../database');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { request_id, shared_by, permission_level = 'view', expires_in } = req.body;
    
    if (!request_id) {
      return res.status(400).json({ error: 'request_id is required' });
    }

    const request = await getQuery('SELECT * FROM requests WHERE id = ?', [request_id]);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const share_token = crypto.randomBytes(16).toString('hex');
    const id = uuidv4();
    
    let expires_at = null;
    if (expires_in) {
      expires_at = new Date(Date.now() + parseInt(expires_in) * 1000).toISOString();
    }

    await runQuery(
      `INSERT INTO shared_records (id, request_id, share_token, shared_by, permission_level, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, request_id, share_token, shared_by || 'anonymous', permission_level, expires_at]
    );

    const share = await getQuery('SELECT * FROM shared_records WHERE id = ?', [id]);
    
    res.status(201).json({
      ...share,
      share_url: `/share/${share_token}`
    });
  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const share = await getQuery('SELECT * FROM shared_records WHERE share_token = ?', [token]);
    
    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share has expired' });
    }

    const request = await getQuery('SELECT * FROM requests WHERE id = ?', [share.request_id]);
    const responses = await allQuery('SELECT * FROM responses WHERE request_id = ? ORDER BY created_at DESC', [share.request_id]);

    if (share.permission_level === 'view') {
      res.json({
        permission: share.permission_level,
        request: {
          id: request.id,
          name: request.name,
          method: request.method,
          url: request.url,
          status: request.status,
          headers: JSON.parse(request.headers || '{}'),
          body: JSON.parse(request.body || '{}'),
          created_at: request.created_at
        },
        responses: responses.slice(0, 5).map(r => ({
          status_code: r.status_code,
          response_time: r.response_time,
          created_at: r.created_at
        }))
      });
    } else {
      res.json({
        permission: share.permission_level,
        request: {
          ...request,
          headers: JSON.parse(request.headers || '{}'),
          body: JSON.parse(request.body || '{}')
        },
        responses: responses.map(r => ({
          ...r,
          headers: JSON.parse(r.headers || '{}'),
          body: JSON.parse(r.body || '{}')
        }))
      });
    }
  } catch (error) {
    console.error('Get share error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { request_id } = req.query;
    
    let shares;
    if (request_id) {
      shares = await allQuery(
        'SELECT * FROM shared_records WHERE request_id = ? ORDER BY created_at DESC',
        [request_id]
      );
    } else {
      shares = await allQuery('SELECT * FROM shared_records ORDER BY created_at DESC LIMIT 50');
    }
    
    res.json(shares);
  } catch (error) {
    console.error('Get shares error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM shared_records WHERE id = ?', [req.params.id]);
    res.json({ message: 'Share revoked' });
  } catch (error) {
    console.error('Delete share error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
