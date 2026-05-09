import { Router, Request, Response, NextFunction } from 'express';
import { exportService } from '../services/export.service';
import { ExportFormat } from '../types';
import { ValidationError } from '../utils/errors';

const router = Router();

router.get('/event/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = req.query.format as ExportFormat;
    
    if (!format || !['excel', 'markdown', 'pdf'].includes(format)) {
      throw new ValidationError('Invalid or missing format parameter. Use: excel, markdown, or pdf');
    }

    const includeCancelled = req.query.includeCancelled === 'true';

    const result = await exportService.exportEvent(req.params.eventId, {
      format,
      includeCancelled,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.filename)}"`
    );

    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
