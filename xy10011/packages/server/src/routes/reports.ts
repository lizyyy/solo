import { Router, Request, Response } from 'express';
import { reportService } from '../services/report-service';
import { ReportOptions } from '../types';

const router = Router();

router.post('/export', async (req: Request, res: Response) => {
  try {
    const options: ReportOptions = {
      format: req.body.format,
      groupId: req.body.groupId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      includeDetails: req.body.includeDetails ?? true,
      includeAuditLog: req.body.includeAuditLog ?? false,
    };

    const buffer = await reportService.generateReport(options);

    const contentType = {
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
      markdown: 'text/markdown',
    }[options.format];

    const extension = {
      excel: 'xlsx',
      pdf: 'pdf',
      markdown: 'md',
    }[options.format];

    const filename = `bill-split-report-${Date.now()}.${extension}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
