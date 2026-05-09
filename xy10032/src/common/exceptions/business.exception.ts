import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    code: string = 'BUSINESS_ERROR',
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        code,
        message,
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }
}

export class RefundNotFoundException extends BusinessException {
  constructor(refundId: string) {
    super(`Refund not found: ${refundId}`, 'REFUND_NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}

export class UserNotFoundException extends BusinessException {
  constructor(username: string) {
    super(`User not found: ${username}`, 'USER_NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}

export class InvalidStatusTransitionException extends BusinessException {
  constructor(current: string, target: string) {
    super(`Invalid status transition: ${current} -> ${target}`, 'INVALID_STATUS_TRANSITION');
  }
}

export class DuplicateRefundException extends BusinessException {
  constructor(orderNo: string) {
    super(`Duplicate refund detected for order: ${orderNo}`, 'DUPLICATE_REFUND');
  }
}

export class PermissionDeniedException extends BusinessException {
  constructor() {
    super('Permission denied', 'PERMISSION_DENIED', HttpStatus.FORBIDDEN);
  }
}

export class ValidationException extends BusinessException {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class GatewayTimeoutException extends BusinessException {
  constructor() {
    super('Payment gateway timeout', 'GATEWAY_TIMEOUT', HttpStatus.GATEWAY_TIMEOUT);
  }
}
