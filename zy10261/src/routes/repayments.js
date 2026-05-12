const express = require('express');
const router = express.Router();
const RepaymentService = require('../services/RepaymentService');

router.post('/', async (req, res) => {
  try {
    const result = await RepaymentService.createRepayment(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const repayment = await RepaymentService.getRepaymentDetail(req.params.id);
    res.json({ success: true, data: repayment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/contract/:contractId', async (req, res) => {
  try {
    const repayments = await RepaymentService.listRepayments(req.params.contractId);
    res.json({ success: true, data: repayments });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/trial', async (req, res) => {
  try {
    const { contractId, repaymentAmount } = req.body;
    const trial = await RepaymentService.calculateTrial(contractId, repaymentAmount);
    res.json({ success: true, data: trial });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
