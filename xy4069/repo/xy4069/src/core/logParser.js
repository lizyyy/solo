export class LogParser {
  constructor() {
    this.validationErrors = [];
    this.isolationList = [];
  }

  parse(rawLogs) {
    this.validationErrors = [];
    this.isolationList = [];

    if (!Array.isArray(rawLogs)) {
      this._addError('INVALID_FORMAT', '日志必须是数组格式', { raw: rawLogs });
      return null;
    }

    const parsedLogs = [];
    const operationIds = new Set();
    const userVersions = new Map();

    for (let i = 0; i < rawLogs.length; i++) {
      const rawOp = rawLogs[i];
      const result = this._validateAndParseOperation(rawOp, i, operationIds, userVersions);
      
      if (result.isValid) {
        parsedLogs.push(result.operation);
        operationIds.add(result.operation.operationId);
        
        const userId = result.operation.userId;
        const currentVersion = result.operation.version;
        if (!userVersions.has(userId)) {
          userVersions.set(userId, currentVersion);
        } else {
          userVersions.set(userId, Math.max(userVersions.get(userId), currentVersion));
        }
      } else {
        this.isolationList.push({
          index: i,
          rawOperation: rawOp,
          errors: result.errors,
          isolatedAt: new Date().toISOString()
        });
      }
    }

    this._checkGlobalOrdering(parsedLogs);

    return {
      operations: this._sortByTimestamp(parsedLogs),
      validationErrors: this.validationErrors,
      isolationList: this.isolationList,
      stats: {
        total: rawLogs.length,
        valid: parsedLogs.length,
        invalid: this.isolationList.length,
        uniqueUsers: new Set(parsedLogs.map(op => op.userId)).size
      }
    };
  }

  _validateAndParseOperation(rawOp, index, operationIds, userVersions) {
    const errors = [];
    
    const requiredFields = ['operationId', 'userId', 'timestamp', 'version', 'type', 'payload'];
    const missingFields = requiredFields.filter(field => !(field in rawOp));
    
    if (missingFields.length > 0) {
      errors.push({
        type: 'MISSING_FIELDS',
        message: `缺少必填字段: ${missingFields.join(', ')}`,
        fields: missingFields
      });
    }

    if ('operationId' in rawOp) {
      if (operationIds.has(rawOp.operationId)) {
        errors.push({
          type: 'DUPLICATE_OPERATION_ID',
          message: `重复的操作ID: ${rawOp.operationId}`,
          operationId: rawOp.operationId
        });
        this._addError('DUPLICATE_OPERATION_ID', `第 ${index} 条记录: 重复操作ID ${rawOp.operationId}`, { index, operationId: rawOp.operationId });
      }
    }

    if ('version' in rawOp && 'userId' in rawOp) {
      const userId = rawOp.userId;
      const version = rawOp.version;
      
      if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
        errors.push({
          type: 'INVALID_VERSION',
          message: `版本号必须是非负整数: ${version}`,
          version: version
        });
      } else if (userVersions.has(userId)) {
        const lastVersion = userVersions.get(userId);
        if (version - lastVersion > 1) {
          const error = {
            type: 'VERSION_JUMP',
            message: `用户 ${userId} 版本跳跃: 期望 ${lastVersion + 1}, 实际 ${version}`,
            expected: lastVersion + 1,
            actual: version
          };
          errors.push(error);
          this._addError('VERSION_JUMP', `第 ${index} 条记录: ${error.message}`, { index, ...error });
        }
      }
    }

    if ('timestamp' in rawOp) {
      const ts = rawOp.timestamp;
      if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        if (isNaN(parsed)) {
          errors.push({
            type: 'INVALID_TIMESTAMP',
            message: `无效的时间戳格式: ${ts}`,
            timestamp: ts
          });
        }
      } else if (typeof ts !== 'number') {
        errors.push({
          type: 'INVALID_TIMESTAMP',
          message: `时间戳必须是数字或ISO字符串: ${typeof ts}`,
          timestamp: ts
        });
      }
    }

    const validTypes = ['INSERT', 'DELETE', 'CURSOR_MOVE', 'UNDO', 'REDO', 'RECONNECT', 'MERGE'];
    if ('type' in rawOp && !validTypes.includes(rawOp.type)) {
      errors.push({
        type: 'INVALID_OPERATION_TYPE',
        message: `无效的操作类型: ${rawOp.type}`,
        type: rawOp.type,
        validTypes: validTypes
      });
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    const operation = {
      ...rawOp,
      parsedTimestamp: this._parseTimestamp(rawOp.timestamp),
      originalIndex: index
    };

    return { isValid: true, operation };
  }

  _checkGlobalOrdering(operations) {
    if (operations.length < 2) return;

    for (let i = 1; i < operations.length; i++) {
      const prev = operations[i - 1];
      const curr = operations[i];
      
      if (curr.parsedTimestamp < prev.parsedTimestamp) {
        this._addError('OUT_OF_ORDER', `操作时间戳乱序: 第 ${curr.originalIndex} 条记录时间早于第 ${prev.originalIndex} 条`, {
          earlierIndex: curr.originalIndex,
          earlierTimestamp: curr.timestamp,
          laterIndex: prev.originalIndex,
          laterTimestamp: prev.timestamp
        });
      }
    }
  }

  _parseTimestamp(timestamp) {
    if (typeof timestamp === 'number') {
      return timestamp;
    }
    return Date.parse(timestamp);
  }

  _sortByTimestamp(operations) {
    return [...operations].sort((a, b) => a.parsedTimestamp - b.parsedTimestamp);
  }

  _addError(type, message, details = {}) {
    this.validationErrors.push({
      type,
      message,
      details,
      timestamp: new Date().toISOString()
    });
  }

  getValidationErrors() {
    return this.validationErrors;
  }

  getIsolationList() {
    return this.isolationList;
  }
}
