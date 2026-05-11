const { ErrorCodes } = require('./enums');

class BusinessError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.status = BusinessError.getStatus(code);
  }

  static getStatus(code) {
    const statusMap = {
      [ErrorCodes.CONFERENCE_NOT_FOUND]: 404,
      [ErrorCodes.INTERPRETER_NOT_FOUND]: 404,
      [ErrorCodes.DEVICE_NOT_FOUND]: 404,
      [ErrorCodes.ROOM_NOT_FOUND]: 404,
      [ErrorCodes.CHANNEL_NOT_FOUND]: 404,
      [ErrorCodes.SCHEDULE_NOT_FOUND]: 404,
      [ErrorCodes.STATE_CONFLICT]: 409,
      [ErrorCodes.DUPLICATE_SUBMISSION]: 409,
      [ErrorCodes.SOURCE_RECORD_MISSING]: 400,
      [ErrorCodes.INTERPRETER_CONFLICT]: 409,
      [ErrorCodes.DEVICE_CONFLICT]: 409,
      [ErrorCodes.CHANNEL_CONFLICT]: 409,
      [ErrorCodes.TIME_SLOT_CONFLICT]: 409,
      [ErrorCodes.LANGUAGE_MISMATCH]: 400,
      [ErrorCodes.INVALID_STATE_TRANSITION]: 409,
      [ErrorCodes.VALIDATION_ERROR]: 400
    };
    return statusMap[code] || 500;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      }
    };
  }
}

class NotFoundError extends BusinessError {
  constructor(resource, id) {
    const codeMap = {
      'Conference': ErrorCodes.CONFERENCE_NOT_FOUND,
      'Interpreter': ErrorCodes.INTERPRETER_NOT_FOUND,
      'Device': ErrorCodes.DEVICE_NOT_FOUND,
      'Room': ErrorCodes.ROOM_NOT_FOUND,
      'LanguageChannel': ErrorCodes.CHANNEL_NOT_FOUND,
      'Schedule': ErrorCodes.SCHEDULE_NOT_FOUND
    };
    super(
      codeMap[resource] || ErrorCodes.VALIDATION_ERROR,
      `${resource} not found`,
      { resource, id }
    );
  }
}

class ConflictError extends BusinessError {
  constructor(code, message, details = {}) {
    super(code, message, details);
  }
}

class ValidationError extends BusinessError {
  constructor(message, details = {}) {
    super(ErrorCodes.VALIDATION_ERROR, message, details);
  }
}

module.exports = {
  BusinessError,
  NotFoundError,
  ConflictError,
  ValidationError
};
