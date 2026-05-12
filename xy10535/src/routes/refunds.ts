import { Router, Request, Response } from 'express';
import { refundService } from '../services/refundService';
import { sendSuccess, sendError } from '../middleware/response';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { ticketId, holderId, reason, operatorId, operatorName } = req.body;
    
    if (!ticketId || !holderId || !reason) {
      return sendError(res, 'MISSING_FIELDS', '缺少必填字段');
    }
    if (!operatorId || !operatorName) {
      return sendError(res, 'MISSING_OPERATOR', '缺少操作者信息');
    }
    
    const refund = refundService.requestRefund({
      ticketId,
      holderId,
      reason,
      operatorId,
      operatorName
    });
    
    sendSuccess(res, refund, 201);
  } catch (err: any) {
    sendError(res, 'CREATE_FAILED', err.message || '申请退票失败');
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const status = req.query.status as string | undefined;
    
    const result = refundService.findAll(page, pageSize, {
      status: status as any
    });
    
    sendSuccess(res, result);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const refund = refundService.findById(req.params.id);
    if (!refund) {
      return sendError(res, 'NOT_FOUND', '退票申请不存在', 404);
    }
    sendSuccess(res, refund);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.post('/:id/approve', (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName } = req.body;
    
    if (!operatorId || !operatorName) {
      return sendError(res, 'MISSING_OPERATOR', '缺少操作者信息');
    }
    
    const refund = refundService.approveRefund(req.params.id, {
      operatorId,
      operatorName
    });
    
    sendSuccess(res, refund);
  } catch (err: any) {
    sendError(res, 'APPROVE_FAILED', err.message || '审批通过失败');
  }
});

router.post('/:id/reject', (req: Request, res: Response) => {
  try {
    const { reason, operatorId, operatorName } = req.body;
    
    if (!reason || !operatorId || !operatorName) {
      return sendError(res, 'MISSING_FIELDS', '缺少必填字段');
    }
    
    const refund = refundService.rejectRefund(req.params.id, reason, {
      operatorId,
      operatorName
    });
    
    sendSuccess(res, refund);
  } catch (err: any) {
    sendError(res, 'REJECT_FAILED', err.message || '拒绝失败');
  }
});

export default router;
