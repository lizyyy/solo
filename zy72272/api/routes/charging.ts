import { Router, type Request, type Response } from 'express';
import { coreService } from '../../src/core/CoreService.js';
import { DEMO_PHOTO_NOS } from '../../src/core/mockData.js';

const router = Router();

router.get('/records', (req: Request, res: Response) => {
  const records = coreService.getRecords();
  res.json({
    success: true,
    data: records,
  });
});

router.get('/records/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const record = coreService.getRecordById(id);
  if (!record) {
    res.status(404).json({
      success: false,
      error: `Record ${id} not found`,
    });
    return;
  }
  res.json({
    success: true,
    data: record,
  });
});

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { photoNos } = req.body as { photoNos?: string[] };
    const nos = photoNos || DEMO_PHOTO_NOS;
    const records = await coreService.importPhotoNumbers(nos);
    res.json({
      success: true,
      data: records,
      message: `成功导入 ${records.length} 条记录`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

router.put('/records/:id/cad', (req: Request, res: Response) => {
  const { id } = req.params;
  const { cadLayerName, operator } = req.body as {
    cadLayerName: string;
    operator?: string;
  };

  if (!cadLayerName) {
    res.status(400).json({
      success: false,
      error: 'cadLayerName is required',
    });
    return;
  }

  const record = coreService.updateCadLayerName(id, cadLayerName, operator || '老梁(API)');
  if (!record) {
    res.status(404).json({
      success: false,
      error: `Record ${id} not found`,
    });
    return;
  }

  res.json({
    success: true,
    data: record,
    message: `成功更新 ${id} 的CAD图层名为: ${cadLayerName}`,
  });
});

router.post('/records/:id/rerun', (req: Request, res: Response) => {
  const { id } = req.params;
  const { operator } = req.body as { operator?: string };

  const record = coreService.forceRecalculate(id, operator || '老梁(API)');
  if (!record) {
    res.status(404).json({
      success: false,
      error: `Record ${id} not found`,
    });
    return;
  }

  res.json({
    success: true,
    data: record,
    message: `成功重跑 ${id} 的长度计算`,
  });
});

router.post('/records/:id/correct', (req: Request, res: Response) => {
  const { id } = req.params;
  const { correctedLength, operator } = req.body as {
    correctedLength: number;
    operator?: string;
  };

  if (correctedLength === undefined || correctedLength === null) {
    res.status(400).json({
      success: false,
      error: 'correctedLength is required',
    });
    return;
  }

  const record = coreService.manualCorrect(id, correctedLength, operator || '老梁(API)');
  if (!record) {
    res.status(404).json({
      success: false,
      error: `Record ${id} not found`,
    });
    return;
  }

  res.json({
    success: true,
    data: record,
    message: `成功修正 ${id} 的长度为: ${correctedLength}`,
  });
});

router.get('/records/:id/logs', (req: Request, res: Response) => {
  const { id } = req.params;
  const logs = coreService.getLogsByRecordId(id);
  res.json({
    success: true,
    data: logs,
  });
});

router.get('/logs', (req: Request, res: Response) => {
  const logs = coreService.getAllLogs();
  res.json({
    success: true,
    data: logs,
  });
});

router.post('/export', async (req: Request, res: Response) => {
  try {
    const fileName = await coreService.exportScreenshot();
    res.json({
      success: true,
      data: { fileName },
      message: `导出成功: ${fileName}`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

router.get('/process-state', (req: Request, res: Response) => {
  const state = coreService.getProcessState();
  res.json({
    success: true,
    data: state,
  });
});

router.post('/demo/import', async (req: Request, res: Response) => {
  try {
    const records = await coreService.runImportDemo();
    res.json({
      success: true,
      data: records,
      message: '第一步演示完成：导入巡检照片编号',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

router.post('/demo/cad', async (req: Request, res: Response) => {
  try {
    const records = await coreService.runCadDemo();
    res.json({
      success: true,
      data: records,
      message: '第二步演示完成：补录CAD图层名',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

router.post('/demo/export', async (req: Request, res: Response) => {
  try {
    const fileName = await coreService.runExportDemo();
    res.json({
      success: true,
      data: { fileName },
      message: '第三步演示完成：导出截图',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

router.post('/demo/full', async (req: Request, res: Response) => {
  try {
    const result = await coreService.runFullDemo();
    res.json({
      success: true,
      data: result,
      message: '完整流程演示完成',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

router.post('/reset', (req: Request, res: Response) => {
  coreService.reset();
  res.json({
    success: true,
    message: '所有数据已重置',
  });
});

export default router;
