const express = require('express');
const router = express.Router();
const RepairService = require('../services/RepairService');
const ImpactService = require('../services/ImpactService');
const ReportService = require('../services/ReportService');
const { asyncHandler, NotFoundError, ValidationError, StateError } = require('../utils/errorHandler');

router.get('/', asyncHandler(async (req, res) => {
  const { status, priority } = req.query;
  const orders = await RepairService.getAllOrders({ status, priority });
  
  res.json({
    success: true,
    data: orders
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const {
    title,
    description,
    reportSource,
    priority,
    faultLocation,
    faultLongitude,
    faultLatitude,
    faultType,
    affectedPipeId,
    reportedBy,
    reportedPhone
  } = req.body;
  
  if (!title || !description || !faultLocation || faultLongitude == null || faultLatitude == null) {
    throw new ValidationError('缺少必要参数: title, description, faultLocation, faultLongitude, faultLatitude');
  }
  
  const order = await RepairService.createOrder({
    title,
    description,
    reportSource: reportSource || 'patrol',
    priority: priority || 'medium',
    faultLocation,
    faultLongitude,
    faultLatitude,
    faultType,
    affectedPipeId,
    reportedBy,
    reportedPhone
  });
  
  res.status(201).json({
    success: true,
    data: order
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const order = await RepairService.getOrderById(req.params.id);
  
  if (!order) {
    throw new NotFoundError(`抢修工单 ${req.params.id} 不存在`);
  }
  
  res.json({
    success: true,
    data: order
  });
}));

router.get('/:id/details', asyncHandler(async (req, res) => {
  const details = await RepairService.getOrderWithDetails(req.params.id);
  
  if (!details) {
    throw new NotFoundError(`抢修工单 ${req.params.id} 不存在`);
  }
  
  res.json({
    success: true,
    data: details
  });
}));

router.put('/:id/assign', asyncHandler(async (req, res) => {
  const { assignedTo } = req.body;
  
  if (!assignedTo) {
    throw new ValidationError('请指定指派人员');
  }
  
  try {
    const order = await RepairService.assignOrder(req.params.id, assignedTo);
    res.json({
      success: true,
      message: `工单已指派给 ${assignedTo}`,
      data: order
    });
  } catch (error) {
    throw new StateError(error.message);
  }
}));

router.post('/:id/impact-analysis', asyncHandler(async (req, res) => {
  const { valveIds } = req.body;
  
  if (!Array.isArray(valveIds) || valveIds.length === 0) {
    throw new ValidationError('请提供要关闭的阀门ID数组');
  }
  
  const order = await RepairService.getOrderById(req.params.id);
  if (!order) {
    throw new NotFoundError(`抢修工单 ${req.params.id} 不存在`);
  }
  
  try {
    const analysis = await ImpactService.createAnalysis(req.params.id, valveIds);
    
    res.status(201).json({
      success: true,
      needsReview: analysis.needsReview,
      data: analysis,
      warnings: JSON.parse(analysis.warningFlags || '[]')
    });
  } catch (error) {
    throw new ValidationError(error.message);
  }
}));

router.put('/:id/impact-analysis/:analysisId/confirm', asyncHandler(async (req, res) => {
  const { reviewer, notes } = req.body;
  
  if (!reviewer) {
    throw new ValidationError('请指定复核人');
  }
  
  try {
    const analysis = await ImpactService.confirmAnalysis(req.params.analysisId, reviewer, notes);
    res.json({
      success: true,
      message: '影响分析已确认',
      data: analysis
    });
  } catch (error) {
    throw new StateError(error.message);
  }
}));

router.put('/:id/impact-analysis/:analysisId/update', asyncHandler(async (req, res) => {
  const { valveIds } = req.body;
  
  if (!Array.isArray(valveIds) || valveIds.length === 0) {
    throw new ValidationError('请提供新的阀门ID数组');
  }
  
  try {
    const analysis = await ImpactService.updateAnalysis(req.params.analysisId, valveIds);
    res.json({
      success: true,
      needsReview: analysis.needsReview,
      data: analysis,
      warnings: JSON.parse(analysis.warningFlags || '[]')
    });
  } catch (error) {
    throw new ValidationError(error.message);
  }
}));

router.put('/:id/impact-analysis/:analysisId/finalize', asyncHandler(async (req, res) => {
  try {
    const analysis = await ImpactService.finalizeAnalysis(req.params.analysisId);
    res.json({
      success: true,
      message: '影响分析已最终确认，阀门已关闭',
      data: analysis
    });
  } catch (error) {
    throw new StateError(error.message);
  }
}));

router.put('/:id/start', asyncHandler(async (req, res) => {
  const { estimatedEndTime } = req.body;
  
  try {
    const order = await RepairService.startRepair(req.params.id, estimatedEndTime);
    res.json({
      success: true,
      message: '抢修已开始',
      data: order
    });
  } catch (error) {
    throw new StateError(error.message);
  }
}));

router.put('/:id/submit-review', asyncHandler(async (req, res) => {
  const { repairNotes } = req.body;
  
  try {
    const order = await RepairService.submitForReview(req.params.id, repairNotes);
    res.json({
      success: true,
      message: '抢修已完成，等待复核',
      data: order
    });
  } catch (error) {
    throw new StateError(error.message);
  }
}));

router.put('/:id/complete', asyncHandler(async (req, res) => {
  const { reviewNotes, reviewedBy } = req.body;
  
  if (!reviewedBy) {
    throw new ValidationError('请指定复核人');
  }
  
  try {
    const order = await RepairService.completeOrder(req.params.id, reviewNotes, reviewedBy);
    res.json({
      success: true,
      message: '工单已完成，阀门已恢复',
      data: order
    });
  } catch (error) {
    throw new StateError(error.message);
  }
}));

router.put('/:id/cancel', asyncHandler(async (req, res) => {
  const { cancelReason } = req.body;
  
  try {
    const order = await RepairService.cancelOrder(req.params.id, cancelReason);
    res.json({
      success: true,
      message: '工单已取消',
      data: order
    });
  } catch (error) {
    throw new StateError(error.message);
  }
}));

router.get('/:id/report', asyncHandler(async (req, res) => {
  try {
    const report = await ReportService.generateWaterOutageReport(req.params.id);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    throw new NotFoundError(error.message);
  }
}));

module.exports = router;