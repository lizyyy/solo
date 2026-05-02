import { Router, Request, Response } from 'express';
import {
  importBloodBagsFromCSV,
  exportInventoryToCSV,
  generateShiftReport,
  getBloodTypeCompatibilityInfo,
} from '../services';
import { ApiResponse } from '../types';

const router = Router();

router.post('/import', async (req: Request, res: Response<ApiResponse>) => {
  try {
    if (!req.body.csvContent && !req.rawBody) {
      res.status(400).json({
        success: false,
        error: '缺少CSV内容，请在请求体中提供 csvContent',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const csvContent = req.body.csvContent || (req.rawBody ? req.rawBody.toString() : '');
    const operator = req.body.operator || 'system';

    const result = await importBloodBagsFromCSV(csvContent, operator);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: `导入失败: ${result.errors.length} 条记录失败`,
        data: result,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '导入失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/inventory/csv', (req: Request, res: Response) => {
  try {
    const csv = exportInventoryToCSV();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=inventory_${Date.now()}.csv`);
    res.send('\ufeff' + csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '导出失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/shift-report', (req: Request, res: Response) => {
  try {
    const now = new Date();
    const defaultShiftStart = new Date(now);
    defaultShiftStart.setHours(8, 0, 0, 0);

    let shiftStart = req.query.startDate 
      ? new Date(req.query.startDate as string)
      : defaultShiftStart;
    let shiftEnd = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date(shiftStart.getTime() + 12 * 60 * 60 * 1000);

    if (isNaN(shiftStart.getTime())) {
      res.status(400).json({
        success: false,
        error: '无效的 startDate 格式',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (isNaN(shiftEnd.getTime())) {
      res.status(400).json({
        success: false,
        error: '无效的 endDate 格式',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const format = (req.query.format as 'markdown' | 'csv') || 'markdown';

    if (format === 'csv') {
      const csv = generateShiftReport(shiftStart.toISOString(), shiftEnd.toISOString(), 'csv');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=shift_report_${Date.now()}.csv`);
      res.send('\ufeff' + csv);
    } else {
      const markdown = generateShiftReport(shiftStart.toISOString(), shiftEnd.toISOString(), 'markdown');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=shift_report_${Date.now()}.md`);
      res.send(markdown);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '生成报告失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/blood-type-compatibility', (req: Request, res: Response<ApiResponse>) => {
  try {
    const info = getBloodTypeCompatibilityInfo();
    res.json({
      success: true,
      data: info,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取血型兼容性信息失败',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
