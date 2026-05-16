import { Router, Request, Response } from 'express';
import { QuotaService } from './service';
import { QuotaWindow, QuotaStatus } from './types';

export function createRouter(service: QuotaService): Router {
  const router = Router();

  router.post('/quotas', (req: Request, res: Response) => {
    try {
      const { teamName, modelName, usageTag, limit, window, createdBy } = req.body;
      
      if (!teamName || !modelName || !usageTag || !limit || !window || !createdBy) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['teamName', 'modelName', 'usageTag', 'limit', 'window', 'createdBy']
        });
      }

      if (!Object.values(QuotaWindow).includes(window)) {
        return res.status(400).json({
          error: 'Invalid window',
          validValues: Object.values(QuotaWindow)
        });
      }

      const quota = service.createQuota(teamName, modelName, usageTag, limit, window, createdBy);
      res.status(201).json(quota);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/quotas', (req: Request, res: Response) => {
    const quotas = service.getAllQuotas();
    res.json(quotas);
  });

  router.get('/quotas/:id', (req: Request, res: Response) => {
    const quota = service.getQuota(req.params.id);
    if (!quota) {
      return res.status(404).json({ error: 'Quota not found' });
    }
    res.json(quota);
  });

  router.get('/quotas/:id/summary', (req: Request, res: Response) => {
    try {
      const summary = service.getSummary(req.params.id);
      res.json(summary);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });

  router.post('/validate', (req: Request, res: Response) => {
    try {
      const { teamName, modelName, usageTag, tokens, requestId } = req.body;
      
      if (!teamName || !modelName || !usageTag || !tokens || !requestId) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['teamName', 'modelName', 'usageTag', 'tokens', 'requestId']
        });
      }

      const result = service.validateUsage(teamName, modelName, usageTag, tokens, requestId);
      
      if (result.success) {
        res.json({
          success: true,
          quota: result.config
        });
      } else {
        res.status(403).json({
          success: false,
          rejectEvent: result.rejectEvent
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/quotas/:id/bonus', (req: Request, res: Response) => {
    try {
      const { bonusAmount, operator, reason } = req.body;
      
      if (!bonusAmount || !operator || !reason) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['bonusAmount', 'operator', 'reason']
        });
      }

      const quota = service.addTempBonus(req.params.id, bonusAmount, operator, reason);
      res.json(quota);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/quotas/:id/status', (req: Request, res: Response) => {
    try {
      const { status, operator, reason } = req.body;
      
      if (!status || !operator || !reason) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['status', 'operator', 'reason']
        });
      }

      if (!Object.values(QuotaStatus).includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          validValues: Object.values(QuotaStatus)
        });
      }

      const quota = service.updateQuotaStatus(req.params.id, status, operator, reason);
      res.json(quota);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/quotas/:id/adjust', (req: Request, res: Response) => {
    try {
      const { limit, used, operator, reason } = req.body;
      
      if (!operator || !reason) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['operator', 'reason']
        });
      }

      const adjustments: { limit?: number; used?: number } = {};
      if (limit !== undefined) adjustments.limit = limit;
      if (used !== undefined) adjustments.used = used;

      if (Object.keys(adjustments).length === 0) {
        return res.status(400).json({
          error: 'No adjustments provided',
          fields: ['limit', 'used']
        });
      }

      const quota = service.manualAdjust(req.params.id, adjustments, operator, reason);
      res.json(quota);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/rejects', (req: Request, res: Response) => {
    const quotaId = req.query.quotaId as string;
    const rejects = service.getRejectEvents(quotaId);
    res.json(rejects);
  });

  router.get('/audit', (req: Request, res: Response) => {
    const quotaId = req.query.quotaId as string;
    const logs = service.getAuditLogs(quotaId);
    res.json(logs);
  });

  router.get('/export/:id', (req: Request, res: Response) => {
    try {
      const exportBy = req.query.exportBy as string || 'system';
      const exported = service.exportQuota(req.params.id, exportBy);
      res.json(exported);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });

  router.get('/export', (req: Request, res: Response) => {
    const exportBy = req.query.exportBy as string || 'system';
    const exported = service.exportAll(exportBy);
    res.json(exported);
  });

  router.get('/usage-tags', (req: Request, res: Response) => {
    res.json(service.getValidUsageTags());
  });

  return router;
}
