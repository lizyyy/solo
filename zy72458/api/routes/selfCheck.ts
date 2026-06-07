import { Router } from 'express';
import { selfCheckService } from '../services/selfCheckService.js';
import { ApiResponse } from '../../shared/types.js';

const router = Router();

router.post('/run', async (req, res) => {
  try {
    const { operator } = req.body;
    const results = await selfCheckService.runAllChecks(operator || '阿宁');
    const response: ApiResponse<typeof results> = {
      success: true,
      data: results,
      message: '自检完成',
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '自检失败',
    };
    res.status(500).json(response);
  }
});

router.get('/results', async (req, res) => {
  try {
    const results = await selfCheckService.getLatestResults();
    const response: ApiResponse<typeof results> = {
      success: true,
      data: results,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '获取自检结果失败',
    };
    res.status(500).json(response);
  }
});

export default router;
