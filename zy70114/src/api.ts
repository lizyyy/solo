import express, { Request, Response } from 'express';
import {
  successResponse,
  errorResponse,
  BusinessError,
} from './utils/response';
import {
  processCreateOrder,
  processMerchantAccept,
  processStartCooking,
  processMealReady,
  processRiderPickup,
  processDeliver,
  processAssignRider,
  processOvertimeWorkflow,
  getOrderFullInfo,
  formatOrderInfo,
} from './services/workflowService';
import {
  getOrderByNo,
} from './services/orderService';
import {
  getCompensations,
  approveCompensation,
  rejectCompensation,
  executeCompensation,
  getCompensationById,
} from './services/compensationService';
import {
  createAppeal,
  startReview,
  reviewAppeal,
  manualRollback,
  getAppeals,
} from './services/appealService';
import {
  manualJudgeLiability,
} from './services/liabilityService';
import {
  generateReport,
  formatReportForDisplay,
} from './services/reportService';
import { ReportPeriod, LiabilityParty } from './types';
import { getOperationLogs } from './services/idempotentService';

const app = express();
app.use(express.json());

app.use((err: Error, req: Request, res: Response, next: Function) => {
  if (err instanceof BusinessError) {
    res.json(errorResponse(
      err.code,
      err.message,
      err.businessMessage
    ));
  } else {
    console.error('Unexpected error:', err);
    res.json(errorResponse(
      'INTERNAL_ERROR',
      '系统内部错误',
      '系统处理出错，请稍后重试或联系技术支持'
    ));
  }
});

app.post('/api/orders', (req: Request, res: Response) => {
  try {
    const result = processCreateOrder(req.body);
    res.json(successResponse(result, '订单创建成功', result.business_message));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/orders/:orderId/accept', (req: Request, res: Response) => {
  try {
    const { operator_id, operator_role } = req.body;
    const result = processMerchantAccept(
      req.params.orderId,
      operator_id || 'system',
      operator_role || 'merchant'
    );
    res.json(successResponse(result, '商家接单成功', result.business_message));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/orders/:orderId/cooking', (req: Request, res: Response) => {
  try {
    const { operator_id, operator_role } = req.body;
    const result = processStartCooking(
      req.params.orderId,
      operator_id || 'system',
      operator_role || 'merchant'
    );
    res.json(successResponse(result, '开始制作成功', result.business_message));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/orders/:orderId/meal-ready', (req: Request, res: Response) => {
  try {
    const { operator_id, operator_role } = req.body;
    const result = processMealReady(
      req.params.orderId,
      operator_id || 'system',
      operator_role || 'merchant'
    );
    res.json(successResponse(result, '出餐上报成功', result.business_message));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/orders/:orderId/pickup', (req: Request, res: Response) => {
  try {
    const { operator_id, operator_role } = req.body;
    const result = processRiderPickup(
      req.params.orderId,
      operator_id || 'system',
      operator_role || 'rider'
    );
    res.json(successResponse(result, '取餐成功', result.business_message));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/orders/:orderId/deliver', (req: Request, res: Response) => {
  try {
    const { operator_id, operator_role } = req.body;
    const result = processDeliver(
      req.params.orderId,
      operator_id || 'system',
      operator_role || 'rider'
    );
    res.json(successResponse(result, '送达成功', result.business_message));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/orders/:orderId/assign-rider', (req: Request, res: Response) => {
  try {
    const { rider_id, rider_name, operator_id, operator_role } = req.body;
    const result = processAssignRider(
      req.params.orderId,
      rider_id,
      rider_name,
      operator_id || 'system',
      operator_role || 'platform'
    );
    res.json(successResponse(result, '骑手分配成功', result.business_message));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.get('/api/orders/:orderId', (req: Request, res: Response) => {
  try {
    const result = getOrderFullInfo(req.params.orderId);
    const formatted = formatOrderInfo(result);
    res.json(successResponse({
      raw: result,
      formatted,
    }, '查询成功'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.get('/api/orders/by-no/:orderNo', (req: Request, res: Response) => {
  try {
    const order = getOrderByNo(req.params.orderNo);
    const result = getOrderFullInfo(order.id);
    const formatted = formatOrderInfo(result);
    res.json(successResponse({
      raw: result,
      formatted,
    }, '查询成功'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/orders/:orderId/process-overtime', (req: Request, res: Response) => {
  try {
    const { operator_id, operator_role } = req.body;
    const result = processOvertimeWorkflow(
      req.params.orderId,
      operator_id || 'system',
      operator_role || 'platform'
    );
    res.json(successResponse(result, '超时处理完成', result.business_message));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/orders/:orderId/judge-liability', (req: Request, res: Response) => {
  try {
    const { liable_party, reason, evidence, operator_id, operator_role } = req.body;
    const result = manualJudgeLiability(
      req.params.orderId,
      liable_party,
      reason,
      evidence || null,
      operator_id,
      operator_role
    );
    res.json(successResponse(result, '责任判定成功'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.get('/api/orders/:orderId/compensations', (req: Request, res: Response) => {
  try {
    const result = getCompensations(req.params.orderId);
    res.json(successResponse(result, '查询成功'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/compensations/:compensationId/approve', (req: Request, res: Response) => {
  try {
    const { operator_id, operator_role } = req.body;
    const result = approveCompensation(
      req.params.compensationId,
      operator_id,
      operator_role
    );
    res.json(successResponse(result, '补偿审批通过'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/compensations/:compensationId/reject', (req: Request, res: Response) => {
  try {
    const { reason, operator_id, operator_role } = req.body;
    const result = rejectCompensation(
      req.params.compensationId,
      reason,
      operator_id,
      operator_role
    );
    res.json(successResponse(result, '补偿已拒绝'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/compensations/:compensationId/execute', (req: Request, res: Response) => {
  try {
    const { operator_id, operator_role } = req.body;
    const result = executeCompensation(
      req.params.compensationId,
      operator_id,
      operator_role
    );
    res.json(successResponse(result, '补偿已执行'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/compensations/:compensationId/rollback', (req: Request, res: Response) => {
  try {
    const { reason, operator_id, operator_role } = req.body;
    manualRollback(
      req.params.compensationId,
      operator_id,
      operator_role,
      reason
    );
    const result = getCompensationById(req.params.compensationId);
    res.json(successResponse(result, '补偿已回滚'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/orders/:orderId/appeals', (req: Request, res: Response) => {
  try {
    const { compensation_id, appellant_party, appellant_id, appeal_reason, appeal_evidence } = req.body;
    const result = createAppeal(
      req.params.orderId,
      compensation_id,
      appellant_party as LiabilityParty,
      appellant_id,
      appeal_reason,
      appeal_evidence || null
    );
    res.json(successResponse(result, '申诉提交成功'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.get('/api/orders/:orderId/appeals', (req: Request, res: Response) => {
  try {
    const result = getAppeals(req.params.orderId);
    res.json(successResponse(result, '查询成功'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/appeals/:appealId/start-review', (req: Request, res: Response) => {
  try {
    const { reviewer_id, reviewer_role } = req.body;
    const result = startReview(
      req.params.appealId,
      reviewer_id,
      reviewer_role
    );
    res.json(successResponse(result, '已开始审核'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.post('/api/appeals/:appealId/review', (req: Request, res: Response) => {
  try {
    const { approved, review_result, reviewer_id, reviewer_role } = req.body;
    const result = reviewAppeal(
      req.params.appealId,
      reviewer_id,
      reviewer_role,
      approved,
      review_result
    );
    res.json(successResponse(result, approved ? '申诉通过' : '申诉驳回'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.get('/api/reports/:period', (req: Request, res: Response) => {
  try {
    const period = req.params.period as ReportPeriod;
    const result = generateReport(period);
    const formatted = formatReportForDisplay(result);
    res.json(successResponse({
      raw: result,
      formatted,
    }, '报表生成成功'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.get('/api/orders/:orderId/logs', (req: Request, res: Response) => {
  try {
    const result = getOperationLogs(req.params.orderId);
    res.json(successResponse(result, '查询成功'));
  } catch (err) {
    if (err instanceof BusinessError) {
      res.json(errorResponse(err.code, err.message, err.businessMessage));
    } else {
      throw err;
    }
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json(successResponse({ status: 'ok' }, '服务正常'));
});

export { app };
