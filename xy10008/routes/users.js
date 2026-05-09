const express = require('express');
const router = express.Router();
const UserService = require('../services/userService');
const logger = require('../utils/logger');
const { storeIdempotencyResponse } = require('../utils/idempotency');

router.get('/', async (req, res) => {
  try {
    const users = UserService.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error('GET /api/users error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = UserService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('GET /api/users/:id error', { error: error.message, userId: req.params.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/summary', async (req, res) => {
  try {
    const summary = UserService.getUserSummary(req.params.id);
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('GET /api/users/:id/summary error', { error: error.message, userId: req.params.id });
    if (error.message === 'User not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = UserService.createUser(req.body.name, req);
    const responseData = { status: 201, body: { success: true, data: user } };
    storeIdempotencyResponse(req, responseData);
    res.status(201).json(responseData.body);
  } catch (error) {
    logger.error('POST /api/users error', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const user = UserService.updateUser(req.params.id, req.body.name, req);
    const responseData = { status: 200, body: { success: true, data: user } };
    storeIdempotencyResponse(req, responseData);
    res.json(responseData.body);
  } catch (error) {
    logger.error('PUT /api/users/:id error', { error: error.message, userId: req.params.id });
    if (error.message === 'User not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    UserService.deleteUser(req.params.id, req);
    const responseData = { status: 200, body: { success: true, message: 'User deleted successfully' } };
    storeIdempotencyResponse(req, responseData);
    res.json(responseData.body);
  } catch (error) {
    logger.error('DELETE /api/users/:id error', { error: error.message, userId: req.params.id });
    if (error.message === 'User not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
