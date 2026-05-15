const { Token, TokenStatus } = require('../models/Token');
const { AuditLog, AuditAction } = require('../models/AuditLog');

class DataStore {
  constructor() {
    this.tokens = new Map();
    this.auditLogs = [];
  }

  saveToken(token) {
    this.tokens.set(token.tokenId, token);
    return token;
  }

  getToken(tokenId) {
    const token = this.tokens.get(tokenId);
    if (token) {
      token.checkExpired();
    }
    return token;
  }

  findTokensByBatch(batchId) {
    const tokens = [];
    for (const token of this.tokens.values()) {
      token.checkExpired();
      if (token.batchId === batchId) {
        tokens.push(token);
      }
    }
    return tokens;
  }

  findTokensByIssuer(issuerId) {
    const tokens = [];
    for (const token of this.tokens.values()) {
      token.checkExpired();
      if (token.issuerId === issuerId) {
        tokens.push(token);
      }
    }
    return tokens;
  }

  addAuditLog(log) {
    this.auditLogs.push(log);
    return log;
  }

  getAuditLogsByToken(tokenId) {
    return this.auditLogs
      .filter(log => log.tokenId === tokenId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getAuditLogsByOperator(operatorId) {
    return this.auditLogs
      .filter(log => log.operatorId === operatorId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getAllAuditLogs() {
    return [...this.auditLogs].sort((a, b) => b.timestamp - a.timestamp);
  }

  getTokenAuditChain(tokenId) {
    const token = this.getToken(tokenId);
    const logs = this.getAuditLogsByToken(tokenId);
    return {
      token: token ? this.tokenToResponse(token) : null,
      auditChain: logs.map(log => log.toJSON())
    };
  }

  tokenToResponse(token) {
    return {
      tokenId: token.tokenId,
      batchId: token.batchId,
      issuerId: token.issuerId,
      issuerName: token.issuerName,
      executorId: token.executorId,
      executorName: token.executorName,
      createdAt: token.createdAt,
      expireAt: token.expireAt,
      rollbackAction: token.rollbackAction,
      scope: token.scope,
      metadata: token.metadata,
      status: token.status,
      executedAt: token.executedAt,
      revokedAt: token.revokedAt,
      revokeReason: token.revokeReason,
      revokedBy: token.revokedBy,
      revokedByName: token.revokedByName
    };
  }
}

const store = new DataStore();

module.exports = { store, Token, TokenStatus, AuditLog, AuditAction };
