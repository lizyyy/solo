import { Router, Request, Response, NextFunction } from 'express';
import { processingOrderService } from '../services/processingOrderService';
import { validateRequest } from '../middleware/errorHandler';

const router = Router();

router.post(
  '/',
  validateRequest([
    'customerName',
    'customerPhone',
    'frameModel',
    'frameColor',
    'odPrescription',
    'osPrescription',
    'lensSpec',
    'createdBy'
  ]),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = processingOrderService.createProcessingOrder(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CREATE_FAILED',
            message: result.message
          }
        });
      }
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/', (req: Request, res: Response) => {
  const orders = processingOrderService.getAllProcessingOrders();
  res.json({
    success: true,
    data: orders,
    total: orders.length
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const order = processingOrderService.getProcessingOrder(req.params.id);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: '加工单不存在'
      }
    });
  }
  res.json({
    success: true,
    data: order
  });
});

router.get('/number/:orderNumber', (req: Request, res: Response) => {
  const order = processingOrderService.getProcessingOrderByNumber(req.params.orderNumber);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: '加工单不存在'
      }
    });
  }
  res.json({
    success: true,
    data: order
  });
});

router.patch(
  '/:id/status',
  validateRequest(['targetStatus', 'performedBy', 'userRole']),
  (req: Request, res: Response) => {
    const result = processingOrderService.updateProcessingOrderStatus({
      processingOrderId: req.params.id,
      targetStatus: req.body.targetStatus,
      performedBy: req.body.performedBy,
      userRole: req.body.userRole,
      assignedTechnician: req.body.assignedTechnician
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'STATUS_UPDATE_FAILED',
          message: result.message,
          details: result.availableTransitions
        }
      });
    }

    res.json(result);
  }
);

export default router;
