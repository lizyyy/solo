import type { Request, Response } from 'express';
import { exportService } from '../services/exportService';

export class ExportController {
  preview(req: Request, res: Response) {
    const data = exportService.getExportData();
    res.json(data);
  }

  exportCSV(req: Request, res: Response) {
    const result = exportService.download('csv');
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.content);
  }

  exportJSON(req: Request, res: Response) {
    const result = exportService.download('json');
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.content);
  }
}

export const exportController = new ExportController();
