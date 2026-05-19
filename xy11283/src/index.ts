import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';

import './database';
import { maskSensitiveData } from './utils/security';
import * as inventoryService from './services/inventoryService';
import * as dosageService from './services/dosageService';
import * as prescriptionService from './services/prescriptionService';
import * as badRecordService from './services/badRecordService';
import * as auditService from './services/auditService';
import * as importService from './services/importService';
import * as reportService from './services/reportService';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.get('/', (req, res) => {
  res.json({
    message: '宠物医院药房管理系统 API',
    version: '1.0.0',
    endpoints: {
      medicines: '/api/medicines',
      inventory: '/api/inventory',
      dosage: '/api/dosage',
      prescriptions: '/api/prescriptions',
      badRecords: '/api/bad-records',
      audit: '/api/audit-logs',
      import: '/api/import',
      reports: '/api/reports'
    }
  });
});

app.get('/api/medicines', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const medicines = await inventoryService.getAllMedicines(limit, offset);
    res.json(medicines);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/medicines/:id', async (req, res) => {
  try {
    const medicine = await inventoryService.getMedicineById(parseInt(req.params.id));
    if (!medicine) {
      return res.status(404).json({ error: '药品不存在' });
    }
    res.json(medicine);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/medicines', async (req, res) => {
  try {
    const medicine = await inventoryService.createMedicine(req.body);
    res.status(201).json(medicine);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventory', async (req, res) => {
  try {
    const batches = await inventoryService.getAllInventoryBatches();
    res.json(batches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventory/summary', async (req, res) => {
  try {
    const summary = await inventoryService.getInventorySummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const batch = await inventoryService.createInventoryBatch(req.body);
    res.status(201).json(batch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dosage/rules', async (req, res) => {
  try {
    const rules = await dosageService.getAllDosageRules();
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dosage/calculate', async (req, res) => {
  try {
    const { medicineId, species, weight, weightUnit = 'kg' } = req.query;
    if (!medicineId || !species || !weight) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    const rules = await dosageService.getDosageRulesByMedicineAndSpecies(
      parseInt(medicineId as string),
      species as string
    );
    const result = dosageService.calculateDosage(
      parseFloat(weight as string),
      weightUnit as string,
      rules
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/dosage/rules', async (req, res) => {
  try {
    const rule = await dosageService.createDosageRule(req.body);
    res.status(201).json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/prescriptions', async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const prescriptions = await prescriptionService.getAllPrescriptions(status, limit, offset);
    res.json(prescriptions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/prescriptions/:id', async (req, res) => {
  try {
    const prescription = await prescriptionService.getPrescriptionById(parseInt(req.params.id));
    if (!prescription) {
      return res.status(404).json({ error: '处方不存在' });
    }
    const items = await prescriptionService.getPrescriptionItems(parseInt(req.params.id));
    res.json({ ...prescription, items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/prescriptions', async (req, res) => {
  try {
    const { prescription, items } = req.body;
    const result = await prescriptionService.createPrescription(prescription, items);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/prescriptions/:id/validate', async (req, res) => {
  try {
    const result = await prescriptionService.validatePrescription(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/prescriptions/:id/dispense', async (req, res) => {
  try {
    const result = await prescriptionService.dispensePrescription(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/prescriptions/:id/cancel', async (req, res) => {
  try {
    const prescription = await prescriptionService.cancelPrescription(parseInt(req.params.id));
    res.json(prescription);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bad-records', async (req, res) => {
  try {
    const status = req.query.status as any;
    const sourceType = req.query.sourceType as string | undefined;
    const records = await badRecordService.getBadRecords(status, sourceType);
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bad-records/:id/resolve', async (req, res) => {
  try {
    const { correctedData } = req.body;
    const record = await badRecordService.resolveBadRecord(parseInt(req.params.id), correctedData);
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bad-records/:id/ignore', async (req, res) => {
  try {
    const record = await badRecordService.ignoreBadRecord(parseInt(req.params.id));
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bad-records/stats', async (req, res) => {
  try {
    const stats = await badRecordService.getBadRecordStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const entityType = req.query.entityType as string | undefined;
    const action = req.query.action as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const logs = await auditService.getAuditLogs(entityType, undefined, action, limit, offset);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit-logs/stats', async (req, res) => {
  try {
    const stats = await auditService.getAuditLogStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import/medicines', async (req, res) => {
  try {
    const { csvContent } = req.body;
    const result = await importService.importMedicinesFromCsv(csvContent);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import/inventory', async (req, res) => {
  try {
    const { csvContent } = req.body;
    const result = await importService.importInventoryFromCsv(csvContent);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import/dosage', async (req, res) => {
  try {
    const { csvContent } = req.body;
    const result = await importService.importDosageRulesFromCsv(csvContent);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import/prescriptions', async (req, res) => {
  try {
    const { jsonContent } = req.body;
    const result = await importService.importPrescriptionsFromJson(jsonContent);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/prescription/:id/pdf', async (req, res) => {
  try {
    const pdfPath = await reportService.generatePrescriptionPdf(parseInt(req.params.id));
    res.download(pdfPath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/dosage/:medicineId', async (req, res) => {
  try {
    const { species, minWeight, maxWeight, step } = req.query;
    const report = await reportService.generateDosageReport(
      parseInt(req.params.medicineId),
      species as string,
      {
        min: parseFloat(minWeight as string),
        max: parseFloat(maxWeight as string),
        step: parseFloat(step as string) || 1
      }
    );
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const prescStats = await prescriptionService.getPrescriptionStats();
    const badRecordStats = await badRecordService.getBadRecordStats();
    const auditStats = await auditService.getAuditLogStats();
    const inventorySummary = await inventoryService.getInventorySummary();

    res.json({
      prescriptions: prescStats,
      badRecords: badRecordStats,
      auditLogs: auditStats,
      inventory: inventorySummary
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('数据目录:', dataDir);
});

export default app;
