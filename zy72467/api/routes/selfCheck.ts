import { Router } from 'express';
import type { ApiResponse, SelfCheckResult } from '../../shared/types';
import { selfCheckService } from '../services/selfCheckService';

const router = Router();

router.get('/', (req, res) => {
  try {
    const result = selfCheckService.runSelfCheck();
    const response: ApiResponse<SelfCheckResult> = {
      success: true,
      data: result,
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

router.post('/resolve-opinion', (req, res) => {
  try {
    const { recordId, opinionOriginal, operator } = req.body as {
      recordId: string;
      opinionOriginal: string;
      operator: string;
    };

    const success = selfCheckService.resolveOpinionMissing(
      recordId,
      opinionOriginal,
      operator || '社区书记周姐'
    );

    if (!success) {
      const response: ApiResponse<null> = {
        success: false,
        error: '记录不存在',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: '意见原文补全完成',
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '处理失败',
    };
    res.status(500).json(response);
  }
});

export default router;
