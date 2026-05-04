const express = require('express');
const Joi = require('joi');
const db = require('../database');

const router = express.Router();

const appKeySchema = Joi.object({
  appKey: Joi.string().required().max(100),
  name: Joi.string().required().max(100),
  description: Joi.string().max(500).allow(''),
  isActive: Joi.boolean().default(true)
});

const updateAppKeySchema = Joi.object({
  name: Joi.string().max(100),
  description: Joi.string().max(500).allow(''),
  isActive: Joi.boolean()
});

const routeSchema = Joi.object({
  path: Joi.string().required().max(200),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').default('GET'),
  description: Joi.string().max(500).allow(''),
  isActive: Joi.boolean().default(true)
});

const updateRouteSchema = Joi.object({
  description: Joi.string().max(500).allow(''),
  isActive: Joi.boolean()
});

const rateLimitConfigSchema = Joi.object({
  appKey: Joi.string().required(),
  path: Joi.string().required(),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').default('GET'),
  algorithm: Joi.string().valid('fixed-window', 'sliding-window').default('fixed-window'),
  limit: Joi.number().integer().positive().required(),
  windowSeconds: Joi.number().integer().positive().required(),
  isActive: Joi.boolean().default(true)
});

const updateRateLimitConfigSchema = Joi.object({
  algorithm: Joi.string().valid('fixed-window', 'sliding-window'),
  limit: Joi.number().integer().positive(),
  windowSeconds: Joi.number().integer().positive(),
  isActive: Joi.boolean()
});

router.get('/app-keys', async (req, res) => {
  try {
    const appKeys = db.all(`
      SELECT id, app_key, name, description, is_active, created_at, updated_at
      FROM app_keys
      ORDER BY created_at DESC
    `);

    const result = appKeys.map(ak => ({
      id: ak.id,
      appKey: ak.app_key,
      name: ak.name,
      description: ak.description,
      isActive: ak.is_active === 1,
      createdAt: ak.created_at,
      updatedAt: ak.updated_at
    }));

    res.json(result);
  } catch (err) {
    console.error('Get app keys error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/app-keys', async (req, res) => {
  try {
    const { error, value } = appKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existing = db.get('SELECT id FROM app_keys WHERE app_key = ?', [value.appKey]);
    if (existing) {
      return res.status(409).json({ error: 'App key already exists' });
    }

    const result = db.run(
      `INSERT INTO app_keys (app_key, name, description, is_active)
       VALUES (?, ?, ?, ?)`,
      [value.appKey, value.name, value.description || '', value.isActive ? 1 : 0]
    );

    res.status(201).json({
      id: result?.lastInsertRowid || null,
      appKey: value.appKey,
      name: value.name,
      description: value.description,
      isActive: value.isActive
    });
  } catch (err) {
    console.error('Create app key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/app-keys/:id', async (req, res) => {
  try {
    const appKey = db.get(`
      SELECT id, app_key, name, description, is_active, created_at, updated_at
      FROM app_keys WHERE id = ?
    `, [req.params.id]);

    if (!appKey) {
      return res.status(404).json({ error: 'App key not found' });
    }

    res.json({
      id: appKey.id,
      appKey: appKey.app_key,
      name: appKey.name,
      description: appKey.description,
      isActive: appKey.is_active === 1,
      createdAt: appKey.created_at,
      updatedAt: appKey.updated_at
    });
  } catch (err) {
    console.error('Get app key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/app-keys/:id', async (req, res) => {
  try {
    const { error, value } = updateAppKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existing = db.get('SELECT id FROM app_keys WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'App key not found' });
    }

    const updateFields = [];
    const updateValues = [];

    if (value.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(value.name);
    }
    if (value.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(value.description);
    }
    if (value.isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(value.isActive ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(req.params.id);

    db.run(
      `UPDATE app_keys SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Update app key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/app-keys/:id', async (req, res) => {
  try {
    const existing = db.get('SELECT id FROM app_keys WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'App key not found' });
    }

    const hasConfigs = db.get(
      'SELECT COUNT(*) as count FROM rate_limit_configs WHERE app_key_id = ?',
      [req.params.id]
    );
    
    if (hasConfigs && hasConfigs.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete app key with existing rate limit configurations. Delete configurations first.' 
      });
    }

    db.run('DELETE FROM app_keys WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete app key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/routes', async (req, res) => {
  try {
    const routes = db.all(`
      SELECT id, path, method, description, is_active, created_at, updated_at
      FROM routes
      ORDER BY path, method
    `);

    const result = routes.map(r => ({
      id: r.id,
      path: r.path,
      method: r.method,
      description: r.description,
      isActive: r.is_active === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    res.json(result);
  } catch (err) {
    console.error('Get routes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/routes', async (req, res) => {
  try {
    const { error, value } = routeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existing = db.get(
      'SELECT id FROM routes WHERE path = ? AND method = ?',
      [value.path, value.method]
    );
    if (existing) {
      return res.status(409).json({ error: 'Route already exists' });
    }

    const result = db.run(
      `INSERT INTO routes (path, method, description, is_active)
       VALUES (?, ?, ?, ?)`,
      [value.path, value.method, value.description || '', value.isActive ? 1 : 0]
    );

    res.status(201).json({
      id: result?.lastInsertRowid || null,
      path: value.path,
      method: value.method,
      description: value.description,
      isActive: value.isActive
    });
  } catch (err) {
    console.error('Create route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/routes/:id', async (req, res) => {
  try {
    const route = db.get(`
      SELECT id, path, method, description, is_active, created_at, updated_at
      FROM routes WHERE id = ?
    `, [req.params.id]);

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json({
      id: route.id,
      path: route.path,
      method: route.method,
      description: route.description,
      isActive: route.is_active === 1,
      createdAt: route.created_at,
      updatedAt: route.updated_at
    });
  } catch (err) {
    console.error('Get route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/routes/:id', async (req, res) => {
  try {
    const { error, value } = updateRouteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existing = db.get('SELECT id FROM routes WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const updateFields = [];
    const updateValues = [];

    if (value.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(value.description);
    }
    if (value.isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(value.isActive ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(req.params.id);

    db.run(
      `UPDATE routes SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Update route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/routes/:id', async (req, res) => {
  try {
    const existing = db.get('SELECT id FROM routes WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const hasConfigs = db.get(
      'SELECT COUNT(*) as count FROM rate_limit_configs WHERE route_id = ?',
      [req.params.id]
    );
    
    if (hasConfigs && hasConfigs.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete route with existing rate limit configurations. Delete configurations first.' 
      });
    }

    db.run('DELETE FROM routes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/rate-limit-configs', async (req, res) => {
  try {
    const configs = db.all(`
      SELECT rlc.id, rlc.algorithm, rlc.request_limit, rlc.window_seconds, rlc.is_active,
             ak.app_key, ak.name as app_key_name,
             r.path, r.method
      FROM rate_limit_configs rlc
      JOIN app_keys ak ON rlc.app_key_id = ak.id
      JOIN routes r ON rlc.route_id = r.id
      ORDER BY ak.app_key, r.path, r.method
    `);

    const result = configs.map(c => ({
      id: c.id,
      appKey: c.app_key,
      appKeyName: c.app_key_name,
      path: c.path,
      method: c.method,
      algorithm: c.algorithm,
      limit: c.request_limit,
      windowSeconds: c.window_seconds,
      isActive: c.is_active === 1
    }));

    res.json(result);
  } catch (err) {
    console.error('Get rate limit configs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/rate-limit-configs', async (req, res) => {
  try {
    const { error, value } = rateLimitConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const appKeyRecord = db.get(
      'SELECT id FROM app_keys WHERE app_key = ? AND is_active = 1',
      [value.appKey]
    );
    if (!appKeyRecord) {
      return res.status(404).json({ error: 'App key not found or inactive' });
    }

    const routeRecord = db.get(
      'SELECT id FROM routes WHERE path = ? AND method = ? AND is_active = 1',
      [value.path, value.method]
    );
    if (!routeRecord) {
      return res.status(404).json({ error: 'Route not found or inactive' });
    }

    const existing = db.get(
      'SELECT id FROM rate_limit_configs WHERE app_key_id = ? AND route_id = ?',
      [appKeyRecord.id, routeRecord.id]
    );
    if (existing) {
      return res.status(409).json({ error: 'Rate limit configuration already exists for this app key and route' });
    }

    const result = db.run(
      `INSERT INTO rate_limit_configs 
       (app_key_id, route_id, algorithm, request_limit, window_seconds, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        appKeyRecord.id,
        routeRecord.id,
        value.algorithm,
        value.limit,
        value.windowSeconds,
        value.isActive ? 1 : 0
      ]
    );

    res.status(201).json({
      id: result?.lastInsertRowid || null,
      appKey: value.appKey,
      path: value.path,
      method: value.method,
      algorithm: value.algorithm,
      limit: value.limit,
      windowSeconds: value.windowSeconds,
      isActive: value.isActive
    });
  } catch (err) {
    console.error('Create rate limit config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/rate-limit-configs/:id', async (req, res) => {
  try {
    const config = db.get(`
      SELECT rlc.id, rlc.algorithm, rlc.request_limit, rlc.window_seconds, rlc.is_active,
             ak.app_key, ak.name as app_key_name,
             r.path, r.method
      FROM rate_limit_configs rlc
      JOIN app_keys ak ON rlc.app_key_id = ak.id
      JOIN routes r ON rlc.route_id = r.id
      WHERE rlc.id = ?
    `, [req.params.id]);

    if (!config) {
      return res.status(404).json({ error: 'Rate limit configuration not found' });
    }

    res.json({
      id: config.id,
      appKey: config.app_key,
      appKeyName: config.app_key_name,
      path: config.path,
      method: config.method,
      algorithm: config.algorithm,
      limit: config.request_limit,
      windowSeconds: config.window_seconds,
      isActive: config.is_active === 1
    });
  } catch (err) {
    console.error('Get rate limit config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/rate-limit-configs/:id', async (req, res) => {
  try {
    const { error, value } = updateRateLimitConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existing = db.get('SELECT id FROM rate_limit_configs WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Rate limit configuration not found' });
    }

    const updateFields = [];
    const updateValues = [];

    if (value.algorithm !== undefined) {
      updateFields.push('algorithm = ?');
      updateValues.push(value.algorithm);
    }
    if (value.limit !== undefined) {
      updateFields.push('request_limit = ?');
      updateValues.push(value.limit);
    }
    if (value.windowSeconds !== undefined) {
      updateFields.push('window_seconds = ?');
      updateValues.push(value.windowSeconds);
    }
    if (value.isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(value.isActive ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(req.params.id);

    db.run(
      `UPDATE rate_limit_configs SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Update rate limit config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/rate-limit-configs/:id', async (req, res) => {
  try {
    const existing = db.get('SELECT id FROM rate_limit_configs WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Rate limit configuration not found' });
    }

    db.run('DELETE FROM rate_limit_configs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete rate limit config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
