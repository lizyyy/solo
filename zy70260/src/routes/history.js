const express = require('express');
const { HistoryService } = require('../services');
const { successHandler, asyncHandler } = require('../middleware/error');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { entity_type, limit = 100 } = req.query;
  const history = HistoryService.getAll(entity_type, parseInt(limit));
  res.json(successHandler(history, '获取历史记录成功'));
}));

router.get('/:entity_type/:entity_id', asyncHandler(async (req, res) => {
  const { entity_type, entity_id } = req.params;
  const { limit = 50 } = req.query;
  const history = HistoryService.getByEntity(entity_type, entity_id, parseInt(limit));
  res.json(successHandler(history, '获取实体历史记录成功'));
}));

module.exports = router;
