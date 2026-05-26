import { Router } from 'express';
import * as importService from '../services/importService';
import * as recordService from '../services/recordService';
import * as auditService from '../services/auditService';
import * as privacyService from '../services/privacyService';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

router.post('/import/customers', async (req, res) => {
  try {
    const { filePath, operator } = req.body;
    const result = await importService.importCustomersFromJson(filePath, operator);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/medicines', async (req, res) => {
  try {
    const { filePath, operator } = req.body;
    const result = await importService.importMedicinesFromJson(filePath, operator);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/rules', async (req, res) => {
  try {
    const { filePath, operator } = req.body;
    const result = await importService.importFollowUpRulesFromJson(filePath, operator);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/purchases', async (req, res) => {
  try {
    const { filePath, operator } = req.body;
    const result = await importService.importPurchaseRecordsFromCsv(filePath, operator);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/records/pending', (req, res) => {
  try {
    const { batchId } = req.query;
    const records = recordService.getPendingRecords(batchId as string);
    res.json({ total: records.length, records });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/records/:id', (req, res) => {
  try {
    const record = recordService.getRecordById(req.params.id);
    if (!record) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/records/:id/audit', (req, res) => {
  try {
    const result = recordService.getRecordWithAuditTrail(req.params.id);
    if (!result) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/records/:id/process', (req, res) => {
  try {
    const { action, reason, operator, notes } = req.body;
    if (!['approve', 'reject', 'return'].includes(action)) {
      res.status(400).json({ error: '无效的操作类型' });
      return;
    }
    if (!reason || !operator) {
      res.status(400).json({ error: '原因和处理人不能为空' });
      return;
    }
    const record = recordService.processRecord(req.params.id, action, reason, operator, notes);
    if (!record) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/records/query', (req, res) => {
  try {
    const filter = req.body;
    const records = recordService.queryRecords(filter);
    res.json({ total: records.length, records });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/records/export', (req, res) => {
  try {
    const filter = req.body;
    const records = recordService.exportRecords(filter);
    res.json({
      total: records.length,
      records,
      exportTime: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/customers', (req, res) => {
  try {
    const db = require('../database').getDb();
    const customers = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all() as any[];
    const maskedCustomers = customers.map(c => ({
      ...c,
      tags: JSON.parse(c.tags || '[]'),
      idCard: privacyService.maskIdCard(c.id_card),
      phone: privacyService.maskPhone(c.phone),
      address: privacyService.maskAddress(c.address)
    }));
    res.json({ total: maskedCustomers.length, customers: maskedCustomers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/medicines', (req, res) => {
  try {
    const db = require('../database').getDb();
    const medicines = db.prepare('SELECT * FROM medicines').all() as any[];
    const result = medicines.map(m => ({
      ...m,
      contraindications: JSON.parse(m.contraindications || '[]'),
      isControlled: m.is_controlled === 1,
      minIntervalDays: m.min_interval_days,
      maxDosage: m.max_dosage
    }));
    res.json({ total: result.length, medicines: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit/logs', (req, res) => {
  try {
    const { operator, recordId } = req.query;
    let logs;
    if (recordId) {
      logs = auditService.getAuditLogsForRecord(recordId as string);
    } else if (operator) {
      logs = auditService.getAuditLogsByOperator(operator as string);
    } else {
      res.status(400).json({ error: '请提供operator或recordId参数' });
      return;
    }
    res.json({ total: logs.length, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batches', (req, res) => {
  try {
    const db = require('../database').getDb();
    const batches = db.prepare('SELECT * FROM batches ORDER BY created_at DESC').all();
    res.json({ total: batches.length, batches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
