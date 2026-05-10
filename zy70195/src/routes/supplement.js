const express = require('express');
const router = express.Router();
const supplementService = require('../services/supplement-service');

router.post('/', async (req, res) => {
  try {
    const supplement = await supplementService.createSupplement(req.body);
    res.status(201).json({ success: true, data: supplement });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const supplements = await supplementService.getAllSupplements();
    res.json({ success: true, data: supplements });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const supplements = await supplementService.getPendingSupplements();
    res.json({ success: true, data: supplements });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const supplement = await supplementService.getSupplementById(req.params.id);
    if (!supplement) {
      return res.status(404).json({ success: false, error: '补证申请不存在' });
    }
    res.json({ success: true, data: supplement });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const supplement = await supplementService.submitSupplement(
      req.params.id,
      req.body.new_certificate_no,
      req.body.new_expiry_date,
      req.body.submitted_by
    );
    res.json({ success: true, data: supplement });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const result = await supplementService.approveSupplement(
      req.params.id,
      req.body.approval_by || '审批员'
    );
    res.json({ 
      success: true, 
      data: result,
      message: result.unfrozen ? '补证审批通过，供应商已恢复采购资格' : '补证审批通过'
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const supplement = await supplementService.rejectSupplement(
      req.params.id,
      req.body.reason || '未通过审批',
      req.body.rejected_by || '审批员'
    );
    res.json({ success: true, data: supplement });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
