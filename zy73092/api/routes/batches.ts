import express, { type Request, type Response } from 'express';
import { BatchService } from '../services/BatchService.js';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { materialId } = req.query;
    if (!materialId) {
      return res.status(400).json({ success: false, error: 'materialId 必填' });
    }
    const mid = parseInt(materialId as string, 10);
    if (isNaN(mid)) {
      return res.status(400).json({ success: false, error: '无效的 materialId' });
    }
    const batches = BatchService.getByMaterialId(mid);
    res.json({ success: true, data: batches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
