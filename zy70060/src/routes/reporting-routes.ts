import { Router, Request, Response } from 'express';
import { reportingService } from '../services/reporting-service';

export const reportingRouter = Router();

reportingRouter.post('/daily', async (req: Request, res: Response) => {
  try {
    const { date } = req.body;
    const reports = await reportingService.generateDailyReport(date);

    res.json({ 
      success: true, 
      message: '日报表生成完成', 
      data: reports 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reportingRouter.post('/monthly', async (req: Request, res: Response) => {
  try {
    const { year, month } = req.body;

    if (!year || !month) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必填字段: year, month' 
      });
    }

    const reports = await reportingService.generateMonthlyReport(year, month);

    res.json({ 
      success: true, 
      message: '月报表生成完成', 
      data: reports 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reportingRouter.get('/daily/:date', async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const reports = await reportingService.getReportsByDate(date);

    res.json({ success: true, data: reports });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reportingRouter.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit } = req.query;

    const reports = await reportingService.getReportsByCustomer(
      customerId,
      limit ? parseInt(limit as string) : 10
    );

    res.json({ success: true, data: reports });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reportingRouter.get('/export/:date', async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const data = await reportingService.exportRegulatoryData(date);

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});