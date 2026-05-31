import { Router, Request, Response } from 'express';
import { dataStore } from '../dataStore';
import type { ApiResponse, InspectionRecord } from '../../../shared/types';

const router = Router();

router.get('/', (req: Request, res: Response<ApiResponse<InspectionRecord[]>>) => {
  try {
    const inspections = dataStore.getInspections();
    res.json({ success: true, data: inspections });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取检查列表失败' });
  }
});

router.get('/:id', (req: Request<{ id: string }>, res: Response<ApiResponse<InspectionRecord>>) => {
  try {
    const { id } = req.params;
    const inspection = dataStore.getInspectionById(id);
    if (inspection) {
      res.json({ success: true, data: inspection });
    } else {
      res.status(404).json({ success: false, error: '检查记录不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '获取检查详情失败' });
  }
});

router.put('/:id/status', (req: Request<{ id: string }, unknown, { status: InspectionRecord['status'] }>, res: Response<ApiResponse<InspectionRecord>>) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    dataStore.updateInspectionStatus(id, status);
    const updated = dataStore.getInspectionById(id);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: '更新状态失败' });
  }
});

router.post('/:id/flip', (req: Request<{ id: string }, unknown, { flipType: 'x' | 'y' | 'origin' }>, res: Response<ApiResponse<{ flipped: InspectionRecord; deviation: number }>>) => {
  try {
    const { id } = req.params;
    const flipType = req.body.flipType || 'origin';
    const result = dataStore.performFlip(id, flipType);
    if (result) {
      res.json({ success: true, data: result });
    } else {
      res.status(404).json({ success: false, error: '检查记录不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '执行翻转失败' });
  }
});

router.post('/:id/change', (req: Request<{ id: string }>, res: Response<ApiResponse<null>>) => {
  try {
    const { id } = req.params;
    const { type, description, affectsConclusion, operator } = req.body;
    dataStore.addChangeRecord(id, {
      type,
      description,
      affectsConclusion,
      operator: operator || '当前用户',
      timestamp: new Date().toISOString(),
    });
    res.json({ success: true, message: '变更记录已添加' });
  } catch (error) {
    res.status(500).json({ success: false, error: '添加变更记录失败' });
  }
});

export default router;
