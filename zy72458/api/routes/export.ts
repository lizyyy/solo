import { Router } from 'express';
import { exportService } from '../services/exportService.js';
import { ApiResponse } from '../../shared/types.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { operator } = req.query;
    const result = await exportService.exportAll((operator as string) || '阿宁');
    
    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      message: `导出成功，共 ${result.count} 条记录`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '导出失败',
    };
    res.status(500).json(response);
  }
});

router.get('/unified', async (req, res) => {
  try {
    const data = await exportService.getUnifiedDataSource();
    const response: ApiResponse<typeof data> = {
      success: true,
      data,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '获取数据失败',
    };
    res.status(500).json(response);
  }
});

router.get('/history', async (req, res) => {
  try {
    const history = await exportService.getExportHistory();
    const response: ApiResponse<typeof history> = {
      success: true,
      data: history,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '获取导出历史失败',
    };
    res.status(500).json(response);
  }
});

export default router;
