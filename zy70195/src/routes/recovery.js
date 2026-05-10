const express = require('express');
const router = express.Router();
const recoveryService = require('../services/recovery-service');

router.post('/', async (req, res) => {
  try {
    const recovery = await recoveryService.createRecoveryRequest(req.body);
    res.status(201).json({ success: true, data: recovery });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const recoveries = await recoveryService.getAllRecoveryRequests();
    res.json({ success: true, data: recoveries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const recoveries = await recoveryService.getPendingRecoveryRequests();
    res.json({ success: true, data: recoveries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const recovery = await recoveryService.getRecoveryById(req.params.id);
    if (!recovery) {
      return res.status(404).json({ success: false, error: '恢复申请不存在' });
    }
    res.json({ success: true, data: recovery });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const result = await recoveryService.approveRecovery(
      req.params.id,
      req.body.approval_by || '审批员'
    );
    res.json({ 
      success: true, 
      data: result,
      message: result.unfrozen ? '恢复申请审批通过，供应商已恢复采购资格' : '恢复申请审批通过'
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const recovery = await recoveryService.rejectRecovery(
      req.params.id,
      req.body.reason || '未通过审批',
      req.body.rejected_by || '审批员'
    );
    res.json({ success: true, data: recovery });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
