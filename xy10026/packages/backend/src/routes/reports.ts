import { Router, Request, Response } from 'express';
import Joi from 'joi';
import reportService from '../services/ReportService';
import logger from '../utils/logger';

const router = Router();

const generateReportSchema = Joi.object({
  roomId: Joi.string().required(),
  startDate: Joi.string().required(),
  endDate: Joi.string().required(),
});

const exportSchema = Joi.object({
  roomId: Joi.string().required(),
  startDate: Joi.string().required(),
  endDate: Joi.string().required(),
  format: Joi.string().valid('excel', 'markdown', 'pdf').required(),
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { error, value } = generateReportSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const report = await reportService.generateReport({
      roomId: value.roomId,
      startDate: new Date(value.startDate),
      endDate: new Date(value.endDate),
      formats: [],
    });

    return res.json(report);
  } catch (error) {
    logger.error('Generate report failed', error as Error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const { error, value } = exportSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const report = await reportService.generateReport({
      roomId: value.roomId,
      startDate: new Date(value.startDate),
      endDate: new Date(value.endDate),
      formats: [value.format],
    });

    const filename = `live-push-report-${value.roomId}-${Date.now()}`;

    switch (value.format) {
      case 'excel': {
        const buffer = await reportService.exportToExcel(report);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        return res.send(buffer);
      }
      
      case 'markdown': {
        const markdown = await reportService.exportToMarkdown(report);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.md"`);
        return res.send(markdown);
      }
      
      case 'pdf': {
        const buffer = await reportService.exportToPdf(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        return res.send(buffer);
      }
    }
  } catch (error) {
    logger.error('Export report failed', error as Error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
