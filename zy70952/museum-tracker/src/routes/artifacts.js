const express = require('express');
const router = express.Router();
const artifactService = require('../services/artifactService');
const { success, fail, paginate } = require('../utils/response');
const { validateRequired } = require('../utils/validator');

router.post('/', async (req, res) => {
  try {
    const error = validateRequired(['artifactNo', 'name', 'level', 'valuation'], req.body);
    if (error) return fail(res, error.message, 400);
    const operator = req.operator;
    const id = await artifactService.createArtifact(req.body, operator);
    success(res, { id }, '文物创建成功');
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.get('/', paginate, async (req, res) => {
  try {
    const result = await artifactService.getArtifacts(req.query, req.pagination);
    success(res, result);
  } catch (e) {
    fail(res, e.message, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const detail = await artifactService.getArtifactDetail(req.params.id);
    success(res, detail);
  } catch (e) {
    fail(res, e.message, 404);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const operator = req.operator;
    await artifactService.updateArtifact(req.params.id, req.body, operator);
    success(res, {}, '文物信息已更新');
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.post('/:id/valuation', async (req, res) => {
  try {
    const error = validateRequired(['newValue', 'reason'], req.body);
    if (error) return fail(res, error.message, 400);
    const operator = req.operator;
    await artifactService.updateValuation(req.params.id, req.body.newValue, req.body.reason, operator);
    success(res, {}, '估值已更新');
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.get('/:id/valuation-history', async (req, res) => {
  try {
    const history = await artifactService.getValuationChanges(req.params.id);
    success(res, history);
  } catch (e) {
    fail(res, e.message, 500);
  }
});

module.exports = router;
