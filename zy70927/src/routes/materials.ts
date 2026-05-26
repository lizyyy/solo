import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { calculateMaterialHash, findDuplicateBatch } from '../services/idempotency';
import { processMaterials, getBatchResponse } from '../services/materialProcessor';
import { BatchSubmitRequest } from '../types';

const router = Router();

router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { materials, submittedBy } = req.body as BatchSubmitRequest;

    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({
        error: 'materials 参数不能为空且必须是数组',
      });
    }

    if (!submittedBy) {
      return res.status(400).json({
        error: 'submittedBy 参数不能为空',
      });
    }

    const materialHash = calculateMaterialHash(materials);

    const duplicate = await findDuplicateBatch(materialHash);
    if (duplicate) {
      const existingResponse = await getBatchResponse(duplicate.batchId);
      if (existingResponse) {
        return res.status(200).json(existingResponse);
      }
    }

    const batchId = uuidv4();
    const result = await processMaterials(batchId, materials, submittedBy, materialHash);

    res.status(201).json(result);
  } catch (error) {
    console.error('材料提交处理失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const response = await getBatchResponse(batchId);

    if (!response) {
      return res.status(404).json({
        error: '批次不存在',
      });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('查询批次失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
