import { Router, Request, Response } from 'express';
import { transferService } from '../services/transferService';
import { sendSuccess, sendError } from '../middleware/response';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { 
      ticketId, fromHolderId, fromHolderName,
      toHolderId, toHolderName,
      operatorId, operatorName
    } = req.body;
    
    if (!ticketId || !fromHolderId || !fromHolderName || 
        !toHolderId || !toHolderName) {
      return sendError(res, 'MISSING_FIELDS', '缺少必填字段');
    }
    if (!operatorId || !operatorName) {
      return sendError(res, 'MISSING_OPERATOR', '缺少操作者信息');
    }
    
    const transfer = transferService.createTransfer({
      ticketId,
      fromHolderId,
      fromHolderName,
      toHolderId,
      toHolderName,
      operatorId,
      operatorName
    });
    
    sendSuccess(res, transfer, 201);
  } catch (err: any) {
    sendError(res, 'CREATE_FAILED', err.message || '创建转赠失败');
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const status = req.query.status as string | undefined;
    
    const result = transferService.findAll(page, pageSize, {
      status: status as any
    });
    
    sendSuccess(res, result);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const transfer = transferService.findById(req.params.id);
    if (!transfer) {
      return sendError(res, 'NOT_FOUND', '转赠记录不存在', 404);
    }
    sendSuccess(res, transfer);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.post('/:id/complete', (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName } = req.body;
    
    if (!operatorId || !operatorName) {
      return sendError(res, 'MISSING_OPERATOR', '缺少操作者信息');
    }
    
    const transfer = transferService.completeTransfer(req.params.id, {
      operatorId,
      operatorName
    });
    
    sendSuccess(res, transfer);
  } catch (err: any) {
    sendError(res, 'COMPLETE_FAILED', err.message || '完成转赠失败');
  }
});

router.post('/:id/cancel', (req: Request, res: Response) => {
  try {
    const { reason, operatorId, operatorName } = req.body;
    
    if (!reason || !operatorId || !operatorName) {
      return sendError(res, 'MISSING_FIELDS', '缺少必填字段');
    }
    
    const transfer = transferService.cancelTransfer(req.params.id, reason, {
      operatorId,
      operatorName
    });
    
    sendSuccess(res, transfer);
  } catch (err: any) {
    sendError(res, 'CANCEL_FAILED', err.message || '取消转赠失败');
  }
});

export default router;
