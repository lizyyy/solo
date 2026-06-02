import type { Request, Response } from 'express';
import { recordService } from '../services/recordService';

export class RecordController {
  getAll(req: Request, res: Response) {
    const { status } = req.query;
    let records = recordService.getAllRecords();
    if (status && typeof status === 'string') {
      records = records.filter(r => r.status === status);
    }
    res.json(records);
  }

  getById(req: Request, res: Response) {
    const record = recordService.getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(record);
  }

  update(req: Request, res: Response) {
    const updated = recordService.updateRecord(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(updated);
  }

  updateStatus(req: Request, res: Response) {
    const { status, notes } = req.body;
    if (!status) {
      return res.status(400).json({ error: '请提供状态' });
    }
    const updated = recordService.updateStatus(req.params.id, status, notes);
    if (!updated) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(updated);
  }

  getStats(req: Request, res: Response) {
    const stats = recordService.getStats();
    res.json(stats);
  }

  delete(req: Request, res: Response) {
    const success = recordService.deleteRecord(req.params.id);
    if (!success) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json({ success: true });
  }

  clearAll(req: Request, res: Response) {
    recordService.clearAll();
    res.json({ success: true });
  }
}

export const recordController = new RecordController();
