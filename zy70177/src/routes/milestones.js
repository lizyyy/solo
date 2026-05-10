const express = require('express');
const router = express.Router();
const milestoneService = require('../services/milestone-service');
const acceptanceService = require('../services/acceptance-service');
const invoiceService = require('../services/invoice-service');

router.get('/:id', async (req, res) => {
  try {
    const milestone = await milestoneService.getMilestoneById(req.params.id);
    if (!milestone) {
      return res.status(404).json({ success: false, error: '里程碑不存在' });
    }
    res.json({ success: true, data: milestone });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/details', async (req, res) => {
  try {
    const details = await milestoneService.getMilestoneWithDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ success: false, error: '里程碑不存在' });
    }
    res.json({ success: true, data: details });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const milestone = await milestoneService.updateMilestone(req.params.id, req.body);
    res.json({ success: true, data: milestone });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/acceptances', async (req, res) => {
  try {
    const data = { ...req.body, milestone_id: parseInt(req.params.id) };
    const acceptance = await acceptanceService.createAcceptance(data);
    res.json({ success: true, data: acceptance });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/invoices', async (req, res) => {
  try {
    const data = { ...req.body, milestone_id: parseInt(req.params.id) };
    const invoice = await invoiceService.createInvoice(data);
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
