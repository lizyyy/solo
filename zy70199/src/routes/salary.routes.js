const express = require('express');
const SalaryService = require('../services/salary.service');
const { ValidationError } = require('../utils/error-handler');

const router = express.Router();

router.get('/can-establish/:employeeId', (req, res) => {
  try {
    const result = SalaryService.canEstablish(req.params.employeeId);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/establish/:employeeId', (req, res) => {
  try {
    const salary = SalaryService.establish(
      req.params.employeeId,
      req.body,
      req.headers['x-user-id'] || 'system'
    );
    res.status(201).json(salary);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/employee/:employeeId', (req, res) => {
  try {
    const salary = SalaryService.getByEmployeeId(req.params.employeeId);
    res.json(salary);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const salary = SalaryService.getById(req.params.id);
    res.json(salary);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const salary = SalaryService.update(
      req.params.id,
      req.body,
      req.headers['x-user-id'] || 'admin'
    );
    res.json(salary);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/:id/terminate', (req, res) => {
  try {
    if (!req.body.reason) {
      throw new ValidationError('终止原因是必填项');
    }
    
    const salary = SalaryService.terminate(
      req.params.id,
      req.body.reason,
      req.headers['x-user-id'] || 'admin'
    );
    res.json(salary);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
