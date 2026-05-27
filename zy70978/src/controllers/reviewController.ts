import { Request, Response } from 'express';
import { reviewService } from '../services/reviewService';

export const approveOrder = (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const { reviewer, comments } = req.body;

    if (!reviewer) {
      return res.status(400).json({ error: '请提供复核人信息' });
    }

    const result = reviewService.approveOrder(orderNo, reviewer, comments);
    res.json({
      message: '订单已通过复核',
      reviewRecord: result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectOrder = (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const { reviewer, comments } = req.body;

    if (!reviewer) {
      return res.status(400).json({ error: '请提供复核人信息' });
    }

    const result = reviewService.rejectOrder(orderNo, reviewer, comments);
    res.json({
      message: '订单已退回',
      reviewRecord: result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const requestMoreInfo = (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const { reviewer, comments } = req.body;

    if (!reviewer) {
      return res.status(400).json({ error: '请提供复核人信息' });
    }

    const result = reviewService.requestMoreInfo(orderNo, reviewer, comments);
    res.json({
      message: '已要求补充材料',
      reviewRecord: result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const resetToPending = (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const { reviewer, comments } = req.body;

    if (!reviewer) {
      return res.status(400).json({ error: '请提供复核人信息' });
    }

    const result = reviewService.resetToPending(orderNo, reviewer, comments);
    res.json({
      message: '订单已重置为待复核状态',
      reviewRecord: result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateRepairLiability = (req: Request, res: Response) => {
  try {
    const { repairId } = req.params;
    const { liability, reviewer, comments } = req.body;

    if (!reviewer) {
      return res.status(400).json({ error: '请提供操作人信息' });
    }

    reviewService.updateRepairLiability(repairId, liability, reviewer, comments);
    res.json({
      message: '维修责任归属已更新',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const bindRepairToOrder = (req: Request, res: Response) => {
  try {
    const { repairId, orderNo } = req.body;

    if (!repairId || !orderNo) {
      return res.status(400).json({ error: '请提供维修记录ID和订单号' });
    }

    reviewService.bindRepairToOrder(repairId, orderNo);
    res.json({
      message: '维修记录已绑定到订单',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const unbindRepairFromOrder = (req: Request, res: Response) => {
  try {
    const { repairId } = req.params;

    reviewService.unbindRepairFromOrder(repairId);
    res.json({
      message: '维修记录已解绑',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOrderReviewHistory = (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const history = reviewService.getOrderReviewHistory(orderNo);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getStatusExplanation = (req: Request, res: Response) => {
  try {
    const { status } = req.params;
    const explanation = reviewService.getStatusExplanation(status as any);
    res.json({ status, explanation });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
