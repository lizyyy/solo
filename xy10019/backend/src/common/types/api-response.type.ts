export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  requestId?: string;
  timestamp: string;
}

export function success<T>(data: T, message?: string, requestId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

export function error(
  message: string,
  code: string = 'ERROR',
  requestId?: string,
): ApiResponse {
  return {
    success: false,
    message,
    requestId,
    timestamp: new Date().toISOString(),
  };
}
