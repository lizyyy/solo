const express = require('express');
const router = express.Router();
const replenishmentService = require('../services/replenishmentService');

router.get('/status-flow', (req, res) => {
  res.json({ success: true, data: replenishmentService.STATUS_FLOW });
});

router.get('/status-counts', (req, res) => {
  try {
    const counts = replenishmentService.getStatusCounts();
    res.json({ success: true, data: counts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/suggestions', (req, res) => {
  try {
    const suggestions = replenishmentService.getPendingSuggestions();
    res.json({ success: true, data: suggestions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const { status, materialId, departmentId, limit } = req.query;
    const requests = replenishmentService.getRequests({
      status,
      materialId: materialId ? parseInt(materialId) : undefined,
      departmentId: departmentId ? parseInt(departmentId) : undefined,
      limit: limit ? parseInt(limit) : undefined
    });
    
    const enriched = requests.map(r => ({
      ...r,
      status_label: replenishmentService.STATUS_FLOW[r.status]?.label || r.status,
      status_color: replenishmentService.STATUS_FLOW[r.status]?.color || '#909399'
    }));
    
    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const request = replenishmentService.getRequestWithFullHistory(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: '补货申请不存在' });
    }
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { departmentId, materialId, requestedQuantity, reason, requester } = req.body;
    
    if (!departmentId || !materialId || !requestedQuantity || !requester) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必填参数: departmentId, materialId, requestedQuantity, requester' 
      });
    }
    
    const request = replenishmentService.createRequest({
      departmentId: parseInt(departmentId),
      materialId: parseInt(materialId),
      requestedQuantity: parseInt(requestedQuantity),
      reason,
      requester
    });
    
    res.status(201).json({ 
      success: true, 
      data: request,
      message: `补货申请已提交，单号: ${request.request_no}`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/approve', (req, res) => {
  try {
    const { auditor, approvedQuantity, comments } = req.body;
    
    if (!auditor) {
      return res.status(400).json({ success: false, error: '缺少审核人信息: auditor' });
    }
    
    const request = replenishmentService.approveRequest(req.params.id, {
      auditor,
      approvedQuantity: approvedQuantity ? parseInt(approvedQuantity) : undefined,
      comments
    });
    
    res.json({ 
      success: true, 
      data: request,
      message: `审核通过，单号: ${request.request_no}`
    });
  } catch (error) {
    const statusCode = error.message.includes('状态') ? 409 : 400;
    res.status(statusCode).json({ success: false, error: error.message });
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const { auditor, comments } = req.body;
    
    if (!auditor) {
      return res.status(400).json({ success: false, error: '缺少审核人信息: auditor' });
    }
    
    const request = replenishmentService.rejectRequest(req.params.id, {
      auditor,
      comments
    });
    
    res.json({ 
      success: true, 
      data: request,
      message: `审核已拒绝，单号: ${request.request_no}`
    });
  } catch (error) {
    const statusCode = error.message.includes('状态') ? 409 : 400;
    res.status(statusCode).json({ success: false, error: error.message });
  }
});

router.post('/:id/fulfill', (req, res) => {
  try {
    const { operator, comments } = req.body;
    
    if (!operator) {
      return res.status(400).json({ success: false, error: '缺少操作人信息: operator' });
    }
    
    const request = replenishmentService.fulfillRequest(req.params.id, {
      operator,
      comments
    });
    
    res.json({ 
      success: true, 
      data: request,
      message: `补货完成，单号: ${request.request_no}`
    });
  } catch (error) {
    const statusCode = error.message.includes('状态') ? 409 : 400;
    res.status(statusCode).json({ success: false, error: error.message });
  }
});

module.exports = router;
