const { store, Token, TokenStatus, AuditLog, AuditAction } = require('../store');

const ErrorCodes = {
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_ALREADY_EXECUTED: 'TOKEN_ALREADY_EXECUTED',
  TOKEN_ALREADY_REVOKED: 'TOKEN_ALREADY_REVOKED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SCOPE_VIOLATION: 'SCOPE_VIOLATION',
  INVALID_PARAMS: 'INVALID_PARAMS'
};

class TokenService {
  issueToken({
    batchId,
    issuerId,
    issuerName,
    executorId,
    executorName,
    expireAt,
    rollbackAction,
    scope = [],
    metadata = {}
  }) {
    try {
      const token = new Token({
        batchId,
        issuerId,
        issuerName,
        executorId,
        executorName,
        expireAt,
        rollbackAction,
        scope,
        metadata
      });
      store.saveToken(token);
      store.addAuditLog(new AuditLog({
        tokenId: token.tokenId,
        action: AuditAction.ISSUE,
        operatorId: issuerId,
        operatorName: issuerName,
        success: true,
        details: { batchId, rollbackAction, scope }
      }));
      return { success: true, data: store.tokenToResponse(token) };
    } catch (error) {
      return {
        success: false,
        errorCode: ErrorCodes.INVALID_PARAMS,
        errorMessage: error.message
      };
    }
  }

  verifyToken(tokenId, operatorId, operatorName, requestScope = null) {
    const token = store.getToken(tokenId);
    if (!token) {
      const log = new AuditLog({
        tokenId,
        action: AuditAction.VERIFY,
        operatorId,
        operatorName,
        success: false,
        errorCode: ErrorCodes.TOKEN_NOT_FOUND,
        errorMessage: '令牌不存在',
        details: { requestScope }
      });
      store.addAuditLog(log);
      return {
        success: false,
        errorCode: ErrorCodes.TOKEN_NOT_FOUND,
        errorMessage: '令牌不存在'
      };
    }
    if (token.status === TokenStatus.EXPIRED) {
      const log = new AuditLog({
        tokenId,
        action: AuditAction.VERIFY,
        operatorId,
        operatorName,
        success: false,
        errorCode: ErrorCodes.TOKEN_EXPIRED,
        errorMessage: '令牌已过期',
        details: { expireAt: token.expireAt }
      });
      store.addAuditLog(log);
      return {
        success: false,
        errorCode: ErrorCodes.TOKEN_EXPIRED,
        errorMessage: '令牌已过期',
        data: { expireAt: token.expireAt }
      };
    }
    if (token.status === TokenStatus.REVOKED) {
      const log = new AuditLog({
        tokenId,
        action: AuditAction.VERIFY,
        operatorId,
        operatorName,
        success: false,
        errorCode: ErrorCodes.TOKEN_ALREADY_REVOKED,
        errorMessage: '令牌已作废',
        details: { revokeReason: token.revokeReason, revokedAt: token.revokedAt, revokedByName: token.revokedByName }
      });
      store.addAuditLog(log);
      return {
        success: false,
        errorCode: ErrorCodes.TOKEN_ALREADY_REVOKED,
        errorMessage: '令牌已作废',
        data: {
          revokeReason: token.revokeReason,
          revokedAt: token.revokedAt,
          revokedByName: token.revokedByName
        }
      };
    }
    if (token.status === TokenStatus.EXECUTED) {
      const log = new AuditLog({
        tokenId,
        action: AuditAction.VERIFY,
        operatorId,
        operatorName,
        success: false,
        errorCode: ErrorCodes.TOKEN_ALREADY_EXECUTED,
        errorMessage: '令牌已执行',
        details: { executedAt: token.executedAt }
      });
      store.addAuditLog(log);
      return {
        success: false,
        errorCode: ErrorCodes.TOKEN_ALREADY_EXECUTED,
        errorMessage: '令牌已执行',
        data: { executedAt: token.executedAt }
      };
    }
    if (token.executorId && token.executorId !== operatorId) {
      const log = new AuditLog({
        tokenId,
        action: AuditAction.VERIFY,
        operatorId,
        operatorName,
        success: false,
        errorCode: ErrorCodes.PERMISSION_DENIED,
        errorMessage: '无权限执行此令牌',
        details: { allowedExecutor: token.executorId, allowedExecutorName: token.executorName }
      });
      store.addAuditLog(log);
      return {
        success: false,
        errorCode: ErrorCodes.PERMISSION_DENIED,
        errorMessage: '无权限执行此令牌',
        data: { allowedExecutor: token.executorId, allowedExecutorName: token.executorName }
      };
    }
    if (requestScope && requestScope.length > 0) {
      const hasScopeViolation = requestScope.some(s => !token.scope.includes(s));
      if (hasScopeViolation) {
        const log = new AuditLog({
          tokenId,
          action: AuditAction.VERIFY,
          operatorId,
          operatorName,
          success: false,
          errorCode: ErrorCodes.SCOPE_VIOLATION,
          errorMessage: '超出令牌权限范围',
          details: { allowedScope: token.scope, requestScope }
        });
        store.addAuditLog(log);
        return {
          success: false,
          errorCode: ErrorCodes.SCOPE_VIOLATION,
          errorMessage: '超出令牌权限范围',
          data: { allowedScope: token.scope, requestScope }
        };
      }
    }
    const log = new AuditLog({
      tokenId,
      action: AuditAction.VERIFY,
      operatorId,
      operatorName,
      success: true,
      details: { status: token.status, scope: token.scope }
    });
    store.addAuditLog(log);
    return { success: true, data: store.tokenToResponse(token) };
  }

  executeToken(tokenId, operatorId, operatorName, requestScope = null) {
    const verifyResult = this.verifyToken(tokenId, operatorId, operatorName, requestScope);
    if (!verifyResult.success) {
      const errorLog = new AuditLog({
        tokenId,
        action: AuditAction.EXECUTE,
        operatorId,
        operatorName,
        success: false,
        errorCode: verifyResult.errorCode,
        errorMessage: verifyResult.errorMessage,
        details: verifyResult.data
      });
      store.addAuditLog(errorLog);
      return verifyResult;
    }
    const token = store.getToken(tokenId);
    try {
      token.execute();
      store.saveToken(token);
      const log = new AuditLog({
        tokenId,
        action: AuditAction.EXECUTE,
        operatorId,
        operatorName,
        success: true,
        details: { rollbackAction: token.rollbackAction, scope: token.scope }
      });
      store.addAuditLog(log);
      return { success: true, data: store.tokenToResponse(token) };
    } catch (error) {
      const errorLog = new AuditLog({
        tokenId,
        action: AuditAction.EXECUTE,
        operatorId,
        operatorName,
        success: false,
        errorCode: ErrorCodes.INVALID_PARAMS,
        errorMessage: error.message
      });
      store.addAuditLog(errorLog);
      return {
        success: false,
        errorCode: ErrorCodes.INVALID_PARAMS,
        errorMessage: error.message
      };
    }
  }

  revokeToken(tokenId, reason, operatorId, operatorName) {
    const token = store.getToken(tokenId);
    if (!token) {
      const log = new AuditLog({
        tokenId,
        action: AuditAction.REVOKE,
        operatorId,
        operatorName,
        success: false,
        errorCode: ErrorCodes.TOKEN_NOT_FOUND,
        errorMessage: '令牌不存在'
      });
      store.addAuditLog(log);
      return {
        success: false,
        errorCode: ErrorCodes.TOKEN_NOT_FOUND,
        errorMessage: '令牌不存在'
      };
    }
    if (token.status === TokenStatus.REVOKED) {
      const log = new AuditLog({
        tokenId,
        action: AuditAction.REVOKE,
        operatorId,
        operatorName,
        success: false,
        errorCode: ErrorCodes.TOKEN_ALREADY_REVOKED,
        errorMessage: '令牌已作废',
        details: { revokeReason: token.revokeReason, revokedAt: token.revokedAt }
      });
      store.addAuditLog(log);
      return {
        success: false,
        errorCode: ErrorCodes.TOKEN_ALREADY_REVOKED,
        errorMessage: '令牌已作废',
        data: {
          revokeReason: token.revokeReason,
          revokedAt: token.revokedAt,
          revokedByName: token.revokedByName
        }
      };
    }
    if (token.issuerId !== operatorId) {
      const log = new AuditLog({
        tokenId,
        action: AuditAction.REVOKE,
        operatorId,
        operatorName,
        success: false,
        errorCode: ErrorCodes.PERMISSION_DENIED,
        errorMessage: '只有签发人可以作废令牌',
        details: { issuerId: token.issuerId, issuerName: token.issuerName }
      });
      store.addAuditLog(log);
      return {
        success: false,
        errorCode: ErrorCodes.PERMISSION_DENIED,
        errorMessage: '只有签发人可以作废令牌',
        data: { issuerId: token.issuerId, issuerName: token.issuerName }
      };
    }
    token.revoke(reason, operatorId, operatorName);
    store.saveToken(token);
    const log = new AuditLog({
      tokenId,
      action: AuditAction.REVOKE,
      operatorId,
      operatorName,
      success: true,
      details: { revokeReason: reason }
    });
    store.addAuditLog(log);
    return { success: true, data: store.tokenToResponse(token) };
  }

  getTokenAudit(tokenId) {
    const result = store.getTokenAuditChain(tokenId);
    if (!result.token) {
      return {
        success: false,
        errorCode: ErrorCodes.TOKEN_NOT_FOUND,
        errorMessage: '令牌不存在'
      };
    }
    return { success: true, data: result };
  }

  getAuditByOperator(operatorId) {
    const logs = store.getAuditLogsByOperator(operatorId);
    return { success: true, data: logs.map(log => log.toJSON()) };
  }

  getAllAudit() {
    const logs = store.getAllAuditLogs();
    return { success: true, data: logs.map(log => log.toJSON()) };
  }

  getTokensByBatch(batchId) {
    const tokens = store.findTokensByBatch(batchId);
    return { success: true, data: tokens.map(t => store.tokenToResponse(t)) };
  }
}

const tokenService = new TokenService();

module.exports = { tokenService, ErrorCodes };
