import { Request, Response } from 'express';
import { orderService } from '../services';

class OrderController {
  async createOrUpdateOrder(req: Request, res: Response) {
    try {
      const order = await orderService.createOrUpdateOrder(req.body);
      res.status(200).json({
        success: true,
        data: { order },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '更新订单失败',
      });
    }
  }

  async requestRefund(req: Request, res: Response) {
    try {
      const result = await orderService.requestRefund(req.body);
      res.status(200).json({
        success: true,
        data: {
          order: result.order,
          ticket: result.ticket,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '申请退款失败',
      });
    }
  }

  async approveRefund(req: Request, res: Response) {
    try {
      const result = await orderService.approveRefund(
        req.params.orderCode,
        req.body.operatorId,
        req.body.operatorName
      );
      res.status(200).json({
        success: true,
        data: {
          order: result.order,
          ticket: result.ticket,
          needsMaintenance: result.needsMaintenance,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '批准退款失败',
      });
    }
  }

  async rejectRefund(req: Request, res: Response) {
    try {
      const result = await orderService.rejectRefund(
        req.params.orderCode,
        req.body.reason,
        req.body.operatorId,
        req.body.operatorName
      );
      res.status(200).json({
        success: true,
        data: {
          order: result.order,
          ticket: result.ticket,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '拒绝退款失败',
      });
    }
  }

  async getOrder(req: Request, res: Response) {
    try {
      const order = await orderService.getOrder(req.params.orderCode);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: '订单不存在',
        });
      }
      res.json({
        success: true,
        data: { order },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '查询订单失败',
      });
    }
  }
}

export default new OrderController();
