const express = require('express');
const router = express.Router();
const exceptionService = require('../services/exceptionService');

router.post('/', async (req, res) => {
  try {
    const exception = await exceptionService.logException(req.body);
    res.json({
      success: true,
      data: exception
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      resolution_status: req.query.resolution_status,
      related_personnel_id: req.query.related_personnel_id,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };
    const exceptions = await exceptionService.getExceptions(filters);
    res.json({
      success: true,
      data: exceptions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const exception = await exceptionService.getExceptionById(req.params.id);
    if (!exception) {
      return res.status(404).json({
        success: false,
        error: '异常记录不存在'
      });
    }
    res.json({
      success: true,
      data: exception
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/trace', async (req, res) => {
  try {
    const trace = await exceptionService.getExceptionTrace(req.params.id);
    if (!trace) {
      return res.status(404).json({
        success: false,
        error: '异常记录不存在'
      });
    }
    res.json({
      success: true,
      data: trace
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id/resolve', async (req, res) => {
  try {
    const exception = await exceptionService.resolveException(
      req.params.id,
      {
        resolved_by: req.body.resolved_by,
        resolution_notes: req.body.resolution_notes
      }
    );
    res.json({
      success: true,
      data: exception
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
