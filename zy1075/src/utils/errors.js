class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = null, suggestion = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.suggestion = suggestion;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(
      message,
      'VALIDATION_ERROR',
      details,
      '请检查输入数据格式是否正确'
    );
  }
}

class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(
      message,
      'NOT_FOUND',
      null,
      '请检查资源ID是否正确'
    );
  }
}

class ForbiddenError extends AppError {
  constructor(message = '没有权限执行此操作') {
    super(
      message,
      'FORBIDDEN',
      null,
      '请联系管理员获取权限'
    );
  }
}

class ConflictError extends AppError {
  constructor(message, suggestion = null) {
    super(
      message,
      'CONFLICT',
      null,
      suggestion
    );
  }
}

class ReservationConflictError extends ConflictError {
  constructor(conflictingReservations, itemName) {
    const message = `预约时间冲突，该时间段内${itemName}已被预约`;
    const suggestion = `建议选择其他时间段，或者加入候补队列等待空位`;
    super(message, suggestion);
    this.conflictingReservations = conflictingReservations;
  }
}

class InsufficientStockError extends ConflictError {
  constructor(available, requested, itemName) {
    const message = `${itemName}库存不足，当前可借${available}件，您需要${requested}件`;
    const suggestion = `建议减少预约数量，或者选择其他物品`;
    super(message, suggestion);
    this.available = available;
    this.requested = requested;
  }
}

class MaintenanceError extends ConflictError {
  constructor(itemName) {
    const message = `${itemName}正在维护中，暂时无法预约`;
    const suggestion = `请稍后再试，或者选择其他可用物品`;
    super(message, suggestion);
  }
}

class InsufficientBalanceError extends ConflictError {
  constructor(required, current, itemName) {
    const message = `账户余额不足，预约${itemName}需要${required}元押金，当前余额${current}元`;
    const suggestion = `请先充值账户余额，或者选择押金更低的物品`;
    super(message, suggestion);
    this.required = required;
    this.current = current;
  }
}

class UserSuspendedError extends ForbiddenError {
  constructor(userName) {
    super(`${userName}的账户已被暂停，无法进行预约操作`);
  }
}

class LoanAlreadyReturnedError extends ConflictError {
  constructor() {
    super('该借出记录已经归还，无法重复操作');
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ReservationConflictError,
  InsufficientStockError,
  MaintenanceError,
  InsufficientBalanceError,
  UserSuspendedError,
  LoanAlreadyReturnedError,
};
