import type { Request, Response } from 'express';
import { sampleDataService, getSampleRawData } from '../services/sampleDataService';

export class SampleController {
  async loadSample(req: Request, res: Response) {
    try {
      const result = await sampleDataService.loadSampleData();
      res.json({
        success: true,
        message: '样例数据加载成功，包含：顺利记录、待确认记录、旧口径记录，以及同名路口、重复投诉、坐标偏移、跨时段统计等脏数据场景',
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载样例数据失败';
      res.status(500).json({ error: message });
    }
  }

  getSampleRaw(req: Request, res: Response) {
    res.json({
      records: getSampleRawData(),
    });
  }
}

export const sampleController = new SampleController();
