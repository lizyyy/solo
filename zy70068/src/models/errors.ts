export class BusinessError extends Error {
  code: string;
  
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'BusinessError';
  }
}

export class LineVersionNotFoundError extends BusinessError {
  constructor(lineId: string) {
    super('LINE_VERSION_NOT_FOUND', `未找到线路 ${lineId} 的有效版本`);
  }
}

export class DetourConflictError extends BusinessError {
  constructor(existingEventId: string) {
    super('DETOUR_CONFLICT', `与现有绕行事件 ${existingEventId} 存在冲突`);
  }
}

export class DetourAlreadyActiveError extends BusinessError {
  constructor(eventId: string) {
    super('DETOUR_ALREADY_ACTIVE', `绕行事件 ${eventId} 已处于激活状态`);
  }
}

export class DetourCancelledError extends BusinessError {
  constructor(eventId: string) {
    super('DETOUR_CANCELLED', `绕行事件 ${eventId} 已被撤销`);
  }
}

export class NotificationTimeoutError extends BusinessError {
  constructor(notificationId: string) {
    super('NOTIFICATION_TIMEOUT', `通知 ${notificationId} 发送超时`);
  }
}

export class ReceiptTimeoutError extends BusinessError {
  constructor(receiptId: string) {
    super('RECEIPT_TIMEOUT', `司机回执 ${receiptId} 已超时`);
  }
}

export class MaxRetriesExceededError extends BusinessError {
  constructor(notificationId: string, maxRetries: number) {
    super('MAX_RETRIES_EXCEEDED', `通知 ${notificationId} 已超过最大重试次数 ${maxRetries}`);
  }
}
