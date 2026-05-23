const express = require('express');
const router = express.Router();
const exceptionService = require('../services/exceptionService');

router.post('/', (req, res) => {
  try {
    const exception = exceptionService.logException(req.body);
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

router.get('/', (req, res) => {
  try {
    const filters = {
      resolution_status: req.query.resolution_status,
      related_personnel_id: req.query.related_personnel_id,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };
    const exceptions = exceptionService.getExceptions(filters);
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

router.get('/:id', (req, res) => {
  try {
    const exception = exceptionService.getExceptionById(req.params.id);
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

router.get('/:id/trace', (req, res) => {
  try {
    const trace = exceptionService.getExceptionTrace(req.params.id);
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

router.put('/:id/resolve', (req, res) => {
  try {
    const exception = exceptionService.resolveException(
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
