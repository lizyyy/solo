import { Router, Request, Response, NextFunction } from 'express';
import {
  createOverdueBill,
  processEquipmentReturn,
  getOverdueBills,
  reviewOverdueBill,
  checkPartialReturn,
  verifyBillConsistency
} from '../services/overdueService';

const router = Router();

router.post('/bills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ORDER_ID',
          message: '缺少订单号参数',
          details: '生成逾期账单必须提供订单号',
          suggestion: '请在请求体中提供 order_id 参数'
        }
      });
    }

    const result = await createOverdueBill(order_id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/bills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, review_status } = req.query;
    const bills = await getOverdueBills(
      status as string | undefined,
      review_status as string | undefined
    );
    res.json({
      success: true,
      data: bills
    });
  } catch (error) {
    next(error);
  }
});

router.post('/return', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { order_id, equipment_id, return_condition, return_staff, actual_return_date } = req.body;

    if (!order_id || !equipment_id || !return_condition || !return_staff) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必填字段',
          details: '归还设备必须提供订单号、设备编号、设备状态和操作员',
          suggestion: '请检查请求体中是否包含 order_id, equipment_id, return_condition, return_staff'
        }
      });
    }

    const result = await processEquipmentReturn({
      order_id,
      equipment_id,
      return_condition,
      return_staff,
      actual_return_date
    });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/bills/:billId/review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { billId } = req.params;
    const { review_decision, review_notes, reviewed_by } = req.body;

    if (!review_decision || !reviewed_by) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REVIEW_INFO',
          message: '缺少审核信息',
          details: '审核逾期账单必须提供审核决定和审核人',
          suggestion: '请在请求体中提供 review_decision (approved/rejected) 和 reviewed_by 参数'
        }
      });
    }

    const result = await reviewOverdueBill(billId, review_decision, review_notes || '', reviewed_by);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/orders/:orderId/partial-return', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const result = await checkPartialReturn(orderId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/orders/:orderId/consistency', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const result = await verifyBillConsistency(orderId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
