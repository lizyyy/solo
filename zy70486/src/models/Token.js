const { v4: uuidv4 } = require('uuid');

const TokenStatus = {
  ACTIVE: 'active',
  EXECUTED: 'executed',
  EXPIRED: 'expired',
  REVOKED: 'revoked'
};

class Token {
  constructor({
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
    this.tokenId = uuidv4();
    this.batchId = batchId;
    this.issuerId = issuerId;
    this.issuerName = issuerName;
    this.executorId = executorId;
    this.executorName = executorName;
    this.createdAt = new Date();
    this.expireAt = new Date(expireAt);
    this.rollbackAction = rollbackAction;
    this.scope = scope;
    this.metadata = metadata;
    this.status = TokenStatus.ACTIVE;
    this.executedAt = null;
    this.revokedAt = null;
    this.revokeReason = null;
    this.revokedBy = null;
    this.revokedByName = null;
  }

  isExpired() {
    return new Date() > this.expireAt;
  }

  canExecute(userId) {
    if (this.status !== TokenStatus.ACTIVE) {
      return false;
    }
    if (this.isExpired()) {
      return false;
    }
    if (this.executorId && this.executorId !== userId) {
      return false;
    }
    return true;
  }

  execute() {
    if (this.status !== TokenStatus.ACTIVE) {
      throw new Error(`令牌状态异常: ${this.status}`);
    }
    if (this.isExpired()) {
      throw new Error('令牌已过期');
    }
    this.status = TokenStatus.EXECUTED;
    this.executedAt = new Date();
    return this;
  }

  revoke(reason, revokedBy, revokedByName) {
    if (this.status === TokenStatus.REVOKED) {
      throw new Error('令牌已作废');
    }
    this.status = TokenStatus.REVOKED;
    this.revokedAt = new Date();
    this.revokeReason = reason;
    this.revokedBy = revokedBy;
    this.revokedByName = revokedByName;
    return this;
  }

  checkExpired() {
    if (this.status === TokenStatus.ACTIVE && this.isExpired()) {
      this.status = TokenStatus.EXPIRED;
    }
    return this;
  }
}

module.exports = { Token, TokenStatus };
