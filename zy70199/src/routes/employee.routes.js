const express = require('express');
const EmployeeService = require('../services/employee.service');
const { ValidationError, NotFoundError } = require('../utils/error-handler');

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const employee = EmployeeService.create(req.body, req.headers['x-user-id'] || 'system');
    res.status(201).json(employee);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const employees = EmployeeService.getAll(req.query);
    res.json(employees);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const employee = EmployeeService.getWithDetails(req.params.id);
    res.json(employee);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/:id/correct-status', (req, res) => {
  try {
    const { newStatus, reason } = req.body;
    if (!newStatus || !reason) {
      throw new ValidationError('新状态和原因是必填项');
    }
    
    const result = EmployeeService.manuallyCorrectStatus(
      req.params.id, 
      newStatus, 
      reason, 
      req.headers['x-user-id'] || 'admin'
    );
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
