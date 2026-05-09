const express = require('express');
const router = express.Router();
const TransferService = require('../services/transfer.service');
const TransferExecutionService = require('../services/transfer-execution.service');
const DormTransferOrchestrator = require('../services/orchestrator.service');
const DormRepository = require('../repositories/dorm.repository');
const StudentRepository = require('../repositories/student.repository');

router.post('/applications', (req, res) => {
  try {
    const { student_id, original_bed_id, target_bed_id, reason, note } = req.body;
    
    if (!student_id || !original_bed_id || !target_bed_id || !reason) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: student_id, original_bed_id, target_bed_id, reason'
      });
    }
    
    const result = TransferService.createApplication(
      student_id,
      original_bed_id,
      target_bed_id,
      reason,
      note
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/applications', (req, res) => {
  const { status } = req.query;
  const applications = TransferService.getApplications(status);
  res.json({ success: true, data: applications });
});

router.get('/applications/:id', (req, res) => {
  const app = TransferService.getApplicationById(parseInt(req.params.id));
  if (!app) {
    return res.status(404).json({ success: false, message: '申请不存在' });
  }
  res.json({ success: true, data: app });
});

router.get('/applications/no/:applicationNo', (req, res) => {
  const app = TransferService.getApplicationByNo(req.params.applicationNo);
  if (!app) {
    return res.status(404).json({ success: false, message: '申请不存在' });
  }
  res.json({ success: true, data: app });
});

router.post('/applications/:id/approve', (req, res) => {
  try {
    const { approver_name, comment } = req.body;
    if (!approver_name) {
      return res.status(400).json({
        success: false,
        message: '缺少审批人姓名'
      });
    }
    
    const result = TransferService.approveApplication(
      parseInt(req.params.id),
      approver_name,
      comment
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/applications/:id/reject', (req, res) => {
  try {
    const { approver_name, reason } = req.body;
    if (!approver_name || !reason) {
      return res.status(400).json({
        success: false,
        message: '缺少审批人姓名或拒绝原因'
      });
    }
    
    const result = TransferService.rejectApplication(
      parseInt(req.params.id),
      approver_name,
      reason
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/applications/:id/withdraw', (req, res) => {
  try {
    const { operator, reason } = req.body;
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: '缺少撤回原因'
      });
    }
    
    const result = TransferService.withdrawApplication(
      parseInt(req.params.id),
      operator || 'admin',
      reason
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/applications/:id/execute', (req, res) => {
  try {
    const { operator } = req.body;
    const result = TransferExecutionService.executeTransfer(
      parseInt(req.params.id),
      operator || 'system'
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/applications/:id/complete-workflow', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await DormTransferOrchestrator.completeTransferWorkflow(
      parseInt(req.params.id),
      operator || 'system'
    );
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(500).json({ success: false, ...result });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/applications/:id/reverse', (req, res) => {
  try {
    const { operator, reason } = req.body;
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: '缺少撤回原因'
      });
    }
    
    const result = TransferExecutionService.reverseTransfer(
      parseInt(req.params.id),
      operator || 'admin',
      reason
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/backdated', (req, res) => {
  try {
    const { student_id, original_bed_id, target_bed_id, reason, effective_date, operator } = req.body;
    
    if (!student_id || !original_bed_id || !target_bed_id || !reason || !effective_date) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    const result = TransferExecutionService.createBackdatedTransfer(
      student_id,
      original_bed_id,
      target_bed_id,
      reason,
      effective_date,
      operator || 'admin'
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/workflow/:applicationId/status', (req, res) => {
  const status = DormTransferOrchestrator.getWorkflowStatus(parseInt(req.params.applicationId));
  if (status.error) {
    return res.status(404).json({ success: false, message: status.error });
  }
  res.json({ success: true, data: status });
});

module.exports = router;