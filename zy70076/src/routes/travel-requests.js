const express = require('express');
const router = express.Router();
const travelRequestService = require('../services/travel-request-service');
const modificationService = require('../services/travel-modification-service');
const reimbursementService = require('../services/reimbursement-service');
const budgetLockService = require('../services/budget-lock-service');

router.post('/', async (req, res) => {
  try {
    const result = await travelRequestService.createTravelRequest(req.body);
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await travelRequestService.getTravelRequestById(req.params.id);
    
    if (result.success) {
      const locks = await budgetLockService.getActiveLocksByRequest(req.params.id);
      const modifications = await modificationService.getModificationsByRequest(req.params.id);
      const reimbursements = await reimbursementService.getReimbursementsByRequest(req.params.id);
      
      result.data.budgetLocks = locks;
      result.data.modifications = modifications.data;
      result.data.reimbursements = reimbursements.data;
    }
    
    const status = result.success ? 200 : 404;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.employeeId) filters.employeeId = req.query.employeeId;
    if (req.query.departmentId) filters.departmentId = req.query.departmentId;
    if (req.query.status) filters.status = req.query.status;
    
    const result = await travelRequestService.listTravelRequests(filters);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const approverInfo = req.body.approver || { name: '系统管理员' };
    const result = await travelRequestService.approveTravelRequest(req.params.id, approverInfo);
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const reason = req.body.reason || '用户主动取消';
    const result = await travelRequestService.cancelTravelRequest(req.params.id, reason);
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

router.post('/:id/modify', async (req, res) => {
  try {
    const { newEstimatedAmount, changeReason } = req.body;
    const result = await modificationService.createModification(
      req.params.id,
      parseFloat(newEstimatedAmount),
      changeReason || '用户改签'
    );
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

router.post('/modifications/:modificationId/approve', async (req, res) => {
  try {
    const result = await modificationService.approveModification(req.params.modificationId);
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

router.post('/:id/reimburse', async (req, res) => {
  try {
    const { actualAmount } = req.body;
    const result = await reimbursementService.createReimbursement(
      req.params.id,
      parseFloat(actualAmount)
    );
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

router.post('/reimbursements/:reimbursementId/settle', async (req, res) => {
  try {
    const result = await reimbursementService.settleReimbursement(req.params.reimbursementId);
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      businessCode: 'SERVER_ERROR',
      message: '服务器错误',
      data: { error: error.message }
    });
  }
});

module.exports = router;
