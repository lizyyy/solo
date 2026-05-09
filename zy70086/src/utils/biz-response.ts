export interface BizResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  data?: T;
  idempotent?: boolean;
}

export const BizCodes = {
  SUCCESS: 'SUCCESS',
  DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
  INVALID_PARAM: 'INVALID_PARAM',
  NOT_FOUND: 'NOT_FOUND',
  STATUS_ERROR: 'STATUS_ERROR',
  BUSINESS_ERROR: 'BUSINESS_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
};

export function success<T>(data: T, message: string = '操作成功'): BizResponse<T> {
  return {
    success: true,
    code: BizCodes.SUCCESS,
    message,
    data,
  };
}

export function idempotent<T>(data: T, message: string = '已处理（重复请求）'): BizResponse<T> {
  return {
    success: true,
    code: BizCodes.DUPLICATE_REQUEST,
    message,
    data,
    idempotent: true,
  };
}

export function fail(code: string, message: string): BizResponse {
  return {
    success: false,
    code,
    message,
  };
}

export function invalidParam(message: string): BizResponse {
  return fail(BizCodes.INVALID_PARAM, message);
}

export function notFound(message: string): BizResponse {
  return fail(BizCodes.NOT_FOUND, message);
}

export function statusError(message: string): BizResponse {
  return fail(BizCodes.STATUS_ERROR, message);
}

export function businessError(message: string): BizResponse {
  return fail(BizCodes.BUSINESS_ERROR, message);
}

export function systemError(message: string): BizResponse {
  return fail(BizCodes.SYSTEM_ERROR, message);
}
