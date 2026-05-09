export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '未授权访问') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '权限不足') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = '资源未找到') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

export class StatusTransitionError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class DuplicateRefundError extends ConflictError {
  constructor(orderNo: string) {
    super(`订单 ${orderNo} 已存在处理中的退款申请`);
  }
}
