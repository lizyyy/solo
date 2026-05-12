import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  code: number;
  timestamp: string;
}

export class ApiError extends Error {
  public code: number;
  public details?: any;

  constructor(message: string, code: number = 500, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function successResponse<T>(res: Response, data: T, message: string = '操作成功', code: number = 200): Response<ApiResponse<T>> {
  return res.status(code).json({
    success: true,
    data,
    message,
    code,
    timestamp: new Date().toISOString(),
  });
}

export function errorResponse(res: Response, error: ApiError | Error, code: number = 500): Response<ApiResponse> {
  const apiError = error instanceof ApiError ? error : new ApiError(error.message, code);
  
  return res.status(apiError.code).json({
    success: false,
    message: apiError.message,
    code: apiError.code,
    details: apiError.details,
    timestamp: new Date().toISOString(),
  });
}

export const BusinessError = {
  MERCHANT_NOT_FOUND: new ApiError('商户不存在', 404),
  SETTLEMENT_NOT_FOUND: new ApiError('结算单不存在', 404),
  ORDER_NOT_FOUND: new ApiError('订单不存在', 404),
  PENALTY_NOT_FOUND: new ApiError('扣罚记录不存在', 404),
  APPEAL_NOT_FOUND: new ApiError('申诉记录不存在', 404),
  REFUND_NOT_FOUND: new ApiError('退款记录不存在', 404),
  PAYMENT_NOT_FOUND: new ApiError('打款记录不存在', 404),
  
  SETTLEMENT_ALREADY_EXISTS: new ApiError('该账期已存在结算单', 400),
  SETTLEMENT_ALREADY_PAID: new ApiError('结算单已打款，无法修改', 400),
  SETTLEMENT_ALREADY_CONFIRMED: new ApiError('结算单已确认，无法修改', 400),
  SETTLEMENT_FROZEN: new ApiError('结算单已冻结', 400),
  SETTLEMENT_INVALID_STATUS: new ApiError('结算单状态不允许此操作', 400),
  
  ORDER_ALREADY_SETTLED: new ApiError('订单已在其他结算单中', 400),
  PENALTY_ALREADY_SETTLED: new ApiError('扣罚已在其他结算单中', 400),
  PENALTY_APPEALING: new ApiError('扣罚正在申诉中，暂缓结算', 400),
  
  APPEAL_ALREADY_REVIEWED: new ApiError('申诉已审核，无法修改', 400),
  
  PAYMENT_ALREADY_SUCCESS: new ApiError('打款已成功，无法重复操作', 400),
  PAYMENT_PROCESSING: new ApiError('打款处理中', 400),
  
  IDEMPOTENCY_KEY_EXISTS: new ApiError('幂等键已存在，请求已处理', 409),
  
  INVALID_PARAMETER: (param: string) => new ApiError(`参数错误: ${param}`, 400),
  INSUFFICIENT_BALANCE: new ApiError('余额不足', 400),
  MANUAL_ADJUSTMENT_NOT_ALLOWED: new ApiError('当前状态不允许人工调整', 400),
};
