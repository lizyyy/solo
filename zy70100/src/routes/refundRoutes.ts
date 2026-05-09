import express, { Request, Response } from 'express';
import { RefundService, CreateRefundRequest } from '../services/RefundService';
import { InterruptionReason } from '../types';

const router = express.Router();

let refundService: RefundService | null = null;

function getRefundService(): RefundService {
  if (!refundService) {
    refundService = new RefundService();
  }
  return refundService;
}

router.post('/requests', (req: Request, res: Response) => {
  try {
    const { requestId, sessionId, interruptionReason, interruptionTime, description } = req.body;

    if (!requestId || !sessionId || !interruptionReason || !interruptionTime) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: requestId, sessionId, interruptionReason, interruptionTime',
      });
    }

    const validReasons = Object.values(InterruptionReason);
    if (!validReasons.includes(interruptionReason as InterruptionReason)) {
      return res.status(400).json({
        success: false,
        message: '无效的中断原因',
        validReasons,
      });
    }

    const createRequest: CreateRefundRequest = {
      requestId,
      sessionId,
      interruptionReason: interruptionReason as InterruptionReason,
      interruptionTime: new Date(interruptionTime),
      description,
    };

    const service = getRefundService();
    const result = service.createRefundRequest(createRequest, req.headers['x-operator'] as string || 'API');

    if (result.success) {
      return res.status(201).json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('创建退款请求失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
});

router.get('/requests/:requestId', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const service = getRefundService();
    const detail = service.getRefundDetail(requestId);

    if (!detail) {
      return res.status(404).json({
        success: false,
        message: '退款记录不存在',
      });
    }

    return res.status(200).json({
      success: true,
      data: detail,
    });
  } catch (error) {
    console.error('查询退款详情失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
});

router.post('/requests/:requestId/approve', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const service = getRefundService();
    const result = service.approveRefund(requestId, req.headers['x-operator'] as string || 'API');

    if (result.success) {
      return res.status(200).json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('审批失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
});

router.post('/requests/:requestId/callback', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { response } = req.body;
    const service = getRefundService();
    const result = service.sendCallback(
      requestId,
      response,
      req.headers['x-operator'] as string || 'API'
    );

    if (result.success) {
      return res.status(200).json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('发送回调失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
});

router.post('/requests/:requestId/reconcile', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { success } = req.body;

    if (typeof success !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'success 参数必须是布尔值',
      });
    }

    const service = getRefundService();
    const result = service.reconcile(
      requestId,
      success,
      req.headers['x-operator'] as string || 'API'
    );

    if (result.success) {
      return res.status(200).json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('对账失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
});

router.post('/requests/:requestId/complete', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const service = getRefundService();
    const result = service.complete(
      requestId,
      req.headers['x-operator'] as string || 'API'
    );

    if (result.success) {
      return res.status(200).json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('完成失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
});

export default router;
