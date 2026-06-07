import { Router } from 'express';
import type { ApiResponse, ImportResult, RampRecord, SamplingRecord } from '../../shared/types';
import { importService } from '../services/importService';

const router = Router();

router.post('/ramp', (req, res) => {
  try {
    const { records, operator } = req.body as {
      records: Omit<RampRecord, 'id' | 'importTime' | 'importedBy'>[];
      operator: string;
    };

    const result = importService.importRampRecords(records, operator || '社区书记周姐');

    const response: ApiResponse<ImportResult> = {
      success: true,
      data: result,
      message: `导入完成：成功${result.success}条，重复${result.duplicates}条，异常${result.anomalies}条`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '导入坡道记录失败',
    };
    res.status(500).json(response);
  }
});

router.post('/sampling', (req, res) => {
  try {
    const { records, operator } = req.body as {
      records: Omit<SamplingRecord, 'id' | 'importTime' | 'importedBy'>[];
      operator: string;
    };

    const result = importService.importSamplingRecords(records, operator || '社区书记周姐');

    const response: ApiResponse<ImportResult> = {
      success: true,
      data: result,
      message: `补录完成：成功${result.success}条，重复${result.duplicates}条，异常${result.anomalies}条`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '补录采样点失败',
    };
    res.status(500).json(response);
  }
});

export default router;
