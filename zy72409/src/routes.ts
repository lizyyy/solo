import { Router, Request, Response } from 'express';
import { createBatch, importSoundEngineerRecords, importRehearsalGroupRecords } from './services/importService';
import { resolveConflict, getConflicts, detectConflicts } from './services/conflictService';
import { calculateRevenueSplit, getLatestRevenueSplit, getRevenueSplitHistory } from './services/revenueService';
import { runAllChecks } from './services/selfCheckService';
import { getUnifiedBatchResult, exportBatchData, getBatchList } from './services/unifiedResultService';
import { BatchStatus, TicketType } from './types';

const router = Router();

router.get('/batches', (req: Request, res: Response) => {
  try {
    const batches = getBatchList();
    res.json({ success: true, data: batches });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batches', (req: Request, res: Response) => {
  try {
    const { batchDate, showName } = req.body;
    if (!batchDate || !showName) {
      return res.status(400).json({ success: false, error: 'batchDate 和 showName 必填' });
    }
    const batchId = createBatch(batchDate, showName);
    res.json({ success: true, data: { batchId } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches/:batchId', (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId as string);
    const result = getUnifiedBatchResult(batchId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batches/:batchId/import/sound-engineer', (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId as string);
    const { tickets } = req.body;
    if (!tickets || !Array.isArray(tickets)) {
      return res.status(400).json({ success: false, error: 'tickets 数组必填' });
    }
    const result = importSoundEngineerRecords(batchId, tickets);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batches/:batchId/import/rehearsal-group', (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId as string);
    const { tickets } = req.body;
    if (!tickets || !Array.isArray(tickets)) {
      return res.status(400).json({ success: false, error: 'tickets 数组必填' });
    }
    const result = importRehearsalGroupRecords(batchId, tickets);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches/:batchId/conflicts', (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId as string);
    const conflicts = getConflicts(batchId);
    res.json({ success: true, data: conflicts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/conflicts/:conflictId/resolve', (req: Request, res: Response) => {
  try {
    const conflictId = parseInt(req.params.conflictId as string);
    const { resolution, resolvedBy, customValue } = req.body;
    if (!resolution || !resolvedBy) {
      return res.status(400).json({ success: false, error: 'resolution 和 resolvedBy 必填' });
    }
    const result = resolveConflict(conflictId, resolution, resolvedBy, customValue);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batches/:batchId/calculate', (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId as string);
    const { useSource } = req.body;
    const result = calculateRevenueSplit(batchId, useSource);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches/:batchId/revenue', (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId as string);
    const result = getLatestRevenueSplit(batchId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches/:batchId/revenue/history', (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId as string);
    const result = getRevenueSplitHistory(batchId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches/:batchId/self-check', (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId as string);
    const result = runAllChecks(batchId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches/:batchId/export', (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId as string);
    const result = exportBatchData(batchId);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="batch-${batchId}-export.json"`);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batches/:batchId/status', (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId as string);
    const { status, updatedBy } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, error: 'status 必填' });
    }

    const validStatuses = Object.values(BatchStatus);
    if (!validStatuses.includes(status as BatchStatus)) {
      return res.status(400).json({ success: false, error: `无效的状态值，有效值: ${validStatuses.join(', ')}` });
    }

    const dbModule = require('./db');
    dbModule.db.prepare(`
      UPDATE show_batches 
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, batchId);

    res.json({ success: true, data: { batchId, status } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/health', (req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

export default router;
