"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferService = exports.TransferService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const userService_1 = require("./userService");
const collectionService_1 = require("./collectionService");
const riskCheckService_1 = require("./riskCheckService");
const auditService_1 = require("./auditService");
const types_1 = require("../types");
class TransferService {
    createTransfer(req) {
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        const requestId = req.requestId || (0, uuid_1.v4)();
        const pendingTransfers = Array.from(db.transferRecords.values()).filter((t) => t.collectionId === req.collectionId && t.status === types_1.TransferStatus.PENDING);
        if (pendingTransfers.length > 0) {
            throw new Error('该藏品已有待处理的转赠请求');
        }
        const collection = collectionService_1.collectionService.getCollection(req.collectionId);
        if (!collection) {
            throw new Error('藏品不存在');
        }
        const fromUser = userService_1.userService.getUser(req.fromUserId);
        if (!fromUser) {
            throw new Error('转出用户不存在');
        }
        const toUser = userService_1.userService.getUser(req.toUserId);
        if (!toUser) {
            throw new Error('转入用户不存在');
        }
        const frequencyStats = this.getUserTransferFrequency(req.fromUserId, now);
        const checkResults = riskCheckService_1.riskCheckService.aggregateResults([
            riskCheckService_1.riskCheckService.checkSelfTransfer(req.fromUserId, req.toUserId),
            riskCheckService_1.riskCheckService.checkOwnership(collection.ownerId, req.fromUserId),
            riskCheckService_1.riskCheckService.checkVerification(fromUser.isVerified, toUser.isVerified),
            riskCheckService_1.riskCheckService.checkCoolDown(collection.lastTransferTime, now),
            riskCheckService_1.riskCheckService.checkFrequency(frequencyStats.lastHourCount, frequencyStats.lastDayCount),
            riskCheckService_1.riskCheckService.checkFrozen(fromUser.isFrozen, collection.status === types_1.CollectionStatus.FROZEN),
        ]);
        const transferStatus = checkResults.passed
            ? types_1.TransferStatus.PENDING
            : types_1.TransferStatus.REJECTED;
        const transfer = {
            id: (0, uuid_1.v4)(),
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
        this.addHistory(transfer.id, transferStatus, 'create', req.fromUserId, 'user', now, JSON.stringify({ riskCheck: checkResults }));
        auditService_1.auditService.logAudit(checkResults.passed ? 'transfer.create.success' : 'transfer.create.rejected', req.fromUserId, 'user', 'transfer', transfer.id, JSON.stringify({}), JSON.stringify({ status: transferStatus, riskReasons: checkResults.reasons }), requestId);
        if (!checkResults.passed) {
            const error = new Error(checkResults.reasons.join('; '));
            error.riskCheck = checkResults;
            throw error;
        }
        return transfer;
    }
    approveTransfer(transferId, operatorId) {
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        const requestId = (0, uuid_1.v4)();
        const transfer = this.getTransfer(transferId);
        if (!transfer) {
            throw new Error('转赠记录不存在');
        }
        if (transfer.status !== types_1.TransferStatus.PENDING) {
            throw new Error('只有待处理的转赠可以确认');
        }
        collectionService_1.collectionService.updateOwner(transfer.collectionId, transfer.toUserId, now);
        const updated = {
            ...transfer,
            status: types_1.TransferStatus.COMPLETED,
            updatedAt: now,
            completedAt: now,
        };
        db.transferRecords.set(transferId, updated);
        this.addHistory(transferId, types_1.TransferStatus.COMPLETED, 'approve', operatorId, 'user', now, JSON.stringify({}));
        auditService_1.auditService.logAudit('transfer.approve', operatorId, 'user', 'transfer', transferId, JSON.stringify({ status: types_1.TransferStatus.PENDING }), JSON.stringify({ status: types_1.TransferStatus.COMPLETED }), requestId);
        return updated;
    }
    cancelTransfer(transferId, operatorId) {
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        const requestId = (0, uuid_1.v4)();
        const transfer = this.getTransfer(transferId);
        if (!transfer) {
            throw new Error('转赠记录不存在');
        }
        if (transfer.status !== types_1.TransferStatus.PENDING) {
            throw new Error('只有待处理的转赠可以取消');
        }
        if (transfer.fromUserId !== operatorId) {
            throw new Error('只有转出方可以取消转赠');
        }
        const updated = {
            ...transfer,
            status: types_1.TransferStatus.CANCELED,
            updatedAt: now,
        };
        db.transferRecords.set(transferId, updated);
        this.addHistory(transferId, types_1.TransferStatus.CANCELED, 'cancel', operatorId, 'user', now, JSON.stringify({}));
        auditService_1.auditService.logAudit('transfer.cancel', operatorId, 'user', 'transfer', transferId, JSON.stringify({ status: types_1.TransferStatus.PENDING }), JSON.stringify({ status: types_1.TransferStatus.CANCELED }), requestId);
        return updated;
    }
    revokeTransfer(transferId, adminId, reason) {
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        const requestId = (0, uuid_1.v4)();
        const transfer = this.getTransfer(transferId);
        if (!transfer) {
            throw new Error('转赠记录不存在');
        }
        if (transfer.status !== types_1.TransferStatus.COMPLETED) {
            throw new Error('只有已完成的转赠可以撤销');
        }
        const collection = collectionService_1.collectionService.getCollection(transfer.collectionId);
        if (!collection) {
            throw new Error('藏品不存在');
        }
        collectionService_1.collectionService.updateOwner(transfer.collectionId, transfer.fromUserId, now);
        const updated = {
            ...transfer,
            status: types_1.TransferStatus.REVOKED,
            updatedAt: now,
        };
        db.transferRecords.set(transferId, updated);
        this.addHistory(transferId, types_1.TransferStatus.REVOKED, 'revoke', adminId, 'admin', now, JSON.stringify({ reason }));
        auditService_1.auditService.logAudit('transfer.revoke', adminId, 'admin', 'transfer', transferId, JSON.stringify({ status: types_1.TransferStatus.COMPLETED, ownerId: transfer.toUserId }), JSON.stringify({ status: types_1.TransferStatus.REVOKED, ownerId: transfer.fromUserId, reason }), requestId);
        return updated;
    }
    manualCorrectTransfer(transferId, newStatus, adminId, reason) {
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        const requestId = (0, uuid_1.v4)();
        const transfer = this.getTransfer(transferId);
        if (!transfer) {
            throw new Error('转赠记录不存在');
        }
        const oldStatus = transfer.status;
        const updated = {
            ...transfer,
            status: newStatus,
            updatedAt: now,
        };
        db.transferRecords.set(transferId, updated);
        this.addHistory(transferId, newStatus, 'manual_correct', adminId, 'admin', now, JSON.stringify({ reason, oldStatus, newStatus }));
        auditService_1.auditService.logAudit('transfer.manual_correct', adminId, 'admin', 'transfer', transferId, JSON.stringify({ status: oldStatus }), JSON.stringify({ status: newStatus, reason }), requestId);
        return updated;
    }
    getTransfer(id) {
        const db = (0, database_1.getDatabase)();
        return db.transferRecords.get(id) || null;
    }
    getTransferDetail(id) {
        const transfer = this.getTransfer(id);
        if (!transfer)
            return null;
        const history = this.getTransferHistory(id);
        return { transfer, history };
    }
    getTransferHistory(transferId) {
        const db = (0, database_1.getDatabase)();
        const history = db.transferHistories.get(transferId) || [];
        return [...history].sort((a, b) => a.timestamp - b.timestamp);
    }
    getTransfersByUser(userId, status) {
        const db = (0, database_1.getDatabase)();
        let transfers = Array.from(db.transferRecords.values()).filter((t) => t.fromUserId === userId || t.toUserId === userId);
        if (status) {
            transfers = transfers.filter((t) => t.status === status);
        }
        return transfers.sort((a, b) => b.createdAt - a.createdAt);
    }
    getTransfersByCollection(collectionId) {
        const db = (0, database_1.getDatabase)();
        return Array.from(db.transferRecords.values())
            .filter((t) => t.collectionId === collectionId)
            .sort((a, b) => b.createdAt - a.createdAt);
    }
    getUserTransferHistoryAtTime(userId, timestamp) {
        const db = (0, database_1.getDatabase)();
        const allHistories = [];
        for (const histories of db.transferHistories.values()) {
            const filtered = histories.filter((h) => (h.fromUserId === userId || h.toUserId === userId) &&
                h.timestamp <= timestamp);
            allHistories.push(...filtered);
        }
        return allHistories.sort((a, b) => b.timestamp - a.timestamp);
    }
    getUserTransferCountInRange(userId, startTime, endTime) {
        const db = (0, database_1.getDatabase)();
        return Array.from(db.transferRecords.values()).filter((t) => t.fromUserId === userId &&
            t.status === types_1.TransferStatus.COMPLETED &&
            t.createdAt >= startTime &&
            t.createdAt <= endTime).length;
    }
    getUserTransferFrequency(userId, currentTime) {
        const oneHourAgo = currentTime - 60 * 60 * 1000;
        const oneDayAgo = currentTime - 24 * 60 * 60 * 1000;
        return {
            lastHourCount: this.getUserTransferCountInRange(userId, oneHourAgo, currentTime),
            lastDayCount: this.getUserTransferCountInRange(userId, oneDayAgo, currentTime),
        };
    }
    addHistory(transferId, statusAtTime, eventType, operatorId, operatorType, timestamp, metadata) {
        const db = (0, database_1.getDatabase)();
        const transfer = this.getTransfer(transferId);
        if (!transfer)
            return;
        const history = {
            id: (0, uuid_1.v4)(),
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
exports.TransferService = TransferService;
exports.transferService = new TransferService();
//# sourceMappingURL=transferService.js.map