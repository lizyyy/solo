const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const parsers = require('../parsers');
const rules = require('../rules');
const stateMachine = require('../state-machine');
const storage = require('../storage');
const exporters = require('../exporters');

const upload = multer({ dest: path.join(__dirname, '..', '..', 'uploads') });

module.exports = (db) => {
  const router = express.Router();

  router.post('/import/cylinder-ledger', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '请上传CSV文件' });
      }

      const filePath = req.file.path;
      const cylinders = await parsers.parseCylinderLedgerCSV(filePath);
      
      const results = [];
      const errors = [];

      for (const cylinder of cylinders) {
        try {
          const validation = parsers.validateCylinder(cylinder);
          if (!validation.valid) {
            errors.push({ serialNumber: cylinder.serialNumber, errors: validation.errors });
            continue;
          }

          const result = await storage.saveOrUpdateCylinder(db, cylinder);
          results.push(result);
          
          await storage.logAudit(db, {
            operation: 'IMPORT',
            tableName: 'cylinders',
            recordId: result.id,
            newValues: JSON.stringify(cylinder),
            user: 'system',
            ipAddress: req.ip
          });
        } catch (err) {
          errors.push({ serialNumber: cylinder.serialNumber, error: err.message });
        }
      }

      fs.unlinkSync(filePath);

      res.json({
        success: true,
        imported: results.length,
        failed: errors.length,
        results,
        errors
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/import/inspection-records', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '请上传JSON文件' });
      }

      const filePath = req.file.path;
      const inspections = await parsers.parseInspectionRecordsJSON(filePath);
      
      const results = [];
      const errors = [];

      for (const inspection of inspections) {
        try {
          const validation = parsers.validateInspection(inspection);
          if (!validation.valid) {
            errors.push({ serialNumber: inspection.serialNumber, errors: validation.errors });
            continue;
          }

          const cylinder = await storage.getCylinderBySerialNumber(db, inspection.serialNumber);
          if (!cylinder) {
            errors.push({ serialNumber: inspection.serialNumber, error: '气瓶不存在' });
            continue;
          }

          const result = await storage.saveInspection(db, cylinder.id, inspection);
          results.push(result);
          
          await storage.logAudit(db, {
            operation: 'IMPORT',
            tableName: 'inspections',
            recordId: result.id,
            newValues: JSON.stringify(inspection),
            user: 'system',
            ipAddress: req.ip
          });
        } catch (err) {
          errors.push({ serialNumber: inspection.serialNumber, error: err.message });
        }
      }

      fs.unlinkSync(filePath);

      res.json({
        success: true,
        imported: results.length,
        failed: errors.length,
        results,
        errors
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/import/transaction-records', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '请上传文件' });
      }

      const filePath = req.file.path;
      const transactions = await parsers.parseTransactionRecords(filePath);
      
      const results = [];
      const errors = [];

      for (const transaction of transactions) {
        try {
          const validation = parsers.validateTransaction(transaction);
          if (!validation.valid) {
            errors.push({ serialNumber: transaction.serialNumber, errors: validation.errors });
            continue;
          }

          const cylinder = await storage.getCylinderBySerialNumber(db, transaction.serialNumber);
          if (!cylinder) {
            errors.push({ serialNumber: transaction.serialNumber, error: '气瓶不存在' });
            continue;
          }

          const result = await stateMachine.processTransaction(db, cylinder, transaction);
          results.push(result);
          
          await storage.logAudit(db, {
            operation: 'TRANSACTION',
            tableName: 'transactions',
            recordId: result.transactionId,
            newValues: JSON.stringify(transaction),
            user: 'system',
            ipAddress: req.ip
          });
        } catch (err) {
          errors.push({ serialNumber: transaction.serialNumber, error: err.message });
        }
      }

      fs.unlinkSync(filePath);

      res.json({
        success: true,
        imported: results.length,
        failed: errors.length,
        results,
        errors
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/import/transfer-records', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '请上传文件' });
      }

      const filePath = req.file.path;
      const transfers = await parsers.parseTransferRecords(filePath);
      
      const results = [];
      const errors = [];

      for (const transfer of transfers) {
        try {
          const validation = parsers.validateTransfer(transfer);
          if (!validation.valid) {
            errors.push({ transferNumber: transfer.transferNumber, errors: validation.errors });
            continue;
          }

          const result = await storage.saveTransfer(db, transfer);
          results.push(result);
          
          await storage.logAudit(db, {
            operation: 'IMPORT',
            tableName: 'transfers',
            recordId: result.id,
            newValues: JSON.stringify(transfer),
            user: 'system',
            ipAddress: req.ip
          });
        } catch (err) {
          errors.push({ transferNumber: transfer.transferNumber, error: err.message });
        }
      }

      fs.unlinkSync(filePath);

      res.json({
        success: true,
        imported: results.length,
        failed: errors.length,
        results,
        errors
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/inventory', async (req, res) => {
    try {
      const { status, gasType, location, serialNumber } = req.query;
      const filters = {};
      if (status) filters.status = status;
      if (gasType) filters.gasType = gasType;
      if (location) filters.location = location;
      if (serialNumber) filters.serialNumber = serialNumber;

      const inventory = await storage.getInventory(db, filters);
      res.json(inventory);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/inventory/stats', async (req, res) => {
    try {
      const stats = await storage.getInventoryStats(db);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/cylinders/:serialNumber', async (req, res) => {
    try {
      const { serialNumber } = req.params;
      const cylinder = await storage.getCylinderBySerialNumber(db, serialNumber);
      
      if (!cylinder) {
        return res.status(404).json({ error: '气瓶不存在' });
      }

      const transactions = await storage.getCylinderTransactions(db, cylinder.id);
      const inspections = await storage.getCylinderInspections(db, cylinder.id);

      res.json({
        cylinder,
        transactions,
        inspections
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/transactions/borrow', async (req, res) => {
    try {
      const { serialNumber, department, person, notes } = req.body;
      
      if (!serialNumber) {
        return res.status(400).json({ error: '请提供气瓶编号' });
      }

      const cylinder = await storage.getCylinderBySerialNumber(db, serialNumber);
      if (!cylinder) {
        return res.status(404).json({ error: '气瓶不存在' });
      }

      const risks = await rules.checkAllRisks(db, cylinder);
      if (risks.length > 0) {
        return res.status(400).json({
          error: '存在风险，无法借出',
          risks
        });
      }

      const transaction = {
        serialNumber,
        type: 'borrow',
        department,
        person,
        notes
      };

      const result = await stateMachine.processTransaction(db, cylinder, transaction);
      
      await storage.logAudit(db, {
        operation: 'BORROW',
        tableName: 'cylinders',
        recordId: cylinder.id,
        newValues: JSON.stringify({ status: 'borrowed', department, person }),
        user: 'system',
        ipAddress: req.ip
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/transactions/return', async (req, res) => {
    try {
      const { serialNumber, department, person, notes } = req.body;
      
      if (!serialNumber) {
        return res.status(400).json({ error: '请提供气瓶编号' });
      }

      const cylinder = await storage.getCylinderBySerialNumber(db, serialNumber);
      if (!cylinder) {
        return res.status(404).json({ error: '气瓶不存在' });
      }

      const transaction = {
        serialNumber,
        type: 'return',
        department,
        person,
        notes
      };

      const result = await stateMachine.processTransaction(db, cylinder, transaction);
      
      await storage.logAudit(db, {
        operation: 'RETURN',
        tableName: 'cylinders',
        recordId: cylinder.id,
        newValues: JSON.stringify({ status: 'in_stock' }),
        user: 'system',
        ipAddress: req.ip
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/transactions/scrap', async (req, res) => {
    try {
      const { serialNumber, notes } = req.body;
      
      if (!serialNumber) {
        return res.status(400).json({ error: '请提供气瓶编号' });
      }

      const cylinder = await storage.getCylinderBySerialNumber(db, serialNumber);
      if (!cylinder) {
        return res.status(404).json({ error: '气瓶不存在' });
      }

      const transaction = {
        serialNumber,
        type: 'scrap',
        notes
      };

      const result = await stateMachine.processTransaction(db, cylinder, transaction);
      
      await storage.logAudit(db, {
        operation: 'SCRAP',
        tableName: 'cylinders',
        recordId: cylinder.id,
        newValues: JSON.stringify({ status: 'scrapped' }),
        user: 'system',
        ipAddress: req.ip
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/risk-check', async (req, res) => {
    try {
      const risks = await rules.scanAllRisks(db);
      res.json({
        total: risks.length,
        byType: rules.groupRisksByType(risks),
        risks
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/risk-alerts', async (req, res) => {
    try {
      const { status, riskType } = req.query;
      const alerts = await storage.getRiskAlerts(db, { status, riskType });
      res.json(alerts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/risk-alerts/:id/review', async (req, res) => {
    try {
      const { id } = req.params;
      const { action, notes, reviewedBy } = req.body;

      const alert = await storage.getRiskAlertById(db, id);
      if (!alert) {
        return res.status(404).json({ error: '风险告警不存在' });
      }

      const result = await storage.reviewRiskAlert(db, id, {
        action,
        notes,
        reviewedBy: reviewedBy || 'system'
      });

      await storage.logAudit(db, {
        operation: 'REVIEW_ALERT',
        tableName: 'risk_alerts',
        recordId: id,
        newValues: JSON.stringify({ action, notes, reviewedBy }),
        user: reviewedBy || 'system',
        ipAddress: req.ip
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/export/audit/markdown', async (req, res) => {
    try {
      const { startDate, endDate, operation } = req.query;
      const logs = await storage.getAuditLogs(db, { startDate, endDate, operation });
      const markdown = exporters.exportToMarkdown(logs);
      
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-log.md');
      res.send(markdown);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/export/audit/csv', async (req, res) => {
    try {
      const { startDate, endDate, operation } = req.query;
      const logs = await storage.getAuditLogs(db, { startDate, endDate, operation });
      const csv = exporters.exportToCSV(logs);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-log.csv');
      res.send(csv);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/export/audit/json', async (req, res) => {
    try {
      const { startDate, endDate, operation } = req.query;
      const logs = await storage.getAuditLogs(db, { startDate, endDate, operation });
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-log.json');
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/export/inventory/markdown', async (req, res) => {
    try {
      const { status, gasType } = req.query;
      const inventory = await storage.getInventory(db, { status, gasType });
      const stats = await storage.getInventoryStats(db);
      const markdown = exporters.exportInventoryToMarkdown(inventory, stats);
      
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory.md');
      res.send(markdown);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/export/inventory/csv', async (req, res) => {
    try {
      const { status, gasType } = req.query;
      const inventory = await storage.getInventory(db, { status, gasType });
      const csv = exporters.exportInventoryToCSV(inventory);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv');
      res.send(csv);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/export/inventory/json', async (req, res) => {
    try {
      const { status, gasType } = req.query;
      const inventory = await storage.getInventory(db, { status, gasType });
      const stats = await storage.getInventoryStats(db);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory.json');
      res.json({ stats, inventory });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return router;
};
