import { Router, Request, Response } from 'express';
import { reportService } from '../services/reportService';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { batchId, resultId, generatedBy, periodStart, periodEnd } = req.body;

    if (!batchId || !resultId || !generatedBy) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数',
      });
    }

    const report = await reportService.generateReport(
      batchId,
      resultId,
      generatedBy,
      periodStart,
      periodEnd
    );

    res.json({
      success: true,
      data: report,
      message: '报告生成成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '报告生成失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const report = reportService.getReport(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: '报告不存在',
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取报告失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const reports = reportService.getAllReports();

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取报告列表失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/:reportId/excel', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const buffer = await reportService.generateExcelReport(reportId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-report-${reportId}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '生成Excel报告失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/:reportId/pdf', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const buffer = await reportService.generatePdfReport(reportId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-report-${reportId}.pdf"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '生成PDF报告失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
