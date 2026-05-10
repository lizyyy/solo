import { ApiResponse } from '../types';
import { now } from '../database';

export class BusinessError extends Error {
  code: string;
  businessMessage: string;

  constructor(message: string, businessMessage: string, code: string = 'BUSINESS_ERROR') {
    super(message);
    this.code = code;
    this.businessMessage = businessMessage;
    this.name = 'BusinessError';
  }
}

export const successResponse = <T>(
  data?: T,
  message: string = '操作成功',
  businessMessage?: string
): ApiResponse<T> => ({
  success: true,
  code: 'SUCCESS',
  message,
  business_message: businessMessage,
  data,
  timestamp: now(),
});

export const errorResponse = <T = null>(
  code: string,
  message: string,
  businessMessage: string,
  data?: T
): ApiResponse<T> => ({
  success: false,
  code,
  message,
  business_message: businessMessage,
  data,
  timestamp: now(),
});

export const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  }
  return `${seconds}秒`;
};

export const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatCurrency = (amount: number, currency: string = 'CNY'): string => {
  const symbols: Record<string, string> = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
  };
  return `${symbols[currency] || ''}${amount.toFixed(2)}`;
};
