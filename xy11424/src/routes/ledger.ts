import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PreparationService } from '../services/preparation';
import { SecurityService } from '../services/security';
import { ExportService } from '../services/export';
import { PreparationStatus } from '../types';

export function createLedgerRouter(service: PreparationService): Router {
  const router = Router();

  router.get('/', async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, message: '未认证', timestamp: Date.now() });

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const status = req.query.status as PreparationStatus | undefined;
    const vin = req.query.vin as string | undefined;

    const result = await service.getLedgers({ page, pageSize, status, vin });

    const maskedItems = result.items.map(l => SecurityService.maskLedger(l, req.user!.role));

    res.json({
      success: true,
      data: {
        ...result,
        items: maskedItems
      },
      timestamp: Date.now()
    });
  });

  router.get('/summary', async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, message: '未认证', timestamp: Date.now() });

    const status = req.query.status as PreparationStatus | undefined;
    const vin = req.query.vin as string | undefined;

    const result = await service.getLedgers({ page: 1, pageSize: 1000, status, vin });
    const summary = ExportService.generateSummaryReport(result.items);

    res.json({
      success: true,
      data: summary,
      timestamp: Date.now()
    });
  });

  router.get('/:requestId', async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, message: '未认证', timestamp: Date.now() });

    const ledger = await service.getLedgerByRequestId(req.params.requestId);
    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: '台账不存在',
        requestId: req.params.requestId,
        timestamp: Date.now()
      });
    }

    const maskedLedger = SecurityService.maskLedger(ledger, req.user.role);
    maskedLedger.auditTrail = ledger.auditTrail.map(log => SecurityService.maskAuditLog(log, req.user!.role));

    res.json({
      success: true,
      data: maskedLedger,
      requestId: req.params.requestId,
      timestamp: Date.now()
    });
  });

  router.get('/:requestId/audit', async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, message: '未认证', timestamp: Date.now() });
    if (!SecurityService.canAudit(req.user.role)) {
      return res.status(403).json({ success: false, message: '无审计权限', timestamp: Date.now() });
    }

    const logs = await service.getAuditLogs(req.params.requestId);
    const maskedLogs = logs.map(log => SecurityService.maskAuditLog(log, req.user!.role));

    res.json({
      success: true,
      data: maskedLogs,
      requestId: req.params.requestId,
      timestamp: Date.now()
    });
  });

  router.get('/export/csv', async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, message: '未认证', timestamp: Date.now() });
    if (!SecurityService.canExport(req.user.role)) {
      return res.status(403).json({ success: false, message: '无导出权限', timestamp: Date.now() });
    }

    const status = req.query.status as PreparationStatus | undefined;
    const vin = req.query.vin as string | undefined;

    const result = await service.getLedgers({ page: 1, pageSize: 1000, status, vin });
    const csv = ExportService.exportLedgersToCSV(result.items, req.user.role);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="preparation_ledger_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  });

  router.get('/export/summary/csv', async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, message: '未认证', timestamp: Date.now() });
    if (!SecurityService.canExport(req.user.role)) {
      return res.status(403).json({ success: false, message: '无导出权限', timestamp: Date.now() });
    }

    const status = req.query.status as PreparationStatus | undefined;
    const vin = req.query.vin as string | undefined;

    const result = await service.getLedgers({ page: 1, pageSize: 1000, status, vin });
    const summary = ExportService.generateSummaryReport(result.items);
    const csv = ExportService.exportSummaryToCSV(summary);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="preparation_summary_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  });

  return router;
}
