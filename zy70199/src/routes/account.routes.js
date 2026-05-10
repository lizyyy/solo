const express = require('express');
const AccountService = require('../services/account.service');
const { ValidationError } = require('../utils/error-handler');

const router = express.Router();

router.get('/can-create/:employeeId', (req, res) => {
  try {
    const result = AccountService.canCreate(req.params.employeeId);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/create/:employeeId', (req, res) => {
  try {
    const account = AccountService.create(
      req.params.employeeId,
      req.body,
      req.headers['x-user-id'] || 'system'
    );
    res.status(201).json(account);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/employee/:employeeId', (req, res) => {
  try {
    const account = AccountService.getByEmployeeId(req.params.employeeId);
    res.json(account);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const account = AccountService.getById(req.params.id);
    res.json(account);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.put('/:id/permissions', (req, res) => {
  try {
    if (!req.body.permissions || !Array.isArray(req.body.permissions)) {
      throw new ValidationError('权限列表是必填项，且必须为数组');
    }
    
    const account = AccountService.updatePermissions(
      req.params.id,
      req.body.permissions,
      req.headers['x-user-id'] || 'admin'
    );
    res.json(account);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/:id/deactivate', (req, res) => {
  try {
    if (!req.body.reason) {
      throw new ValidationError('停用原因是必填项');
    }
    
    const account = AccountService.deactivate(
      req.params.id,
      req.body.reason,
      req.headers['x-user-id'] || 'admin'
    );
    res.json(account);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
