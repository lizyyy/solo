const express = require('express');
const router = express.Router();
const exceptionService = require('../services/exceptionService');
const { success, fail, paginate } = require('../utils/response');

router.post('/', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const id = await exceptionService.createException(req.body, operator);
    success(res, { id }, '异常记录已创建');
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.get('/', paginate, async (req, res) => {
  try {
    const result = await exceptionService.getExceptions(req.query, req.pagination);
    success(res, result);
  } catch (e) {
    fail(res, e.message, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const detail = await exceptionService.getExceptionDetail(req.params.id);
    if (!detail) return fail(res, '异常记录不存在', 404);
    success(res, detail);
  } catch (e) {
    fail(res, e.message, 500);
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    await exceptionService.resolveException(req.params.id, operator, req.body.resolutionNote);
    success(res, {}, '异常已处理');
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.get('/search/by-level/:level', paginate, async (req, res) => {
  try {
    const result = await exceptionService.searchByArtifactLevel(req.params.level, req.pagination);
    success(res, result);
  } catch (e) {
    fail(res, e.message, 500);
  }
});

router.get('/search/by-policy/:policyNo', paginate, async (req, res) => {
  try {
    const result = await exceptionService.searchByInsurancePolicy(req.params.policyNo, req.pagination);
    success(res, result);
  } catch (e) {
    fail(res, e.message, 500);
  }
});

router.get('/search/by-box/:boxNo', paginate, async (req, res) => {
  try {
    const result = await exceptionService.searchByTransportBox(req.params.boxNo, req.pagination);
    success(res, result);
  } catch (e) {
    fail(res, e.message, 500);
  }
});

module.exports = router;
