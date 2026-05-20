import express, { Request, Response } from 'express';
import multer from 'multer';
import {
  parseCsv,
  parseJson,
  processData,
  mergeResults,
  checkBatchExists,
  getBatchResult,
  saveBatchResult,
  getAllBatches,
} from '../services/dataProcessor';
import { ImportResponse, DataSource } from '../../shared/types';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/',
  upload.fields([
    { name: 'inventoryCsv', maxCount: 1 },
    { name: 'salesJson', maxCount: 1 },
    { name: 'replenishmentForm', maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    try {
      const { batchId, storeId } = req.body;

      if (!batchId || !storeId) {
        return res.status(400).json({
          error: '缺少必要参数',
          message: 'batchId 和 storeId 为必填参数',
        });
      }

      if (checkBatchExists(batchId)) {
        const existingResult = getBatchResult(batchId)!;
        return res.json({
          ...existingResult,
          isDuplicate: true,
        });
      }

      const files = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };

      let inventoryItems: any[] = [];
      let salesItems: any[] = [];
      let replenishmentItems: any[] = [];

      if (files.inventoryCsv && files.inventoryCsv[0]) {
        const csvContent = files.inventoryCsv[0].buffer.toString('utf-8');
        inventoryItems = parseCsv(csvContent);
      }

      if (files.salesJson && files.salesJson[0]) {
        const jsonContent = files.salesJson[0].buffer.toString('utf-8');
        salesItems = parseJson(jsonContent);
      }

      if (files.replenishmentForm && files.replenishmentForm[0]) {
        const file = files.replenishmentForm[0];
        if (file.originalname.endsWith('.csv')) {
          replenishmentItems = parseCsv(file.buffer.toString('utf-8'));
        } else {
          replenishmentItems = parseJson(file.buffer.toString('utf-8'));
        }
      }

      const inventoryResult = processData(
        inventoryItems,
        'inventory' as DataSource,
        storeId,
        batchId
      );
      const salesResult = processData(
        salesItems,
        'sales' as DataSource,
        storeId,
        batchId
      );
      const replenishmentResult = processData(
        replenishmentItems,
        'replenishment' as DataSource,
        storeId,
        batchId
      );

      const mergedResults = mergeResults(
        inventoryResult,
        salesResult,
        replenishmentResult
      );

      const total =
        mergedResults.normal.length +
        mergedResults.pending.length +
        mergedResults.failed.length;

      const result: ImportResponse = {
        batchId,
        storeId,
        processedAt: new Date().toISOString(),
        isDuplicate: false,
        summary: {
          total,
          normal: mergedResults.normal.length,
          pending: mergedResults.pending.length,
          failed: mergedResults.failed.length,
        },
        data: mergedResults,
      };

      saveBatchResult(batchId, result);

      res.json(result);
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({
        error: '处理失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  }
);

router.get('/batch/:batchId', (req: Request, res: Response) => {
  const { batchId } = req.params;
  const result = getBatchResult(batchId);

  if (!result) {
    return res.status(404).json({
      error: '批次未找到',
      message: `未找到批次 ${batchId} 的处理记录`,
    });
  }

  res.json(result);
});

router.get('/batches', (_req: Request, res: Response) => {
  const batches = getAllBatches();
  res.json({
    total: batches.length,
    batches: batches.map((b) => ({
      batchId: b.batchId,
      storeId: b.storeId,
      processedAt: b.processedAt,
      summary: b.summary,
    })),
  });
});

export default router;
