import { Router, type Request, type Response } from 'express';
import { reportService } from '../services/reportService.js';

const router = Router();

const mockUser = {
  id: 'u001',
  name: '张明',
};

router.get('/templates', async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await reportService.getTemplates();

    res.json({
      success: true,
      data: templates,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取报告模板失败',
    });
  }
});

router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId, filters } = req.body;

    if (!templateId) {
      res.status(400).json({
        success: false,
        error: '请选择报告模板',
      });
      return;
    }

    const result = await reportService.generateReport(
      templateId,
      filters || {},
      { id: mockUser.id, name: mockUser.name } as any,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '生成报告失败',
    });
  }
});

router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const { templateId, operatorId } = req.query;

    const filters: Record<string, any> = {};
    if (templateId) filters.templateId = templateId as string;
    if (operatorId) filters.operatorId = operatorId as string;

    const result = await reportService.getHistory(page, pageSize, filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取导出历史失败',
    });
  }
});

router.get('/download/:reportId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportId } = req.params;

    if (!reportId) {
      res.status(400).json({
        success: false,
        error: '报告ID不能为空',
      });
      return;
    }

    const result = await reportService.downloadReport(reportId);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`);
    res.setHeader('Cache-Control', 'no-cache');
    
    res.write('\uFEFF');
    res.write(result.content);
    res.end();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '下载报告失败',
    });
  }
});

export default router;
