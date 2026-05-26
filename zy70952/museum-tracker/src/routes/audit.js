const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const { success, fail, paginate } = require('../utils/response');

router.get('/', paginate, async (req, res) => {
  try {
    const result = await auditService.queryAudit(req.query, req.pagination);
    success(res, result);
  } catch (e) {
    fail(res, e.message, 500);
  }
});

router.get('/artifact/:id', async (req, res) => {
  try {
    const history = await auditService.getArtifactHistory(req.params.id);
    success(res, history);
  } catch (e) {
    fail(res, e.message, 500);
  }
});

router.get('/batch/:id', async (req, res) => {
  try {
    const history = await auditService.getBatchHistory(req.params.id);
    success(res, history);
  } catch (e) {
    fail(res, e.message, 500);
  }
});

module.exports = router;
