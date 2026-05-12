import { Router, Request, Response } from 'express';
import { reportService } from '../services/reportService';
import { auditService } from '../services/auditService';
import { sendSuccess, sendError } from '../middleware/response';

const router = Router();

router.get('/ticket/:ticketId', (req: Request, res: Response) => {
  try {
    const report = reportService.getTicketDetailReport(req.params.ticketId);
    if (!report) {
      return sendError(res, 'NOT_FOUND', '票券不存在', 404);
    }
    sendSuccess(res, report);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/ticket/:ticketId/csv', (req: Request, res: Response) => {
  try {
    const ticket = reportService.getTicketDetailReport(req.params.ticketId);
    if (!ticket) {
      return sendError(res, 'NOT_FOUND', '票券不存在', 404);
    }
    const csv = reportService.exportAuditLogCSV(req.params.ticketId, 'ticket');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ticket-audit-${req.params.ticketId}.csv"`);
    res.send('\ufeff' + csv);
  } catch (err: any) {
    sendError(res, 'EXPORT_FAILED', err.message || '导出失败');
  }
});

router.get('/event/:eventId', (req: Request, res: Response) => {
  try {
    const report = reportService.getEventSummary(req.params.eventId);
    sendSuccess(res, report);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/event/:eventId/csv', (req: Request, res: Response) => {
  try {
    const csv = reportService.exportEventSummaryCSV(req.params.eventId);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="event-summary-${req.params.eventId}.csv"`);
    res.send('\ufeff' + csv);
  } catch (err: any) {
    sendError(res, 'EXPORT_FAILED', err.message || '导出失败');
  }
});

router.get('/event/:eventId/tickets/csv', (req: Request, res: Response) => {
  try {
    const csv = reportService.exportTicketsCSV(req.params.eventId);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="event-tickets-${req.params.eventId}.csv"`);
    res.send('\ufeff' + csv);
  } catch (err: any) {
    sendError(res, 'EXPORT_FAILED', err.message || '导出失败');
  }
});

router.get('/event/:eventId/validations/csv', (req: Request, res: Response) => {
  try {
    const csv = reportService.exportValidationsCSV(req.params.eventId);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="event-validations-${req.params.eventId}.csv"`);
    res.send('\ufeff' + csv);
  } catch (err: any) {
    sendError(res, 'EXPORT_FAILED', err.message || '导出失败');
  }
});

router.get('/audit', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const result = auditService.findAll(page, pageSize);
    
    sendSuccess(res, result);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/audit/operator/:operatorId', (req: Request, res: Response) => {
  try {
    const logs = auditService.findByOperatorId(req.params.operatorId);
    sendSuccess(res, logs);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

export default router;
