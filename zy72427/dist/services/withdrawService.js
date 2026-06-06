"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawService = void 0;
const database_1 = require("../database");
const cardService_1 = require("./cardService");
class WithdrawService {
    constructor() {
        this.cardService = new cardService_1.CardService();
    }
    withdrawToPreviousVersion(cardId, withdrawnBy) {
        const card = this.cardService.getCard(cardId);
        if (!card) {
            return { success: false, previousVersion: null, message: '卡片不存在' };
        }
        if (card.currentVersion <= 1) {
            return { success: false, previousVersion: null, message: '已是初始版本，无法撤回' };
        }
        const previousVersion = card.currentVersion - 1;
        const snapshot = this.cardService.getSnapshotByVersion(cardId, previousVersion);
        if (!snapshot) {
            return { success: false, previousVersion: null, message: '未找到上一版本快照' };
        }
        if (card.revenueVersion && card.revenueVersion > 0) {
            const revenues = (0, database_1.findMany)('revenue', (r) => r.cardId === cardId && r.version === card.revenueVersion);
            revenues.forEach((r) => {
                (0, database_1.updateOne)('revenue', (x) => x.id === r.id, { isWithdrawn: true });
            });
        }
        const previousRevenueVersion = snapshot.revenueVersion;
        if (previousRevenueVersion) {
            const revenues = (0, database_1.findMany)('revenue', (r) => r.cardId === cardId && r.version === previousRevenueVersion);
            revenues.forEach((r) => {
                (0, database_1.updateOne)('revenue', (x) => x.id === r.id, { isWithdrawn: false });
            });
        }
        this.cardService.updateCardFields(cardId, {
            status: snapshot.status,
            currentVersion: snapshot.version,
            attendanceBatchId: snapshot.attendanceBatchId,
            ticketBatchId: snapshot.ticketBatchId,
            revenueVersion: snapshot.revenueVersion,
        });
        return {
            success: true,
            previousVersion,
            message: `已撤回至版本 ${previousVersion}，分账明细已恢复`,
        };
    }
    withdrawRevenueVersion(cardId, withdrawnBy) {
        const card = this.cardService.getCard(cardId);
        if (!card) {
            return { success: false, message: '卡片不存在' };
        }
        if (!card.revenueVersion || card.revenueVersion <= 0) {
            return { success: false, message: '暂无分账版本可撤回' };
        }
        const currentRevVersion = card.revenueVersion;
        const revenues = (0, database_1.findMany)('revenue', (r) => r.cardId === cardId && r.version === currentRevVersion);
        revenues.forEach((r) => {
            (0, database_1.updateOne)('revenue', (x) => x.id === r.id, { isWithdrawn: true });
        });
        const previousRevenueVersion = card.revenueVersion - 1;
        if (previousRevenueVersion > 0) {
            const prevRevenues = (0, database_1.findMany)('revenue', (r) => r.cardId === cardId && r.version === previousRevenueVersion);
            prevRevenues.forEach((r) => {
                (0, database_1.updateOne)('revenue', (x) => x.id === r.id, { isWithdrawn: false });
            });
        }
        const newRevenueVersion = previousRevenueVersion > 0 ? previousRevenueVersion : undefined;
        const newStatus = newRevenueVersion ? 'REVENUE_CALCULATED' : 'CONFLICT_RESOLVED';
        this.cardService.updateCardFields(cardId, {
            revenueVersion: newRevenueVersion,
            status: newStatus,
        });
        return {
            success: true,
            message: `已撤回分账版本 ${card.revenueVersion}，分账明细已恢复至上一版`,
        };
    }
    getVersionHistory(cardId) {
        const snapshots = (0, database_1.findMany)('snapshots', (s) => s.cardId === cardId)
            .sort((a, b) => b.version - a.version);
        const activeRevenueVersions = new Set((0, database_1.findMany)('revenue', (r) => r.cardId === cardId && !r.isWithdrawn)
            .map((r) => r.version));
        return snapshots.map((s) => ({
            version: s.version,
            status: s.status,
            createdAt: s.createdAt,
            createdBy: s.createdBy,
            hasRevenue: s.revenueVersion ? activeRevenueVersions.has(s.revenueVersion) : false,
        }));
    }
}
exports.WithdrawService = WithdrawService;
