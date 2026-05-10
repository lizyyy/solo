import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database';
import { userService } from './userService';
import { collectionService } from './collectionService';
import { riskCheckService } from './riskCheckService';
import { auditService } from './auditService';
import {
  TransferRecord,
  TransferStatus,
  TransferHistory,
  RiskLevel,
  CollectionStatus,
  RiskCheckResult,
} from '../types';

export interface CreateTransferRequest {
  collectionId: string;
  fromUserId: string;
  toUserId: string;
  requestId?: string;
}

export interface TransferDetail {
  transfer: TransferRecord;
  history: TransferHistory[];
}

export class TransferService {
  createTransfer(req: CreateTransferRequest): TransferRecord {
    const db = getDatabase();
    const now = Date.now();
    const requestId = req.requestId || uuidv4();

    const pendingTransfers = Array.from(db.transferRecords.values()).filter(
      (t) => t.collectionId === req.collectionId && t.status === TransferStatus.PENDING
    );

    if (pendingTransfers.length > 0) {
      throw new Error('该藏品已有待处理的转赠请求');
    }

    const collection = collectionService.getCollection(req.collectionId);
    if (!collection) {
      throw new Error('藏品不存在');
    }

    const fromUser = userService.getUser(req.fromUserId);
    if (!fromUser) {
      throw new Error('转出用户不存在');
    }

    const toUser = userService.getUser(req.toUserId);
    if (!toUser) {
      throw new Error('转入用户不存在');
    }

    const frequencyStats = this.getUserTransferFrequency(req.fromUserId, now);

    const checkResults = riskCheckService.aggregateResults([
      riskCheckService.checkSelfTransfer(req.fromUserId, req.toUserId),
      riskCheckService.checkOwnership(collection.ownerId, req.fromUserId),
      riskCheckService.checkVerification(fromUser.isVerified, toUser.isVerified),
      riskCheckService.checkCoolDown(collection.lastTransferTime, now),
      riskCheckService.checkFrequency(
        frequencyStats.lastHourCount,
        frequencyStats.lastDayCount
      ),
      riskCheckService.checkFrozen(
        fromUser.isFrozen,
        collection.status === CollectionStatus.FROZEN
      ),
    ]);

    const transferStatus = checkResults.passed
      ? TransferStatus.PENDING
      : TransferStatus.REJECTED;

    const transfer: TransferRecord = {
      id: uuidv4(),
      collectionId: req.collectionId,
      fromUserId: req.fromUserId,
      toUserId: req.toUserId,
      status: transferStatus,
      riskLevel: checkResults.riskLevel,
      riskReasons: checkResults.reasons,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    db.transferRecords.set(transfer.id, transfer);

    this.addHistory(
      transfer.id,
      transferStatus,
      'create',
      req.fromUserId,
      'user',
      now,
      JSON.stringify({ riskCheck: checkResults })
    );

    auditService.logAudit(
      checkResults.passed ? 'transfer.create.success' : 'transfer.create.rejected',
      req.fromUserId,
      'user',
      'transfer',
      transfer.id,
      JSON.stringify({}),
      JSON.stringify({ status: transferStatus, riskReasons: checkResults.reasons }),
      requestId
    );

    if (!checkResults.passed) {
      const error = new Error(checkResults.reasons.join('; '));
      (error as any).riskCheck = checkResults;
      throw error;
    }

    return transfer;
  }

  approveTransfer(transferId: string, operatorId: string): TransferRecord {
    const db = getDatabase();
    const now = Date.now();
    const requestId = uuidv4();

    const transfer = this.getTransfer(transferId);
    if (!transfer) {
      throw new Error('转赠记录不存在');
    }

    if (transfer.status !== TransferStatus.PENDING) {
      throw new Error('只有待处理的转赠可以确认');
    }

    collectionService.updateOwner(transfer.collectionId, transfer.toUserId, now);

    const updated: TransferRecord = {
      ...transfer,
      status: TransferStatus.COMPLETED,
      updatedAt: now,
      completedAt: now,
    };
    db.transferRecords.set(transferId, updated);

    this.addHistory(
      transferId,
      TransferStatus.COMPLETED,
      'approve',
      operatorId,
      'user',
      now,
      JSON.stringify({})
    );

    auditService.logAudit(
      'transfer.approve',
      operatorId,
      'user',
      'transfer',
      transferId,
      JSON.stringify({ status: TransferStatus.PENDING }),
      JSON.stringify({ status: TransferStatus.COMPLETED }),
      requestId
    );

    return updated;
  }

  cancelTransfer(transferId: string, operatorId: string): TransferRecord {
    const db = getDatabase();
    const now = Date.now();
    const requestId = uuidv4();

    const transfer = this.getTransfer(transferId);
    if (!transfer) {
      throw new Error('转赠记录不存在');
    }

    if (transfer.status !== TransferStatus.PENDING) {
      throw new Error('只有待处理的转赠可以取消');
    }

    if (transfer.fromUserId !== operatorId) {
      throw new Error('只有转出方可以取消转赠');
    }

    const updated: TransferRecord = {
      ...transfer,
      status: TransferStatus.CANCELED,
      updatedAt: now,
    };
    db.transferRecords.set(transferId, updated);

    this.addHistory(
      transferId,
      TransferStatus.CANCELED,
      'cancel',
      operatorId,
      'user',
      now,
      JSON.stringify({})
    );

    auditService.logAudit(
      'transfer.cancel',
      operatorId,
      'user',
      'transfer',
      transferId,
      JSON.stringify({ status: TransferStatus.PENDING }),
      JSON.stringify({ status: TransferStatus.CANCELED }),
      requestId
    );

    return updated;
  }

  revokeTransfer(transferId: string, adminId: string, reason: string): TransferRecord {
    const db = getDatabase();
    const now = Date.now();
    const requestId = uuidv4();

    const transfer = this.getTransfer(transferId);
    if (!transfer) {
      throw new Error('转赠记录不存在');
    }

    if (transfer.status !== TransferStatus.COMPLETED) {
      throw new Error('只有已完成的转赠可以撤销');
    }

    const collection = collectionService.getCollection(transfer.collectionId);
    if (!collection) {
      throw new Error('藏品不存在');
    }

    collectionService.updateOwner(
      transfer.collectionId,
      transfer.fromUserId,
      now
    );

    const updated: TransferRecord = {
      ...transfer,
      status: TransferStatus.REVOKED,
      updatedAt: now,
    };
    db.transferRecords.set(transferId, updated);

    this.addHistory(
      transferId,
      TransferStatus.REVOKED,
      'revoke',
      adminId,
      'admin',
      now,
      JSON.stringify({ reason })
    );

    auditService.logAudit(
      'transfer.revoke',
      adminId,
      'admin',
      'transfer',
      transferId,
      JSON.stringify({ status: TransferStatus.COMPLETED, ownerId: transfer.toUserId }),
      JSON.stringify({ status: TransferStatus.REVOKED, ownerId: transfer.fromUserId, reason }),
      requestId
    );

    return updated;
  }

  manualCorrectTransfer(
    transferId: string,
    newStatus: TransferStatus,
    adminId: string,
    reason: string
  ): TransferRecord {
    const db = getDatabase();
    const now = Date.now();
    const requestId = uuidv4();

    const transfer = this.getTransfer(transferId);
    if (!transfer) {
      throw new Error('转赠记录不存在');
    }

    const oldStatus = transfer.status;

    const updated: TransferRecord = {
      ...transfer,
      status: newStatus,
      updatedAt: now,
    };
    db.transferRecords.set(transferId, updated);

    this.addHistory(
      transferId,
      newStatus,
      'manual_correct',
      adminId,
      'admin',
      now,
      JSON.stringify({ reason, oldStatus, newStatus })
    );

    auditService.logAudit(
      'transfer.manual_correct',
      adminId,
      'admin',
      'transfer',
      transferId,
      JSON.stringify({ status: oldStatus }),
      JSON.stringify({ status: newStatus, reason }),
      requestId
    );

    return updated;
  }

  getTransfer(id: string): TransferRecord | null {
    const db = getDatabase();
    return db.transferRecords.get(id) || null;
  }

  getTransferDetail(id: string): TransferDetail | null {
    const transfer = this.getTransfer(id);
    if (!transfer) return null;

    const history = this.getTransferHistory(id);
    return { transfer, history };
  }

  getTransferHistory(transferId: string): TransferHistory[] {
    const db = getDatabase();
    const history = db.transferHistories.get(transferId) || [];
    return [...history].sort((a, b) => a.timestamp - b.timestamp);
  }

  getTransfersByUser(userId: string, status?: TransferStatus): TransferRecord[] {
    const db = getDatabase();
    let transfers = Array.from(db.transferRecords.values()).filter(
      (t) => t.fromUserId === userId || t.toUserId === userId
    );

    if (status) {
      transfers = transfers.filter((t) => t.status === status);
    }

    return transfers.sort((a, b) => b.createdAt - a.createdAt);
  }

  getTransfersByCollection(collectionId: string): TransferRecord[] {
    const db = getDatabase();
    return Array.from(db.transferRecords.values())
      .filter((t) => t.collectionId === collectionId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getUserTransferHistoryAtTime(
    userId: string,
    timestamp: number
  ): TransferHistory[] {
    const db = getDatabase();
    const allHistories: TransferHistory[] = [];

    for (const histories of db.transferHistories.values()) {
      const filtered = histories.filter(
        (h) =>
          (h.fromUserId === userId || h.toUserId === userId) &&
          h.timestamp <= timestamp
      );
      allHistories.push(...filtered);
    }

    return allHistories.sort((a, b) => b.timestamp - a.timestamp);
  }

  getUserTransferCountInRange(
    userId: string,
    startTime: number,
    endTime: number
  ): number {
    const db = getDatabase();
    return Array.from(db.transferRecords.values()).filter(
      (t) =>
        t.fromUserId === userId &&
        t.status === TransferStatus.COMPLETED &&
        t.createdAt >= startTime &&
        t.createdAt <= endTime
    ).length;
  }

  private getUserTransferFrequency(userId: string, currentTime: number) {
    const oneHourAgo = currentTime - 60 * 60 * 1000;
    const oneDayAgo = currentTime - 24 * 60 * 60 * 1000;

    return {
      lastHourCount: this.getUserTransferCountInRange(
        userId,
        oneHourAgo,
        currentTime
      ),
      lastDayCount: this.getUserTransferCountInRange(
        userId,
        oneDayAgo,
        currentTime
      ),
    };
  }

  private addHistory(
    transferId: string,
    statusAtTime: TransferStatus,
    eventType: TransferHistory['eventType'],
    operatorId: string | null,
    operatorType: TransferHistory['operatorType'],
    timestamp: number,
    metadata: string
  ): void {
    const db = getDatabase();
    const transfer = this.getTransfer(transferId);
    if (!transfer) return;

    const history: TransferHistory = {
      id: uuidv4(),
      transferId,
      fromUserId: transfer.fromUserId,
      toUserId: transfer.toUserId,
      collectionId: transfer.collectionId,
      statusAtTime,
      eventType,
      operatorId,
      operatorType,
      timestamp,
      metadata,
    };

    const existingHistories = db.transferHistories.get(transferId) || [];
    existingHistories.push(history);
    db.transferHistories.set(transferId, existingHistories);
  }
}

export const transferService = new TransferService();
