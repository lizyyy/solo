const express = require('express');
const router = express.Router();
const { PermissionValidator } = require('../validation/PermissionValidator');
const { CsvImporter, ImportError } = require('../reports/CsvImporter');
const CsvExporter = require('../reports/CsvExporter');
const MarkdownExporter = require('../reports/MarkdownExporter');
const { ChemicalRepository, BatchRepository, AuditLogRepository, RequestRepository } = require('../storage/repositories');
const AuditLog = require('../models/AuditLog');

const chemicalRepository = new ChemicalRepository();
const batchRepository = new BatchRepository();
const auditLogRepository = new AuditLogRepository();
const requestRepository = new RequestRepository();

router.get('/import-template', async (req, res, next) => {
  try {
    PermissionValidator.checkPermission(req.user.role, 'import_batch');
    const template = CsvImporter.getImportTemplate();
    res.json(template);
  } catch (err) {
    next(err);
  }
});

router.post('/import-batches', async (req, res, next) => {
  try {
    PermissionValidator.checkPermission(req.user.role, 'import_batch');
    
    let csvData;
    if (req.body.csv_content) {
      csvData = Buffer.from(req.body.csv_content, 'utf-8');
    } else if (req.body.rows) {
      const headers = Object.keys(req.body.rows[0]);
      const csvLines = [headers.join(',')];
      for (const row of req.body.rows) {
        const values = headers.map(h => `"${row[h] || ''}"`);
        csvLines.push(values.join(','));
      }
      csvData = Buffer.from(csvLines.join('\n'), 'utf-8');
    } else {
      const error = new Error('请提供 CSV 内容');
      error.status = 400;
      throw error;
    }
    
    const result = await CsvImporter.importBatches(
      csvData,
      req.user,
      chemicalRepository,
      batchRepository,
      auditLogRepository
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/export/audit/csv', async (req, res, next) => {
  try {
    PermissionValidator.checkPermission(req.user.role, 'export_report');
    
    const options = {
      action: req.query.action,
      entity_type: req.query.entity_type,
      entity_id: req.query.entity_id,
      user_id: req.query.user_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'desc',
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    
    const auditLogs = await auditLogRepository.findAll(options);
    const exportResult = await CsvExporter.exportAuditLogs(auditLogs.map(l => l.toJSON()));
    
    await auditLogRepository.logAction({
      action: AuditLog.actions.REPORT_EXPORT,
      entity_type: AuditLog.entityTypes.SYSTEM,
      description: `导出审计日志 CSV 报告，共 ${auditLogs.length} 条记录`,
      user_id: req.user.id,
      user_role: req.user.role
    });
    
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename=${exportResult.filename}`);
    res.send(exportResult.content);
  } catch (err) {
    next(err);
  }
});

router.get('/export/audit/markdown', async (req, res, next) => {
  try {
    PermissionValidator.checkPermission(req.user.role, 'export_report');
    
    const options = {
      action: req.query.action,
      entity_type: req.query.entity_type,
      entity_id: req.query.entity_id,
      user_id: req.query.user_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'desc',
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    
    const auditLogs = await auditLogRepository.findAll(options);
    const exportResult = await MarkdownExporter.exportAuditReport(
      auditLogs.map(l => l.toJSON()),
      { title: '审计日志报告' }
    );
    
    await auditLogRepository.logAction({
      action: AuditLog.actions.REPORT_EXPORT,
      entity_type: AuditLog.entityTypes.SYSTEM,
      description: `导出审计日志 Markdown 报告，共 ${auditLogs.length} 条记录`,
      user_id: req.user.id,
      user_role: req.user.role
    });
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${exportResult.filename}`);
    res.send(exportResult.content);
  } catch (err) {
    next(err);
  }
});

router.get('/export/requests/csv', async (req, res, next) => {
  try {
    PermissionValidator.checkPermission(req.user.role, 'export_report');
    
    const options = {
      requester_id: req.query.requester_id,
      chemical_id: req.query.chemical_id,
      batch_id: req.query.batch_id,
      status: req.query.status,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'desc'
    };
    
    const requests = await requestRepository.findAll(options);
    
    const enrichedRequests = [];
    for (const request of requests) {
      const batch = await batchRepository.findById(request.batch_id);
      const chemical = await chemicalRepository.findById(request.chemical_id);
      const requestJson = request.toJSON();
      requestJson.chemical = chemical?.toJSON() || null;
      requestJson.batch = batch?.toJSON() || null;
      enrichedRequests.push(requestJson);
    }
    
    const exportResult = await CsvExporter.exportRequests(enrichedRequests);
    
    await auditLogRepository.logAction({
      action: AuditLog.actions.REPORT_EXPORT,
      entity_type: AuditLog.entityTypes.SYSTEM,
      description: `导出领用申请 CSV 报告，共 ${enrichedRequests.length} 条记录`,
      user_id: req.user.id,
      user_role: req.user.role
    });
    
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename=${exportResult.filename}`);
    res.send(exportResult.content);
  } catch (err) {
    next(err);
  }
});

router.get('/export/batches/csv', async (req, res, next) => {
  try {
    PermissionValidator.checkPermission(req.user.role, 'export_report');
    
    const options = {
      chemical_id: req.query.chemical_id,
      status: req.query.status,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'desc'
    };
    
    const batches = await batchRepository.findAll(options);
    
    const enrichedBatches = [];
    for (const batch of batches) {
      const chemical = await chemicalRepository.findById(batch.chemical_id);
      const batchJson = batch.toJSON();
      batchJson.chemical = chemical?.toJSON() || null;
      enrichedBatches.push(batchJson);
    }
    
    const exportResult = await CsvExporter.exportBatches(enrichedBatches);
    
    await auditLogRepository.logAction({
      action: AuditLog.actions.REPORT_EXPORT,
      entity_type: AuditLog.entityTypes.SYSTEM,
      description: `导出批次 CSV 报告，共 ${enrichedBatches.length} 条记录`,
      user_id: req.user.id,
      user_role: req.user.role
    });
    
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename=${exportResult.filename}`);
    res.send(exportResult.content);
  } catch (err) {
    next(err);
  }
});

router.get('/export/chemicals/csv', async (req, res, next) => {
  try {
    PermissionValidator.checkPermission(req.user.role, 'export_report');
    
    const options = {
      danger_level: req.query.danger_level,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'desc'
    };
    
    const chemicals = await chemicalRepository.findAll(options);
    const exportResult = await CsvExporter.exportChemicals(chemicals.map(c => c.toJSON()));
    
    await auditLogRepository.logAction({
      action: AuditLog.actions.REPORT_EXPORT,
      entity_type: AuditLog.entityTypes.SYSTEM,
      description: `导出试剂 CSV 报告，共 ${chemicals.length} 条记录`,
      user_id: req.user.id,
      user_role: req.user.role
    });
    
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename=${exportResult.filename}`);
    res.send(exportResult.content);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
