import { Router, Request, Response } from 'express';
import { Parser } from 'json2csv';
import {
  processSubmission,
  queryDeclarationsService,
  getStatisticsService,
  processDeclaration,
  exportDeclarations
} from './service';

const router = Router();

router.post('/submit', async (req: Request, res: Response) => {
  try {
    const result = await processSubmission(req.body);
    res.json(result);
  } catch (error) {
    console.error('提交处理错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

router.get('/query', async (req: Request, res: Response) => {
  try {
    const params = {
      declarationNo: req.query.declarationNo as string,
      submitter: req.query.submitter as string,
      status: req.query.status as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const result = await queryDeclarationsService(params);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('查询错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

router.get('/statistics', async (_req: Request, res: Response) => {
  try {
    const stats = await getStatisticsService();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('统计错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

router.put('/process/:id', async (req: Request, res: Response) => {
  try {
    const declarationId = parseInt(req.params.id);
    const { status, processor, rejectionReason } = req.body;

    if (isNaN(declarationId)) {
      return res.status(400).json({
        success: false,
        error: '无效的申报ID'
      });
    }

    if (!['processed', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的状态值，必须是 processed 或 rejected'
      });
    }

    if (!processor || processor.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '处理人不能为空'
      });
    }

    const result = await processDeclaration(declarationId, status, processor, rejectionReason);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: '未找到该申报记录'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('处理错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const params = {
      declarationNo: req.query.declarationNo as string,
      submitter: req.query.submitter as string,
      status: req.query.status as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const exportData = await exportDeclarations(params);

    if (req.query.format === 'csv') {
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(exportData);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="declarations_${Date.now()}.csv"`);
      res.send('\uFEFF' + csv);
    } else {
      res.json({
        success: true,
        data: exportData
      });
    }
  } catch (error) {
    console.error('导出错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

export default router;
