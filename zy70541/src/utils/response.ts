import prisma from './prisma';
import type { ApiErrorDetails } from './errors';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: ApiErrorDetails;
  };
}

export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: ApiErrorDetails
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

export async function recordError(
  operation: string,
  rawInput: any,
  processingBasis: string,
  conclusion: string,
  errorMessage: string,
  operator?: string
): Promise<void> {
  try {
    await prisma.errorRecord.create({
      data: {
        operation,
        raw_input: JSON.stringify(rawInput),
        processing_basis: processingBasis,
        conclusion,
        error_message: errorMessage,
        operator,
      },
    });
  } catch (err) {
    console.error('记录错误日志失败:', err);
  }
}
