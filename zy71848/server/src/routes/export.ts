import { Router, Request, Response } from 'express';
import { dataStore } from '../dataStore';
import type { ApiResponse, ExportRecord, ExportRequest, ConsistencyCheckResult } from '../../../shared/types';

const router = Router();

router.get('/', (req: Request, res: Response<ApiResponse<ExportRecord[]>>) => {
  try {
    const records = dataStore.getExportRecords();
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取导出记录失败' });
  }
});

router.post('/check', (req: Request<unknown, unknown, { inspectionIds: string[] }>, res: Response<ApiResponse<ConsistencyCheckResult>>) => {
  try {
    const { inspectionIds } = req.body;
    const result = dataStore.performConsistencyCheck(inspectionIds);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: '一致性校验失败' });
  }
});

router.post('/', (req: Request<unknown, unknown, ExportRequest>, res: Response<ApiResponse<ExportRecord>>) => {
  try {
    const { inspectionIds, template, performConsistencyCheck } = req.body;
    const record = dataStore.createExport(inspectionIds, template, performConsistencyCheck);
    if (record) {
      res.json({ success: true, data: record });
    } else {
      res.status(500).json({ success: false, error: '创建导出记录失败' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '创建导出记录失败' });
  }
});

router.get('/:id/download', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const content = dataStore.generateExportContent(id);
    if (content) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="inspection-report-${id}.txt`);
      res.send(content);
    } else {
      res.status(404).json({ success: false, error: '导出记录不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '生成导出文件失败' });
  }
});

export default router;
