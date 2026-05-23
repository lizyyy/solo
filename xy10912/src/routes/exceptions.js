const express = require('express');
const router = express.Router();
const { ExceptionLogDAO } = require('../database/dao');
const { successResponse, notFoundResponse } = require('../utils/response');
const { logException } = require('../middleware/exceptionHandler');

const exceptionLogDAO = new ExceptionLogDAO();

router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    let where = '';
    let params = [];

    if (status) {
      where += 'status = ?';
      params.push(status);
    }

    const exceptions = await exceptionLogDAO.findAll(where, params);
    return successResponse(res, exceptions);
  } catch (err) {
    await logException(req, err, 'list_exceptions_failed');
    next(err);
  }
});

router.get('/pending', async (req, res, next) => {
  try {
    const pending = await exceptionLogDAO.findPending();
    return successResponse(res, pending);
  } catch (err) {
    await logException(req, err, 'get_pending_exceptions_failed');
    next(err);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const exception = await exceptionLogDAO.findByCode(req.params.code);
    if (!exception) {
      return notFoundResponse(res, '异常记录不存在');
    }
    return successResponse(res, exception);
  } catch (err) {
    await logException(req, err, 'get_exception_failed');
    next(err);
  }
});

router.patch('/:code/handle', async (req, res, next) => {
  try {
    const { handled_by, processing_conclusion } = req.body;
    
    const exception = await exceptionLogDAO.findByCode(req.params.code);
    if (!exception) {
      return notFoundResponse(res, '异常记录不存在');
    }

    await exceptionLogDAO.update(exception.id, {
      status: 'handled',
      handled_by,
      handled_at: new Date().toISOString(),
      processing_conclusion: processing_conclusion || exception.processing_conclusion
    });

    const updated = await exceptionLogDAO.findById(exception.id);
    return successResponse(res, updated, '异常已处理');
  } catch (err) {
    await logException(req, err, 'handle_exception_failed');
    next(err);
  }
});

module.exports = router;
