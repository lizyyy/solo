import { Request, Response } from 'express';
import { StallService } from '../services/StallService';
import { Stall } from '../../shared/types';

export class StallController {
  private stallService: StallService;

  constructor() {
    this.stallService = new StallService();
  }

  getAll = (req: Request, res: Response) => {
    try {
      const stalls = this.stallService.getAllStalls();
      res.json(stalls);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getById = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const stall = this.stallService.getStallById(id);
      if (!stall) {
        res.status(404).json({ error: '摊位不存在' });
        return;
      }
      res.json(stall);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  create = (req: Request, res: Response) => {
    try {
      const data = req.body as Omit<Stall, 'id'>;
      const stall = this.stallService.createStall(data);
      res.status(201).json(stall);
    } catch (error: any) {
      res.status(400).json({
        error: error.message,
        source: '手动录入',
      });
    }
  };

  update = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body as Partial<Stall>;
      const stall = this.stallService.updateStall(id, data);
      if (!stall) {
        res.status(404).json({ error: '摊位不存在' });
        return;
      }
      res.json(stall);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  delete = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = this.stallService.deleteStall(id);
      if (!success) {
        res.status(404).json({ error: '摊位不存在' });
        return;
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getEntrance = (_req: Request, res: Response) => {
    try {
      const stalls = this.stallService.getEntranceStalls();
      res.json(stalls);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getDimensions = (_req: Request, res: Response) => {
    try {
      const dims = this.stallService.getGridDimensions();
      res.json(dims);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  replaceGrid = (req: Request, res: Response) => {
    try {
      const { stalls } = req.body;
      if (!Array.isArray(stalls)) {
        res.status(400).json({ error: '数据格式错误，需要数组' });
        return;
      }
      const result = this.stallService.clearAndReplaceGrid(stalls);
      res.json({ success: true, count: result.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  bulkImport = (req: Request, res: Response) => {
    try {
      const { data, source } = req.body;
      if (!Array.isArray(data)) {
        res.status(400).json({ error: '数据格式错误，需要数组' });
        return;
      }
      const result = this.stallService.bulkImport(data, source || '批量导入');
      res.json({
        success: result.success.length,
        errors: result.errors,
        imported: result.success,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}
