import { Router, Request, Response } from 'express';
import { ticketService } from '../services/ticketService';
import { transferService } from '../services/transferService';
import { refundService } from '../services/refundService';
import { validationService } from '../services/validationService';
import { auditService } from '../services/auditService';
import { reportService } from '../services/reportService';
import { sendSuccess, sendError } from '../middleware/response';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { 
      eventId, eventName, holderId, holderName, 
      price, validFrom, validUntil,
      operatorId, operatorName
    } = req.body;
    
    if (!eventId || !eventName || !holderId || !holderName || price === undefined) {
      return sendError(res, 'MISSING_FIELDS', '缺少必填字段');
    }
    if (!operatorId || !operatorName) {
      return sendError(res, 'MISSING_OPERATOR', '缺少操作者信息');
    }
    
    const ticket = ticketService.createTicket({
      eventId,
      eventName,
      holderId,
      holderName,
      price,
      validFrom,
      validUntil,
      operatorId,
      operatorName
    });
    
    sendSuccess(res, ticket, 201);
  } catch (err: any) {
    sendError(res, 'CREATE_FAILED', err.message || '创建票券失败');
  }
});

router.post('/package', (req: Request, res: Response) => {
  try {
    const { 
      eventId, eventName, holderId, holderName,
      packageName, ticketCount, totalPrice,
      validFrom, validUntil,
      operatorId, operatorName
    } = req.body;
    
    if (!eventId || !eventName || !holderId || !holderName || 
        !packageName || !ticketCount || totalPrice === undefined) {
      return sendError(res, 'MISSING_FIELDS', '缺少必填字段');
    }
    if (!operatorId || !operatorName) {
      return sendError(res, 'MISSING_OPERATOR', '缺少操作者信息');
    }
    
    const result = ticketService.createPackageTicket({
      eventId,
      eventName,
      holderId,
      holderName,
      packageName,
      ticketCount,
      totalPrice,
      validFrom,
      validUntil,
      operatorId,
      operatorName
    });
    
    sendSuccess(res, result, 201);
  } catch (err: any) {
    sendError(res, 'CREATE_PACKAGE_FAILED', err.message || '创建套票失败');
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const status = req.query.status as string | undefined;
    const holderId = req.query.holderId as string | undefined;
    const eventId = req.query.eventId as string | undefined;
    
    const result = ticketService.findAll(page, pageSize, {
      status: status as any,
      holderId,
      eventId
    });
    
    sendSuccess(res, result);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/code/:ticketCode', (req: Request, res: Response) => {
  try {
    const ticket = ticketService.findByCode(req.params.ticketCode);
    if (!ticket) {
      return sendError(res, 'NOT_FOUND', '票券不存在', 404);
    }
    sendSuccess(res, ticket);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const ticket = ticketService.findById(req.params.id);
    if (!ticket) {
      return sendError(res, 'NOT_FOUND', '票券不存在', 404);
    }
    sendSuccess(res, ticket);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/:id/detail', (req: Request, res: Response) => {
  try {
    const report = reportService.getTicketDetailReport(req.params.id);
    if (!report) {
      return sendError(res, 'NOT_FOUND', '票券不存在', 404);
    }
    sendSuccess(res, report);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/:id/transfers', (req: Request, res: Response) => {
  try {
    const transfers = transferService.findByTicketId(req.params.id);
    sendSuccess(res, transfers);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/:id/refunds', (req: Request, res: Response) => {
  try {
    const refunds = refundService.findByTicketId(req.params.id);
    sendSuccess(res, refunds);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/:id/validations', (req: Request, res: Response) => {
  try {
    const validations = validationService.findByTicketId(req.params.id);
    sendSuccess(res, validations);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/:id/audit', (req: Request, res: Response) => {
  try {
    const logs = auditService.findByTicketId(req.params.id);
    sendSuccess(res, logs);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/package/:packageId', (req: Request, res: Response) => {
  try {
    const tickets = ticketService.findByPackageId(req.params.packageId);
    sendSuccess(res, tickets);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { status, operatorId, operatorName, reason } = req.body;
    
    if (!status || !operatorId || !operatorName || !reason) {
      return sendError(res, 'MISSING_FIELDS', '缺少必填字段');
    }
    
    const ticket = ticketService.updateStatus(req.params.id, status, {
      operatorId,
      operatorName,
      reason
    });
    
    sendSuccess(res, ticket);
  } catch (err: any) {
    sendError(res, 'UPDATE_FAILED', err.message || '更新失败');
  }
});

router.post('/:id/correct', (req: Request, res: Response) => {
  try {
    const { updates, operatorId, operatorName, reason } = req.body;
    
    if (!updates || !operatorId || !operatorName || !reason) {
      return sendError(res, 'MISSING_FIELDS', '缺少必填字段');
    }
    
    const ticket = ticketService.manualCorrect(req.params.id, updates, {
      operatorId,
      operatorName,
      reason
    });
    
    sendSuccess(res, ticket);
  } catch (err: any) {
    sendError(res, 'CORRECTION_FAILED', err.message || '人工修正失败');
  }
});

export default router;
