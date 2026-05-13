import express, { Request, Response } from 'express';
import { exportService } from '../services/ExportService';
import { store } from '../database/store';
import { APIResponse, ExportFilter } from '../../shared/types';

const router = express.Router();

router.get('/logs', (req: Request, res: Response) => {
  try {
    const filter: ExportFilter = {
      operator: req.query.operator as string,
      startTime: req.query.startTime as string,
      endTime: req.query.endTime as string,
      visitorId: req.query.visitorId as string,
      operationType: req.query.operationType as string
    };
    const logs = exportService.filterOperationLogs(filter);
    res.json({ success: true, data: logs } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.get('/blacklist-changes', (req: Request, res: Response) => {
  try {
    const filter: ExportFilter = {
      operator: req.query.operator as string,
      startTime: req.query.startTime as string,
      endTime: req.query.endTime as string
    };
    const changes = exportService.getBlacklistChangeRecords(filter);
    res.json({ success: true, data: changes } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/export', (req: Request, res: Response) => {
  try {
    const filter: ExportFilter = req.body;
    const buffer = exportService.exportToExcel(filter);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=visitor_report.xlsx');
    res.send(buffer);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.get('/operators', (req: Request, res: Response) => {
  try {
    const operators = exportService.getDistinctOperators();
    res.json({ success: true, data: operators } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

export default router;
