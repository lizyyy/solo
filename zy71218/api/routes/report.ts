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
    res.json({
      success: true,
      data: {
        list: [],
        total: 0,
        page: 1,
        pageSize: 10,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取导出历史失败',
    });
  }
});

export default router;
