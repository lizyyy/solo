const express = require('express');
const router = express.Router();
const { success, error } = require('../utils/response');
const Reception = require('../models/reception');
const receptionService = require('../services/receptionService');

router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    const receptions = status ? Reception.findByStatus(status) : Reception.findAll();
    res.json(success(receptions));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.get('/:id', (req, res) => {
  try {
    const detail = receptionService.getReceptionDetail(req.params.id);
    if (!detail) {
      return res.json(error('领用单不存在', 404));
    }
    res.json(success(detail));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const reception = Reception.findById(req.params.id);
    if (!reception) {
      return res.json(error('领用单不存在', 404));
    }
    const history = Reception.getHistory(req.params.id);
    res.json(success({
      reception,
      history
    }));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.post('/', (req, res) => {
  try {
    const { partId, equipmentId, requestedQuantity, requester, idempotentKey, operator } = req.body;
    if (!partId || !requestedQuantity) {
      return res.json(error('备件ID和申请数量不能为空', 400));
    }
    const result = receptionService.createReception({
      partId,
      equipmentId,
      requestedQuantity,
      requester,
      idempotentKey,
      operator
    });
    res.json(success(result, result.isDuplicate ? '重复请求，返回已有领用单' : '领用单创建成功'));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.post('/:id/action/:action', (req, res) => {
  try {
    const { id, action } = req.params;
    const { operator, alternativePartId } = req.body;
    
    let result;
    switch (action) {
      case 'approve':
        result = receptionService.approveReception(id, operator);
        break;
      case 'process':
        result = receptionService.processReception(id, operator);
        break;
      case 'use-alternative':
        if (!alternativePartId) {
          return res.json(error('替代件ID不能为空', 400));
        }
        result = receptionService.useAlternative(id, alternativePartId, operator);
        break;
      case 'complete':
        result = receptionService.completeReception(id, operator);
        break;
      case 'callback':
        const { callbackKey } = req.body;
        if (!callbackKey) {
          return res.json(error('回调KEY不能为空', 400));
        }
        result = receptionService.callbackReception(id, callbackKey, operator);
        break;
      default:
        return res.json(error(`未知操作: ${action}`, 400));
    }
    
    const code = result.success === false ? 400 : 0;
    res.json(success(result, result.message, code));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.post('/manual-correct', (req, res) => {
  try {
    const { targetType, targetId, beforeValue, afterValue, operator, reason } = req.body;
    if (!targetType || !targetId || !operator) {
      return res.json(error('目标类型、目标ID、操作者不能为空', 400));
    }
    const result = receptionService.manualCorrect(
      targetType, targetId, beforeValue || {}, afterValue || {}, operator, reason
    );
    res.json(success(result, '人工修正记录成功'));
  } catch (e) {
    res.json(error(e.message));
  }
});

module.exports = router;
