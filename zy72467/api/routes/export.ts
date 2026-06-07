import { Router } from 'express';
import type { ApiResponse, FinalRecord } from '../../shared/types';
import { exportService } from '../services/exportService';

const router = Router();

router.get('/preview', (req, res) => {
  try {
    const data = exportService.getExportData();
    const response: ApiResponse<FinalRecord[]> = {
      success: true,
      data,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '获取预览数据失败',
    };
    res.status(500).json(response);
  }
});

router.get('/download', (req, res) => {
  try {
    const buffer = exportService.generateExcelBuffer();
    const filename = `施工围挡绕行告示_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '导出失败',
    };
    res.status(500).json(response);
  }
});

export default router;
