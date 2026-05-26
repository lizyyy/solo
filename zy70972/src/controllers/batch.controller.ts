import { Request, Response } from 'express';
import { BatchService } from '../services/batch.service';
import { BatchType } from '../types/enums';
import * as fs from 'fs';
import * as path from 'path';

const batchService = new BatchService();

export const uploadAndCreateBatch = async (req: Request, res: Response) => {
  try {
    const { activityId, batchType, operator } = req.body;
    const file = req.file;

    if (!activityId || !batchType || !operator) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ error: '缺少必填字段' });
    }

    if (!file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    if (!Object.values(BatchType).includes(batchType as BatchType)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: '无效的批次类型' });
    }

    const batch = await batchService.createBatch(
      activityId,
      batchType as BatchType,
      file.filename,
      file.path,
      operator
    );

    res.status(201).json(batch);
  } catch (error) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    res.status(500).json({ error: (error as Error).message });
  }
};

export const processBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator } = req.body;

    if (!operator) {
      return res.status(400).json({ error: '请提供操作人' });
    }

    const result = await batchService.processBatch(id, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const rejectBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, remark } = req.body;

    if (!operator) {
      return res.status(400).json({ error: '请提供操作人' });
    }

    const result = await batchService.rejectBatch(id, operator, remark || '');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const markBatchForReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, remark } = req.body;

    if (!operator) {
      return res.status(400).json({ error: '请提供操作人' });
    }

    const result = await batchService.markBatchForReview(id, operator, remark || '');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const batch = await batchService.getBatch(id);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const listBatches = async (req: Request, res: Response) => {
  try {
    const { activityId, status } = req.query;
    const batches = await batchService.listBatches(
      activityId as string | undefined,
      status as string | undefined
    );

    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};
