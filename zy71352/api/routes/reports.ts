import { Router, Request, Response } from 'express';
import type { RecordStatus } from '../../shared/types.js';
import { getReportSummary, exportExcel, exportPDF } from '../services/reportService.js';

const router = Router();

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const summary = await getReportSummary();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

router.post('/export', async (req: Request, res: Response) => {
  try {
    const { format, status } = req.body;

    if (format === 'xlsx') {
      const buffer = await exportExcel(status as RecordStatus | undefined);
      const filename = `保险清单_${new Date().toISOString().slice(0, 10)}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } else if (format === 'pdf') {
      const buffer = await exportPDF(status as RecordStatus | undefined);
      const filename = `保险清单_${new Date().toISOString().slice(0, 10)}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } else {
      res.status(400).json({
        success: false,
        error: 'Unsupported format. Use "xlsx" or "pdf".',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
