import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db/init.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { TrackRepository } from '../repositories/TrackRepository.js';
import { ChangeRepository } from '../repositories/ChangeRepository.js';
import { SyncService } from '../services/SyncService.js';
import { SelfCheckService } from '../services/SelfCheckService.js';
import { ExportService } from '../services/ExportService.js';
import type { ApiResponse, ReportSummary, ChangeTraceNode } from '../../shared/types.js';

const router = express.Router();

const db = getDb();
const materialRepo = new MaterialRepository(db);
const trackRepo = new TrackRepository(db);
const changeRepo = new ChangeRepository(db);
const syncService = new SyncService(materialRepo, trackRepo, changeRepo);
const selfCheckService = new SelfCheckService(materialRepo, trackRepo, changeRepo);
const exportService = new ExportService(materialRepo, trackRepo, changeRepo, syncService, selfCheckService);

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = exportService.getReportSummary();
    res.json({
      success: true,
      data: summary
    } as ApiResponse<ReportSummary>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.get('/trace/:materialId', async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;
    const trace = exportService.getChangeTrace(materialId);

    res.json({
      success: true,
      data: trace
    } as ApiResponse<ChangeTraceNode[]>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.get('/excel', async (req: Request, res: Response) => {
  try {
    const buffer = exportService.exportExcel();
    const filename = `影视配乐素材入库_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.get('/pdf', async (req: Request, res: Response) => {
  try {
    const buffer = exportService.exportPDF();
    const filename = `影视配乐素材入库报告_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

export default router;
