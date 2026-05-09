const express = require('express');
const router = express.Router();
const departmentService = require('../services/department-service');

router.get('/', async (req, res) => {
  try {
    const result = await departmentService.getAllDepartments();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await departmentService.getDepartmentById(req.params.id);
    const status = result.success ? 200 : 404;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

router.get('/:id/report', async (req, res) => {
  try {
    const result = await departmentService.getDepartmentReport(req.params.id);
    const status = result.success ? 200 : 404;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const result = await departmentService.getOperationHistory(req.params.id, limit);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

module.exports = router;
