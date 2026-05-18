const express = require('express');
const router = express.Router();
const accidentService = require('../services/accidentService');

router.post('/', async (req, res) => {
  try {
    const result = await accidentService.createAccidentRecord(
      req.body,
      req.body.operator || 'anonymous',
      req.ip
    );

    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误'
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const result = await accidentService.updateAccidentRecord(
      req.params.id,
      req.body,
      req.body.operator || 'anonymous',
      req.ip
    );

    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const record = await accidentService.getAccidentRecord(req.params.id);
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误'
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const records = await accidentService.getAccidentRecords(req.query);
    res.json({
      success: true,
      data: records,
      total: records.length
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误'
    });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const result = await accidentService.reviewAccidentRecord(
      req.params.id,
      req.body,
      req.body.operator || 'anonymous'
    );
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误'
    });
  }
});

module.exports = router;
