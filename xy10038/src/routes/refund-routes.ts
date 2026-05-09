import { Router, Response } from 'express';
import { body, query, param } from 'express-validator';
import { refundService } from '../services/refund-service';
import { authenticate, requireOperator, requireManager, requireViewer } from '../middleware/auth';
import { validationErrorHandler } from '../middleware/error-handler';
import { AuthRequest, RefundFilter } from '../types';
import { successResponse, createdResponse, noContentResponse } from '../utils/response';
import { stateMachine } from '../services/state-machine';
import { RefundStatus, RefundReason } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireViewer,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isIn(['createdAt', 'amount', 'status', 'refundNo']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    validationErrorHandler
  ],
  async (req: AuthRequest, res: Response, next) => {
    try {
      const filter: RefundFilter = {
        status: req.query.status ? (req.query.status as string).split(',') as RefundStatus[] : undefined,
        reason: req.query.reason ? (req.query.reason as string).split(',') as RefundReason[] : undefined,
        orderNo: req.query.orderNo as string,
        refundNo: req.query.refundNo as string,
        customerName: req.query.customerName as string,
        customerPhone: req.query.customerPhone as string,
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      const result = await refundService.getRefundList(filter);
      return successResponse(res, result.data, '获取成功', result.pagination);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/statistics', requireViewer, async (_req: AuthRequest, res, next) => {
  try {
    const stats = await refundService.getStatistics();
    return successResponse(res, stats);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireViewer, async (req: AuthRequest, res, next) => {
  try {
    const refund = await refundService.getRefundById(req.params.id);
    return successResponse(res, refund);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', requireViewer, async (req: AuthRequest, res, next) => {
  try {
    const history = await refundService.getStatusHistory(req.params.id);
    return successResponse(res, history);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/logs', requireViewer, async (req: AuthRequest, res, next) => {
  try {
    const logs = await refundService.getLogs(req.params.id);
    return successResponse(res, logs);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/transitions', requireViewer, async (req: AuthRequest, res, next) => {
  try {
    const refund = await refundService.getRefundById(req.params.id, false);
    const transitions = stateMachine.getValidTransitions(refund.status, req.user!.role);
    return successResponse(res, transitions);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  requireOperator,
  [
    body('orderNo').notEmpty().withMessage('订单号不能为空'),
    body('customerName').notEmpty().withMessage('客户姓名不能为空'),
    body('amount').isFloat({ min: 0.01 }).withMessage('退款金额必须大于0'),
    body('reason').isIn(Object.values(RefundReason)).withMessage('无效的退款原因'),
    validationErrorHandler
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const refund = await refundService.createRefund(req.body, req.user!.userId);
      return createdResponse(res, refund, '退款单创建成功');
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  requireOperator,
  [
    param('id').isUUID().withMessage('无效的ID格式'),
    body('amount').optional().isFloat({ min: 0.01 }).withMessage('退款金额必须大于0'),
    body('reason').optional().isIn(Object.values(RefundReason)).withMessage('无效的退款原因'),
    validationErrorHandler
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const refund = await refundService.updateRefund(
        req.params.id,
        req.body,
        req.user!.userId,
        req.user!.role
      );
      return successResponse(res, refund, '更新成功');
    } catch (error) {
      next(error);
    }
  }
);

router.post('/:id/submit', requireOperator, async (req: AuthRequest, res, next) => {
  try {
    const refund = await refundService.submitForReview(
      req.params.id,
      req.user!.userId,
      req.user!.role
    );
    return successResponse(res, refund, '已提交审核');
  } catch (error) {
    next(error);
  }
});

router.post('/:id/approve', requireManager, async (req: AuthRequest, res, next) => {
  try {
    const refund = await refundService.approve(
      req.params.id,
      req.user!.userId,
      req.user!.role,
      req.body.reason
    );
    return successResponse(res, refund, '审核通过');
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reject', requireManager, async (req: AuthRequest, res, next) => {
  try {
    const refund = await refundService.reject(
      req.params.id,
      req.user!.userId,
      req.user!.role,
      req.body.reason
    );
    return successResponse(res, refund, '已拒绝');
  } catch (error) {
    next(error);
  }
});

router.post('/:id/cancel', requireOperator, async (req: AuthRequest, res, next) => {
  try {
    const refund = await refundService.cancel(
      req.params.id,
      req.user!.userId,
      req.user!.role,
      req.body.reason
    );
    return successResponse(res, refund, '已取消');
  } catch (error) {
    next(error);
  }
});

router.post('/:id/retry', requireOperator, async (req: AuthRequest, res, next) => {
  try {
    const refund = await refundService.retry(
      req.params.id,
      req.user!.userId,
      req.user!.role
    );
    return successResponse(res, refund, '已重试');
  } catch (error) {
    next(error);
  }
});

router.post('/:id/process', requireOperator, async (req: AuthRequest, res, next) => {
  try {
    const refund = await refundService.startProcessing(
      req.params.id,
      req.user!.userId,
      req.user!.role
    );
    return successResponse(res, refund, '开始处理');
  } catch (error) {
    next(error);
  }
});

router.post('/:id/success', requireOperator, async (req: AuthRequest, res, next) => {
  try {
    const refund = await refundService.markSuccess(
      req.params.id,
      req.user!.userId,
      req.user!.role
    );
    return successResponse(res, refund, '退款成功');
  } catch (error) {
    next(error);
  }
});

router.post('/:id/fail', requireOperator, async (req: AuthRequest, res, next) => {
  try {
    const refund = await refundService.markFailed(
      req.params.id,
      req.user!.userId,
      req.user!.role,
      req.body.errorMessage
    );
    return successResponse(res, refund, '已标记为失败');
  } catch (error) {
    next(error);
  }
});

router.post(
  '/batch',
  requireOperator,
  [
    body('refundIds').isArray({ min: 1 }).withMessage('请选择要操作的退款单'),
    body('action').isIn(['submit', 'approve', 'reject', 'cancel', 'retry']).withMessage('无效的操作类型'),
    validationErrorHandler
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const result = await refundService.batchAction(
        req.body,
        req.user!.userId,
        req.user!.role
      );
      return successResponse(res, result, '批量操作完成');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
