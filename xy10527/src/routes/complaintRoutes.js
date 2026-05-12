const express = require('express');
const complaintService = require('../services/ComplaintService');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    const complaint = complaintService.createComplaint(req.body, idempotencyKey);
    res.status(201).json({
      success: true,
      data: {
        complaintId: complaint.id,
        complaintNo: complaint.complaintNo,
        status: complaint.status,
        rejectReason: complaint.rejectReason,
        rejectNote: complaint.rejectNote,
        isDuplicateOf: complaint.isDuplicateOf
      }
    });
  } catch (error) {
    logger.error('创建投诉失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:complaintId', (req, res) => {
  const detail = complaintService.getComplaintDetail(req.params.complaintId);
  if (!detail) {
    return res.status(404).json({ success: false, error: '投诉不存在' });
  }
  res.json({ success: true, data: detail });
});

router.get('/', (req, res) => {
  try {
    const { status, orderId, userId, groupLeaderId, startTime, endTime } = req.query;
    const complaints = complaintService.queryComplaints({
      status,
      orderId,
      userId,
      groupLeaderId,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined
    });
    res.json({
      success: true,
      data: complaints.map(c => ({
        id: c.id,
        complaintNo: c.complaintNo,
        orderNo: c.orderNo,
        userId: c.userId,
        groupLeaderId: c.groupLeaderId,
        status: c.status,
        filedTime: c.filedTime,
        updatedAt: c.updatedAt
      }))
    });
  } catch (error) {
    logger.error('查询投诉失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:complaintId/evidence', (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    const { evidence, operatorId, operatorName } = req.body;
    const result = complaintService.addEvidence(
      req.params.complaintId,
      evidence,
      operatorId,
      operatorName,
      idempotencyKey
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('添加证据失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:complaintId/submit-leader-confirm', (req, res) => {
  try {
    const { operatorId, operatorName } = req.body;
    const result = complaintService.submitForLeaderConfirm(
      req.params.complaintId,
      operatorId,
      operatorName
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('提交团长确认失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:complaintId/leader-confirm', (req, res) => {
  try {
    const { confirmData, operatorId, operatorName } = req.body;
    const result = complaintService.leaderConfirm(
      req.params.complaintId,
      confirmData,
      operatorId,
      operatorName
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('团长确认失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:complaintId/trial-calculate', (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    const { operatorId, operatorName } = req.body;
    const result = complaintService.trialCalculate(
      req.params.complaintId,
      operatorId,
      operatorName,
      idempotencyKey
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('试算失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:complaintId/approve', (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    const { decision, comment, operatorId, operatorName } = req.body;
    const result = complaintService.approve(
      req.params.complaintId,
      decision,
      comment,
      operatorId,
      operatorName,
      idempotencyKey
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('审批失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:complaintId/process-payment', (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    const result = complaintService.processPayment(
      req.params.complaintId,
      req.body,
      idempotencyKey
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('打款失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:complaintId/payment-callback', (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    const { paymentNo, callbackData } = req.body;
    const result = complaintService.handlePaymentCallback(
      req.params.complaintId,
      paymentNo,
      callbackData,
      idempotencyKey
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('处理回调失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:complaintId/manual-correct', (req, res) => {
  try {
    const { correctionData, operatorId, operatorName } = req.body;
    const result = complaintService.manualCorrect(
      req.params.complaintId,
      correctionData,
      operatorId,
      operatorName
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('人工修正失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:complaintId/retry-exception', (req, res) => {
  try {
    const { operatorId, operatorName } = req.body;
    const result = complaintService.retryException(
      req.params.complaintId,
      operatorId,
      operatorName
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('重试异常失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/stats/summary', (req, res) => {
  try {
    const { status, groupLeaderId, startTime, endTime } = req.query;
    const stats = complaintService.getStatistics({
      status,
      groupLeaderId,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined
    });
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('获取统计失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/report/export', (req, res) => {
  try {
    const { status, groupLeaderId, startTime, endTime } = req.query;
    const report = complaintService.exportReport({
      status,
      groupLeaderId,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined
    });
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="complaint-report-${Date.now()}.json"`);
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('导出报告失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
