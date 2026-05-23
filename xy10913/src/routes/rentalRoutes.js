const express = require('express');
const router = express.Router();
const { Rental, Equipment, Settlement, ExceptionLog } = require('../models/dal');
const rentalService = require('../services/rentalService');

router.post('/rentals', async (req, res) => {
  try {
    const result = await rentalService.createRental(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    await rentalService.logException('/api/rentals', 'POST', req.body, error.message, 'failed', req.body.created_by);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/rentals', async (req, res) => {
  try {
    const { status } = req.query;
    const rentals = await Rental.getAll(status);
    res.json({ success: true, data: rentals });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/rentals/:id', async (req, res) => {
  try {
    const details = await rentalService.getRentalDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ success: false, error: '租赁单不存在' });
    }
    res.json({ success: true, data: details });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rentals/:id/freeze-deposit', async (req, res) => {
  try {
    const { request_id, operator } = req.body;
    const result = await rentalService.freezeDeposit(req.params.id, request_id, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    await rentalService.logException('/api/rentals/:id/freeze-deposit', 'POST', req.body, error.message, 'failed', req.body.operator);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/rentals/:id/renew', async (req, res) => {
  try {
    const { request_id, extension_days, operator } = req.body;
    const result = await rentalService.applyRenewal(req.params.id, request_id, extension_days, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    await rentalService.logException('/api/rentals/:id/renew', 'POST', req.body, error.message, 'failed', req.body.operator);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/rentals/:id/damage', async (req, res) => {
  try {
    const { damage_type, description, deduction_amount, reported_by } = req.body;
    const result = await rentalService.reportDamage(req.params.id, damage_type, description, deduction_amount, reported_by);
    res.json({ success: true, data: result });
  } catch (error) {
    await rentalService.logException('/api/rentals/:id/damage', 'POST', req.body, error.message, 'failed', req.body.reported_by);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/rentals/:id/settle', async (req, res) => {
  try {
    const { actual_end_date, generated_by } = req.body;
    const result = await rentalService.settleRental(req.params.id, actual_end_date, generated_by);
    res.json({ success: true, data: result });
  } catch (error) {
    await rentalService.logException('/api/rentals/:id/settle', 'POST', req.body, error.message, 'failed', req.body.generated_by);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/rentals/:id/manual-correction', async (req, res) => {
  try {
    const { adjustment_amount, reason, operator } = req.body;
    const result = await rentalService.manualCorrection(req.params.id, adjustment_amount, reason, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    await rentalService.logException('/api/rentals/:id/manual-correction', 'POST', req.body, error.message, 'failed', req.body.operator);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/equipment', async (req, res) => {
  try {
    const equipment = await Equipment.getAll();
    res.json({ success: true, data: equipment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/equipment', async (req, res) => {
  try {
    const id = await Equipment.create(req.body);
    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/settlements', async (req, res) => {
  try {
    const settlements = await Settlement.getAll();
    res.json({ success: true, data: settlements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/settlements/export', async (req, res) => {
  try {
    const settlements = await Settlement.getAll();
    const csvHeader = '结算单号,租赁单号,总押金,损坏扣款,逾期费,续租费,退款金额,生成时间\n';
    const csvRows = settlements.map(s => 
      `${s.settlement_no},${s.rental_id},${s.total_deposit},${s.damage_deduction},${s.overdue_fee},${s.renewal_fee},${s.refund_amount},${s.generated_at}`
    ).join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=settlements.csv');
    res.send('\ufeff' + csvHeader + csvRows);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/exceptions', async (req, res) => {
  try {
    const exceptions = await ExceptionLog.getAll();
    res.json({ success: true, data: exceptions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
