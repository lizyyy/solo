import { v4 as uuidv4 } from 'uuid';
import { ApiResponse } from '../types';

export { ApiResponse };

export enum BusinessErrorCode {
  SUCCESS = 'SUCCESS',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  IDEMPOTENT_CONFLICT = 'IDEMPOTENT_CONFLICT',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  ALREADY_REVIEWED = 'ALREADY_REVIEWED',
  SPLIT_ORDER_BLOCKED = 'SPLIT_ORDER_BLOCKED',
  CONCURRENT_CONFLICT = 'CONCURRENT_CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export const BusinessErrorMessage: Record<BusinessErrorCode, string> = {
  [BusinessErrorCode.SUCCESS]: '操作成功',
  [BusinessErrorCode.INVALID_STATUS_TRANSITION]: '状态流转不合法',
  [BusinessErrorCode.IDEMPOTENT_CONFLICT]: '重复请求，请检查幂等键',
  [BusinessErrorCode.RECORD_NOT_FOUND]: '记录不存在',
  [BusinessErrorCode.ALREADY_REVIEWED]: '该记录已完成复核，请勿重复操作',
  [BusinessErrorCode.SPLIT_ORDER_BLOCKED]: '该用户存在拆单绕开阈值风险，需人工备注后继续',
  [BusinessErrorCode.CONCURRENT_CONFLICT]: '并发冲突，请稍后重试',
  [BusinessErrorCode.VALIDATION_ERROR]: '参数校验失败'
};

export function createSuccessResponse<T>(data?: T, message: string = '操作成功'): ApiResponse<T> {
  return {
    success: true,
    code: '200',
    message,
    businessCode: BusinessErrorCode.SUCCESS,
    businessMessage: BusinessErrorMessage[BusinessErrorCode.SUCCESS],
    data,
    timestamp: new Date().toISOString(),
    requestId: uuidv4()
  };
}

export function createBusinessErrorResponse<T>(
  businessCode: BusinessErrorCode,
  customMessage?: string,
  data?: T
): ApiResponse<T> {
  return {
    success: false,
    code: '400',
    message: '业务处理失败',
    businessCode,
    businessMessage: customMessage || BusinessErrorMessage[businessCode],
    data,
    timestamp: new Date().toISOString(),
    requestId: uuidv4()
  };
}

export function createErrorResponse<T>(
  code: string,
  message: string,
  businessCode?: BusinessErrorCode,
  businessMessage?: string,
  data?: T
): ApiResponse<T> {
  return {
    success: false,
    code,
    message,
    businessCode,
    businessMessage,
    data,
    timestamp: new Date().toISOString(),
    requestId: uuidv4()
  };
}
