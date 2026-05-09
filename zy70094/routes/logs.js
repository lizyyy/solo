const express = require('express');
const router = express.Router();
const logService = require('../services/logService');
const { createResponse, asyncHandler } = require('../utils/helpers');

router.get('/', asyncHandler(async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  const result = await logService.getAllLogs(
    parseInt(limit),
    parseInt(offset)
  );
  res.json(createResponse(true, result, '查询成功'));
}));

router.get('/application/:applicationId', asyncHandler(async (req, res) => {
  const result = await logService.getLogsByApplication(req.params.applicationId);
  res.json(createResponse(true, result, '查询成功'));
}));

module.exports = router;
