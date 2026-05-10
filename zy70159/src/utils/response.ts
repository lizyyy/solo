export interface BusinessResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  data?: T;
}

export function successResponse<T>(data: T, message: string = '操作成功'): BusinessResponse<T> {
  return {
    success: true,
    code: 'SUCCESS',
    message,
    data,
  };
}

export function errorResponse(code: string, message: string, data?: any): BusinessResponse {
  return {
    success: false,
    code,
    message,
    data,
  };
}
