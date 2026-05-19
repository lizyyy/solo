import express, { Request, Response } from 'express';
import * as path from 'path';
import { InspectionService } from '../services/inspection-service';
import { InspectionStatus, ReviewRequest } from '../models/types';

export function createRouter(dataDir: string) {
  const router = express.Router();
  const service = new InspectionService(dataDir);

  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.post('/import', (req: Request, res: Response) => {
    try {
      const records = req.body;
      if (!Array.isArray(records)) {
        return res.status(400).json({ error: 'Request body must be an array' });
      }
      const imported = service.importTranscriptions(records);
      res.json({ 
        success: true, 
        count: imported.length,
        records: imported
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.post('/scan', (req: Request, res: Response) => {
    try {
      const result = service.scanAll();
      res.json({ 
        success: true, 
        scanned: result.scanned,
        withIssues: result.withIssues
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.post('/scan/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = service.scanRecord(id);
      if (!result) {
        return res.status(404).json({ error: 'Record not found' });
      }
      res.json({ success: true, record: result });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/records', (req: Request, res: Response) => {
    try {
      const { status, mask } = req.query;
      const maskSensitive = mask !== 'false';
      const records = service.getRecords(
        status ? (status as InspectionStatus) : undefined,
        maskSensitive
      );
      res.json({ count: records.length, records });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/records/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { mask } = req.query;
      const maskSensitive = mask !== 'false';
      const record = service.getRecordById(id, maskSensitive);
      if (!record) {
        return res.status(404).json({ error: 'Record not found' });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.post('/records/:id/review', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const request = req.body as ReviewRequest;
      
      if (!request.reviewer || !request.action) {
        return res.status(400).json({ error: 'reviewer and action are required' });
      }
      
      const result = service.reviewRecord(id, request);
      if (!result) {
        return res.status(404).json({ error: 'Record not found' });
      }
      res.json({ success: true, record: result });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.delete('/records/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = service.deleteRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Record not found' });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/summary', (req: Request, res: Response) => {
    try {
      const summary = service.getSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.post('/export', async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const filePath = await service.exportToCsv(
        status ? (status as InspectionStatus) : undefined
      );
      res.download(filePath, path.basename(filePath), (err) => {
        if (err) {
          console.error('Download error:', err);
        }
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/sensitive-words', (req: Request, res: Response) => {
    try {
      const words = service.getSensitiveWords();
      res.json({ count: words.length, words });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.post('/sensitive-words', (req: Request, res: Response) => {
    try {
      const word = service.addSensitiveWord(req.body);
      res.json({ success: true, word });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/stats', (req: Request, res: Response) => {
    try {
      const stats = service.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
