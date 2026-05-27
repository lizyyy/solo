const express = require('express');
const router = express.Router();
const batchService = require('../services/batchService');
const { success, fail, paginate } = require('../utils/response');
const { validateRequired } = require('../utils/validator');

router.post('/', paginate, async (req, res) => {
  try {
    const error = validateRequired(['batchNo'], req.body);
    if (error) return fail(res, error.message, 400);
    const operator = req.operator;
    const id = await batchService.createBatch(req.body, operator);
    success(res, { id, batch_no: req.body.batchNo }, '批次创建成功');
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.get('/', paginate, async (req, res) => {
  try {
    const result = await batchService.getBatches(req.query, req.pagination);
    success(res, result);
  } catch (e) {
    fail(res, e.message, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const detail = await batchService.getBatchDetail(req.params.id);
    success(res, detail);
  } catch (e) {
    fail(res, e.message, 404);
  }
});

router.post('/:id/artifacts', async (req, res) => {
  try {
    if (!req.body.artifactIds || !Array.isArray(req.body.artifactIds)) {
      return fail(res, 'artifactIds 必须是数组', 400);
    }
    const operator = req.operator;
    const added = await batchService.addArtifactsToBatch(req.params.id, req.body.artifactIds, operator);
    success(res, { added });
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.delete('/:id/artifacts/:artifactId', async (req, res) => {
  try {
    const operator = req.operator;
    await batchService.removeArtifactFromBatch(req.params.id, req.params.artifactId, operator);
    success(res, {}, '文物已从批次中移除');
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const operator = req.operator;
    await batchService.approveBatch(req.params.id, operator, req.body.comment);
    success(res, {}, '批次已放行');
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.post('/:id/return', async (req, res) => {
  try {
    if (!req.body.reason) return fail(res, '退回原因必填', 400);
    const operator = req.operator;
    await batchService.returnBatch(req.params.id, operator, req.body.reason);
    success(res, {}, '批次已退回');
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.post('/:id/request-materials', async (req, res) => {
  try {
    if (!req.body.materialsNeeded) return fail(res, '需补材料说明必填', 400);
    const operator = req.operator;
    await batchService.requestMoreMaterials(req.params.id, operator, req.body.materialsNeeded, req.body.artifactIds);
    success(res, {}, '已要求补材料');
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.post('/:id/process', async (req, res) => {
  try {
    const error = validateRequired(['artifactId', 'action'], req.body);
    if (error) return fail(res, error.message, 400);
    const operator = req.operator;
    await batchService.processArtifactInBatch(req.params.id, req.body.artifactId, req.body.action, operator, req.body.reason);
    success(res, {}, '文物处理状态已更新');
  } catch (e) {
    fail(res, e.message, 400);
  }
});

module.exports = router;
