const express = require('express');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { createAuditLog, AuditAction, AuditModule, AuditStatus } = require('../utils/audit');
const {
  getGateRecordById,
  getGateRecords,
  verifyVisitor,
  verifyVehicle,
  manualPass,
  manualReject
} = require('../models/gateRecord');

const router = express.Router();

router.post('/verify/visitor', asyncHandler(async (req, res) => {
  const { gate_no, id_card, phone, plate_number, operator } = req.body;

  if (!gate_no) {
    throw new ValidationError('门岗编号不能为空');
  }

  if (!id_card && !phone && !plate_number) {
    throw new ValidationError('至少提供身份证、手机号或车牌号码之一');
  }

  const result = await verifyVisitor({
    gate_no,
    id_card,
    phone,
    plate_number,
    operator: operator || 'system'
  });

  await createAuditLog(AuditAction.CHECK, AuditModule.GATE, AuditStatus.SUCCESS, {
    operator: operator || 'system',
    ipAddress: req.ip,
    requestId: req.requestId,
    requestData: req.body,
    responseData: { passed: result.passed }
  });

  res.json({
    success: true,
    data: {
      passed: result.passed,
      reason: result.reason,
      gateRecord: result.gateRecord,
      visitor: result.visitor,
      blacklistItem: result.blacklistItem
    }
  });
}));

router.post('/verify/vehicle', asyncHandler(async (req, res) => {
  const { gate_no, plate_number, operator } = req.body;

  if (!gate_no) {
    throw new ValidationError('门岗编号不能为空');
  }

  if (!plate_number) {
    throw new ValidationError('车牌号码不能为空');
  }

  const result = await verifyVehicle({
    gate_no,
    plate_number,
    operator: operator || 'system'
  });

  await createAuditLog(AuditAction.CHECK, AuditModule.GATE, AuditStatus.SUCCESS, {
    operator: operator || 'system',
    ipAddress: req.ip,
    requestId: req.requestId,
    requestData: req.body,
    responseData: { passed: result.passed }
  });

  res.json({
    success: true,
    data: {
      passed: result.passed,
      reason: result.reason,
      gateRecord: result.gateRecord,
      plateInfo: result.plateInfo,
      blacklistItem: result.blacklistItem
    }
  });
}));

router.post('/manual/pass', asyncHandler(async (req, res) => {
  const { gate_no, subject_type, subject_name, plate_number, id_card, reason, operator } = req.body;

  if (!gate_no) {
    throw new ValidationError('门岗编号不能为空');
  }

  const record = await manualPass({
    gate_no,
    subject_type,
    subject_name,
    plate_number,
    id_card,
    reason,
    operator: operator || 'system'
  });

  await createAuditLog(AuditAction.PASS, AuditModule.GATE, AuditStatus.SUCCESS, {
    operator: operator || 'system',
    ipAddress: req.ip,
    requestId: req.requestId,
    requestData: req.body,
    responseData: record
  });

  res.json({
    success: true,
    data: record
  });
}));

router.post('/manual/reject', asyncHandler(async (req, res) => {
  const { gate_no, subject_type, subject_name, plate_number, id_card, reason, operator } = req.body;

  if (!gate_no) {
    throw new ValidationError('门岗编号不能为空');
  }

  const record = await manualReject({
    gate_no,
    subject_type,
    subject_name,
    plate_number,
    id_card,
    reason,
    operator: operator || 'system'
  });

  await createAuditLog(AuditAction.REJECT, AuditModule.GATE, AuditStatus.SUCCESS, {
    operator: operator || 'system',
    ipAddress: req.ip,
    requestId: req.requestId,
    requestData: req.body,
    responseData: record
  });

  res.json({
    success: true,
    data: record
  });
}));

router.get('/records', asyncHandler(async (req, res) => {
  const {
    page = 1,
    pageSize = 20,
    gate_no,
    check_type,
    subject_type,
    check_result,
    plate_number,
    subject_name,
    start_time,
    end_time
  } = req.query;

  const result = await getGateRecords(
    {
      gate_no,
      check_type,
      subject_type,
      check_result,
      plate_number,
      subject_name,
      start_time,
      end_time
    },
    parseInt(page),
    parseInt(pageSize)
  );

  res.json({
    success: true,
    data: result.list,
    pagination: result.pagination
  });
}));

router.get('/records/:id', asyncHandler(async (req, res) => {
  const record = await getGateRecordById(req.params.id);
  if (!record) {
    throw new NotFoundError('门禁记录不存在');
  }

  res.json({
    success: true,
    data: record
  });
}));

module.exports = router;
