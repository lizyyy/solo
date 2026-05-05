const express = require('express');
const router = express.Router();
const SagaCoordinator = require('../services/saga-coordinator');
const IdempotencyManager = require('../utils/idempotency');
const TimelineManager = require('../utils/timeline');
const ReportExporter = require('../utils/report-exporter');
const FailureInjector = require('../utils/failure-injector');
const WarehouseService = require('../services/warehouse-service');
const AccountingService = require('../services/accounting-service');
const LogisticsService = require('../services/logistics-service');

router.post('/transfer', async (req, res) => {
  try {
    const {
      sku,
      fromLocation,
      toLocation,
      quantity,
      payerAccount,
      payeeAccount,
      amount,
      fromAddress,
      toAddress
    } = req.body;

    const idempotencyKey = req.headers['x-idempotency-key'] || null;

    if (!sku || !fromLocation || !toLocation || !quantity ||
        !payerAccount || !payeeAccount || !amount ||
        !fromAddress || !toAddress) {
      return res.status(400).json({
        error: '缺少必填参数',
        required: [
          'sku', 'fromLocation', 'toLocation', 'quantity',
          'payerAccount', 'payeeAccount', 'amount',
          'fromAddress', 'toAddress'
        ]
      });
    }

    if (idempotencyKey) {
      const idempotencyResult = IdempotencyManager.checkAndRecord(
        idempotencyKey,
        'pending'
      );

      if (idempotencyResult.isDuplicate) {
        const existingTx = idempotencyResult.existingTransaction;
        return res.status(200).json({
          isDuplicate: true,
          transaction: {
            transactionId: existingTx.id,
            status: existingTx.status,
            message: '重复请求，返回已有事务'
          }
        });
      }
    }

    const payload = {
      sku,
      fromLocation,
      toLocation,
      quantity: parseInt(quantity),
      payerAccount,
      payeeAccount,
      amount: parseFloat(amount),
      fromAddress,
      toAddress
    };

    const result = await SagaCoordinator.executeTransfer(payload, idempotencyKey);

    if (idempotencyKey && !result.error) {
      const db = require('../config/database');
      db.prepare(`
        UPDATE idempotency_keys SET transaction_id = ? WHERE key = ?
      `).run(result.transactionId, idempotencyKey);
    }

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.post('/create', async (req, res) => {
  try {
    const payload = req.body;
    const idempotencyKey = req.headers['x-idempotency-key'] || null;

    if (idempotencyKey) {
      const existingTx = IdempotencyManager.getTransactionByKey(idempotencyKey);
      if (existingTx) {
        return res.status(200).json({
          isDuplicate: true,
          transaction: {
            transactionId: existingTx.id,
            status: existingTx.status
          }
        });
      }
    }

    const result = SagaCoordinator.createTransaction(payload, idempotencyKey);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:transactionId/prepare', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = SagaCoordinator.getTransaction(transactionId);
    
    if (!transaction) {
      return res.status(404).json({ error: '事务不存在' });
    }

    const result = await SagaCoordinator.preparePhase(transactionId, transaction.payload);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:transactionId/confirm', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { shipmentNo } = req.body;
    
    const transaction = SagaCoordinator.getTransaction(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: '事务不存在' });
    }

    const shipment = shipmentNo || LogisticsService.getShipmentByTransaction(transactionId)?.shipment_no;
    
    if (!shipment) {
      return res.status(400).json({ error: '缺少运单号' });
    }

    const result = await SagaCoordinator.confirmPhase(transactionId, transaction.payload, shipment);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:transactionId/cancel', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { shipmentNo } = req.body;
    
    const transaction = SagaCoordinator.getTransaction(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: '事务不存在' });
    }

    const shipment = shipmentNo || LogisticsService.getShipmentByTransaction(transactionId)?.shipment_no;

    const result = await SagaCoordinator.cancelTransaction(transactionId, transaction.payload, shipment);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:transactionId', (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = SagaCoordinator.getTransaction(transactionId);
    
    if (!transaction) {
      return res.status(404).json({ error: '事务不存在' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:transactionId/timeline', (req, res) => {
  try {
    const { transactionId } = req.params;
    const timeline = TimelineManager.getTimelineWithDetails(transactionId);
    
    if (!timeline) {
      return res.status(404).json({ error: '事务不存在' });
    }

    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:transactionId/report/json', (req, res) => {
  try {
    const { transactionId } = req.params;
    const report = ReportExporter.exportJSON(transactionId);
    
    if (report.error) {
      return res.status(404).json(report);
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:transactionId/report/markdown', (req, res) => {
  try {
    const { transactionId } = req.params;
    const report = ReportExporter.exportMarkdown(transactionId);
    
    res.set('Content-Type', 'text/markdown');
    res.send(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const transactions = TimelineManager.listAllTransactions();
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
