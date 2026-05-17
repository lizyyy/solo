import { Router, Request, Response } from 'express';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import { RecycleService } from '../services/recycle.service';
import { RecycleStatus, RecycleAction } from '../types';

export const createRecycleRouter = (recycleService: RecycleService): Router => {
  const router = Router();

  router.post('/records', async (req: Request, res: Response) => {
    try {
      const record = await recycleService.createRecycleRecord(req.body);
      res.status(201).json({ success: true, data: record });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.get('/records/:id', async (req: Request, res: Response) => {
    try {
      const record = await recycleService.getRecycleRecord(req.params.id);
      if (!record) {
        res.status(404).json({ success: false, error: 'Record not found' });
        return;
      }
      res.json({ success: true, data: record });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.get('/records', async (req: Request, res: Response) => {
    try {
      const query = {
        tenantId: req.query.tenantId as string,
        status: req.query.status as RecycleStatus,
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 20
      };
      const result = await recycleService.queryRecycleRecords(query);
      res.json({ success: true, data: result.records, total: result.total });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/records/:id/confirm', async (req: Request, res: Response) => {
    try {
      await recycleService.confirmSales(req.params.id, req.body.confirmedBy, req.body.note);
      res.json({ success: true, message: 'Confirmed successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/records/:id/deny', async (req: Request, res: Response) => {
    try {
      await recycleService.denySalesConfirm(req.params.id, req.body.confirmedBy, req.body.note);
      res.json({ success: true, message: 'Denied successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/records/:id/remind', async (req: Request, res: Response) => {
    try {
      await recycleService.sendReminder(req.params.id);
      res.json({ success: true, message: 'Reminder sent successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/records/:id/start', async (req: Request, res: Response) => {
    try {
      await recycleService.startRecycle(req.params.id);
      res.json({ success: true, message: 'Recycle started successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/records/:id/complete', async (req: Request, res: Response) => {
    try {
      await recycleService.completeRecycle(req.params.id, req.body.recycledBy, req.body.note);
      res.json({ success: true, message: 'Recycle completed successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/records/:id/extend', async (req: Request, res: Response) => {
    try {
      await recycleService.applyExtension(
        req.params.id, 
        parseInt(req.body.days), 
        req.body.reason, 
        req.body.extendedBy
      );
      res.json({ success: true, message: 'Extension applied successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/records/:id/exception', async (req: Request, res: Response) => {
    try {
      await recycleService.handleException(
        req.params.id,
        req.body.errorType,
        req.body.errorMessage,
        req.body.rawInput,
        req.body.processingEvidence
      );
      res.json({ success: true, message: 'Exception recorded successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/records/:id/manual', async (req: Request, res: Response) => {
    try {
      await recycleService.manualUpdate(req.params.id, req.body.updates, req.body.modifiedBy);
      res.json({ success: true, message: 'Manual update applied successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.get('/exceptions', async (req: Request, res: Response) => {
    try {
      const recordId = req.query.recordId as string | undefined;
      const exceptions = await recycleService.getExceptions(recordId);
      res.json({ success: true, data: exceptions });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/exceptions/:id/resolve', async (req: Request, res: Response) => {
    try {
      await recycleService.resolveException(req.params.id, req.body.resolvedBy, req.body.note);
      res.json({ success: true, message: 'Exception resolved successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const summary = await recycleService.getSummary();
      res.json({ success: true, data: summary });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.get('/export', async (req: Request, res: Response) => {
    try {
      const records = await recycleService.exportRecords();
      const exportDir = path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      const filename = `recycle-export-${Date.now()}.csv`;
      const filepath = path.join(exportDir, filename);

      const csvWriter = createObjectCsvWriter({
        path: filepath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'tenantId', title: '租户ID' },
          { id: 'featureId', title: '功能ID' },
          { id: 'trialEndDate', title: '试用到期日' },
          { id: 'status', title: '状态' },
          { id: 'salesConfirmStatus', title: '销售确认状态' },
          { id: 'recycleAction', title: '回收动作' },
          { id: 'summary', title: '摘要' },
          { id: 'createdBy', title: '创建人' },
          { id: 'createdAt', title: '创建时间' }
        ]
      });

      await csvWriter.writeRecords(records);
      res.download(filepath, filename);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.get('/statuses', (req: Request, res: Response) => {
    res.json({ success: true, data: Object.values(RecycleStatus) });
  });

  router.get('/actions', (req: Request, res: Response) => {
    res.json({ success: true, data: Object.values(RecycleAction) });
  });

  return router;
};
