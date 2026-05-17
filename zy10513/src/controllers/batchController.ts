import { Request, Response } from 'express';
import { SamplingService } from '../services/SamplingService';

const samplingService = new SamplingService();

export const createBatch = async (req: Request, res: Response) => {
  try {
    const batch = await samplingService.createBatch(req.body);
    res.status(201).json({ success: true, data: batch });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const importRecords = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const result = await samplingService.importRecords(batchId, req.body.records);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const executeSampling = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const result = await samplingService.executeSampling(batchId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const batch = await samplingService.getBatchById(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: '批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const listBatches = async (req: Request, res: Response) => {
  try {
    const { status, page, pageSize } = req.query;
    const result = await samplingService.listBatches({
      status: status as any,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};
