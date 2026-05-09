const express = require('express');
const router = express.Router();
const transferService = require('../services/transferService');
const taskService = require('../services/taskService');

router.get('/', (req, res) => {
  const { assetId, status, outgoingDepartment, incomingDepartment } = req.query;
  const transfers = transferService.listTransfers({
    assetId,
    status,
    outgoingDepartment,
    incomingDepartment
  });
  
  res.json({
    success: true,
    data: transfers
  });
});

router.get('/:id', (req, res) => {
  const transfer = transferService.getTransferById(req.params.id);
  if (!transfer) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'TRANSFER_NOT_FOUND',
        message: '调拨单不存在'
      }
    });
  }
  
  res.json({
    success: true,
    data: transfer
  });
});

router.get('/:id/history', (req, res) => {
  const history = transferService.getApprovalHistory(req.params.id);
  
  res.json({
    success: true,
    data: history
  });
});

router.post('/', (req, res) => {
  const transfer = transferService.createTransfer(req.body);
  
  res.status(201).json({
    success: true,
    data: transfer
  });
});

router.post('/:id/submit', (req, res) => {
  const { operator } = req.body;
  const transfer = transferService.submitForApproval(req.params.id, operator);
  
  res.json({
    success: true,
    data: transfer,
    message: '调拨单已提交审批'
  });
});

router.post('/:id/approve', (req, res) => {
  const { operator, remark } = req.body;
  const transfer = transferService.approve(req.params.id, operator, remark);
  
  taskService.createTask('SEND_NOTIFICATION', {
    type: 'TRANSFER_APPROVED',
    recipient: transfer.outgoingResponsiblePersonId,
    message: `您发起的资产调拨单「${transfer.assetNo}」已审批通过`
  });
  
  res.json({
    success: true,
    data: transfer,
    message: '调拨单已批准'
  });
});

router.post('/:id/reject', (req, res) => {
  const { operator, remark } = req.body;
  const transfer = transferService.reject(req.params.id, operator, remark);
  
  taskService.createTask('SEND_NOTIFICATION', {
    type: 'TRANSFER_REJECTED',
    recipient: transfer.outgoingResponsiblePersonId,
    message: `您发起的资产调拨单「${transfer.assetNo}」被拒绝：${remark || '未提供原因'}`
  });
  
  res.json({
    success: true,
    data: transfer,
    message: '调拨单已拒绝'
  });
});

router.post('/:id/cancel', (req, res) => {
  const { operator, remark } = req.body;
  const transfer = transferService.cancel(req.params.id, operator, remark);
  
  res.json({
    success: true,
    data: transfer,
    message: '调拨单已取消'
  });
});

router.post('/:id/complete', (req, res) => {
  const { operator, remark } = req.body;
  const transfer = transferService.complete(req.params.id, operator, remark);
  
  taskService.createTask('UPDATE_FINANCE_AFTER_TRANSFER', {
    transferId: transfer.id,
    assetNo: transfer.assetNo,
    outgoingDepartment: transfer.outgoingDepartment,
    incomingDepartment: transfer.incomingDepartment,
    originalValue: transferService.getTransferById(req.params.id)?.originalValue || 0
  });
  
  taskService.createTask('SEND_NOTIFICATION', {
    type: 'TRANSFER_COMPLETED',
    recipient: transfer.incomingResponsiblePersonId,
    message: `资产「${transfer.assetNo}」已调拨到您名下，请确认接收`
  });
  
  res.json({
    success: true,
    data: transfer,
    message: '调拨已完成，责任人和折旧部门已更新'
  });
});

module.exports = router;
