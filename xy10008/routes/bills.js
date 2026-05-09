const express = require('express');
const router = express.Router();
const { BillService, CONCURRENCY_ERROR } = require('../services/billService');
const logger = require('../utils/logger');
const { storeIdempotencyResponse } = require('../utils/idempotency');

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const includeDeleted = req.query.includeDeleted === 'true';
    
    const bills = BillService.getAllBills(limit, offset, includeDeleted);
    res.json({ success: true, data: bills });
  } catch (error) {
    logger.error('GET /api/bills error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const bill = BillService.getBillById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }
    res.json({ success: true, data: bill });
  } catch (error) {
    logger.error('GET /api/bills/:id error', { error: error.message, billId: req.params.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const bill = BillService.createBill(req.body, req);
    const responseData = { status: 201, body: { success: true, data: bill } };
    storeIdempotencyResponse(req, responseData);
    res.status(201).json(responseData.body);
  } catch (error) {
    logger.error('POST /api/bills error', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const bill = BillService.updateBill(req.params.id, req.body, req);
    const responseData = { status: 200, body: { success: true, data: bill } };
    storeIdempotencyResponse(req, responseData);
    res.json(responseData.body);
  } catch (error) {
    logger.error('PUT /api/bills/:id error', { error: error.message, billId: req.params.id });
    
    if (error.code === CONCURRENCY_ERROR) {
      return res.status(409).json({
        success: false,
        error: error.message,
        code: CONCURRENCY_ERROR,
        expectedVersion: error.expectedVersion,
        currentVersion: error.currentVersion
      });
    }
    
    if (error.message === 'Bill not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    BillService.deleteBill(req.params.id, req);
    const responseData = { status: 200, body: { success: true, message: 'Bill deleted successfully' } };
    storeIdempotencyResponse(req, responseData);
    res.json(responseData.body);
  } catch (error) {
    logger.error('DELETE /api/bills/:id error', { error: error.message, billId: req.params.id });
    if (error.message === 'Bill not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/balance', async (req, res) => {
  try {
    const balances = BillService.calculateBalance();
    res.json({ success: true, data: balances });
  } catch (error) {
    logger.error('GET /api/bills/balance error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/settlement', async (req, res) => {
  try {
    const settlement = BillService.calculateSettlement();
    res.json({ success: true, data: settlement });
  } catch (error) {
    logger.error('GET /api/bills/settlement error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const bills = BillService.getBillsByDateRange(
      startDate ? new Date(startDate).getTime() : null,
      endDate ? new Date(endDate).getTime() : null
    );
    res.json({ success: true, data: bills });
  } catch (error) {
    logger.error('GET /api/bills/range error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
