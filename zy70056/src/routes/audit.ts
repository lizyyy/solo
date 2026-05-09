import express from 'express';
import * as auditService from '../services/auditService';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const params: any = {};
    if (req.query.entityType) params.entityType = req.query.entityType;
    if (req.query.entityId) params.entityId = req.query.entityId;
    if (req.query.actionType) params.actionType = req.query.actionType;
    if (req.query.startDate) params.startDate = req.query.startDate;
    if (req.query.endDate) params.endDate = req.query.endDate;
    if (req.query.actor) params.actor = req.query.actor;
    
    const result = await auditService.queryAuditLogs(params);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const params: any = {};
    if (req.query.entityType) params.entityType = req.query.entityType;
    if (req.query.entityId) params.entityId = req.query.entityId;
    if (req.query.actionType) params.actionType = req.query.actionType;
    if (req.query.startDate) params.startDate = req.query.startDate;
    if (req.query.endDate) params.endDate = req.query.endDate;
    if (req.query.actor) params.actor = req.query.actor;
    
    const csv = await auditService.exportAuditCSV(params);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send('\ufeff' + csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/json', async (req, res) => {
  try {
    const params: any = {};
    if (req.query.entityType) params.entityType = req.query.entityType;
    if (req.query.entityId) params.entityId = req.query.entityId;
    if (req.query.actionType) params.actionType = req.query.actionType;
    if (req.query.startDate) params.startDate = req.query.startDate;
    if (req.query.endDate) params.endDate = req.query.endDate;
    if (req.query.actor) params.actor = req.query.actor;
    
    const json = await auditService.exportAuditJSON(params);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
    res.send(json);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/hit/:hitId/report', async (req, res) => {
  try {
    const json = await auditService.exportHitDetailReport(req.params.hitId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=hit-${req.params.hitId}-report.json`);
    res.send(json);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
