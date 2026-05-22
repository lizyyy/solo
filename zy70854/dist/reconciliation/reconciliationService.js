"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconciliationService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const matchingEngine_1 = require("../matching/matchingEngine");
const reviewService_1 = require("../review/reviewService");
class ReconciliationService {
    constructor() {
        this.batches = new Map();
        this.batchMatches = new Map();
        this.batchPassengerItems = new Map();
        this.batchDriverItems = new Map();
        this.batchWarehouseItems = new Map();
        this.batchRouteSchedules = new Map();
        this.matchingEngine = new matchingEngine_1.MatchingEngine();
        this.reviewService = new reviewService_1.ReviewService();
    }
    createBatch(name, createdBy, passengerItems, driverItems, warehouseItems, routeSchedules = []) {
        const batchId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const batch = {
            id: batchId,
            name,
            createdAt: now,
            createdBy,
            status: 'processing',
            passengerCount: passengerItems.length,
            driverCount: driverItems.length,
            warehouseCount: warehouseItems.length,
            matchedCount: 0,
            unmatchedCount: 0,
            reviewingCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            overdueCount: 0
        };
        this.batches.set(batchId, batch);
        this.batchPassengerItems.set(batchId, passengerItems);
        this.batchDriverItems.set(batchId, driverItems);
        this.batchWarehouseItems.set(batchId, warehouseItems);
        this.batchRouteSchedules.set(batchId, routeSchedules);
        this.batchMatches.set(batchId, []);
        return batch;
    }
    runMatching(batchId) {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error('对账批次不存在');
        }
        const passengerItems = this.batchPassengerItems.get(batchId) || [];
        const driverItems = this.batchDriverItems.get(batchId) || [];
        const warehouseItems = this.batchWarehouseItems.get(batchId) || [];
        const routeSchedules = this.batchRouteSchedules.get(batchId) || [];
        let matches = this.matchingEngine.matchPassengerToDriver(passengerItems, driverItems, routeSchedules);
        matches = this.matchingEngine.matchDriverToWarehouse(driverItems, warehouseItems, matches);
        matches = matches.map(match => ({
            ...match,
            batchId
        }));
        matches = this.matchingEngine.updateOverdueStatus(matches, [...passengerItems, ...driverItems, ...warehouseItems]);
        this.batchMatches.set(batchId, matches);
        this.updateBatchStatistics(batchId);
        return matches;
    }
    recalculateMatching(batchId) {
        return this.runMatching(batchId);
    }
    getBatch(batchId) {
        return this.batches.get(batchId);
    }
    getBatchMatches(batchId) {
        return this.batchMatches.get(batchId) || [];
    }
    getMatchDetail(batchId, matchId) {
        const matches = this.batchMatches.get(batchId) || [];
        const match = matches.find(m => m.id === matchId);
        const passengerItems = this.batchPassengerItems.get(batchId) || [];
        const driverItems = this.batchDriverItems.get(batchId) || [];
        const warehouseItems = this.batchWarehouseItems.get(batchId) || [];
        return {
            match,
            passengerItem: passengerItems.find(p => p.id === match?.passengerItemId),
            driverItem: driverItems.find(d => d.id === match?.driverItemId),
            warehouseItem: warehouseItems.find(w => w.id === match?.warehouseItemId),
            reviewHistory: this.reviewService.getReviewHistory(matchId)
        };
    }
    updateMatchStatus(batchId, matchId, status, reviewer, reason) {
        const matches = this.batchMatches.get(batchId);
        if (!matches)
            return null;
        const matchIndex = matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1)
            return null;
        const match = matches[matchIndex];
        const previousStatus = match.status;
        match.status = status;
        match.updatedAt = new Date().toISOString();
        matches[matchIndex] = match;
        this.updateBatchStatistics(batchId);
        return match;
    }
    approveMatch(batchId, matchId, reviewer, reason) {
        const matches = this.batchMatches.get(batchId);
        if (!matches)
            return null;
        const matchIndex = matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1)
            return null;
        const match = { ...matches[matchIndex] };
        const result = this.reviewService.approveMatch(match, reviewer, reason);
        matches[matchIndex] = result.match;
        this.updateBatchStatistics(batchId);
        return result.match;
    }
    rejectMatch(batchId, matchId, reviewer, reason) {
        const matches = this.batchMatches.get(batchId);
        if (!matches)
            return null;
        const matchIndex = matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1)
            return null;
        const match = { ...matches[matchIndex] };
        const result = this.reviewService.rejectMatch(match, reviewer, reason);
        matches[matchIndex] = result.match;
        this.updateBatchStatistics(batchId);
        return result.match;
    }
    manualMatch(batchId, matchId, reviewer, reason, targetIds) {
        const matches = this.batchMatches.get(batchId);
        if (!matches)
            return null;
        const matchIndex = matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1)
            return null;
        const match = { ...matches[matchIndex] };
        const result = this.reviewService.manualMatch(match, reviewer, reason, targetIds);
        matches[matchIndex] = result.match;
        this.updateBatchStatistics(batchId);
        return result.match;
    }
    unmatch(batchId, matchId, reviewer, reason) {
        const matches = this.batchMatches.get(batchId);
        if (!matches)
            return null;
        const matchIndex = matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1)
            return null;
        const match = { ...matches[matchIndex] };
        const result = this.reviewService.unmatch(match, reviewer, reason);
        matches[matchIndex] = result.match;
        this.updateBatchStatistics(batchId);
        return result.match;
    }
    requestMoreInfo(batchId, matchId, reviewer, reason) {
        const matches = this.batchMatches.get(batchId);
        if (!matches)
            return null;
        const matchIndex = matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1)
            return null;
        const match = { ...matches[matchIndex] };
        const result = this.reviewService.requestMoreInfo(match, reviewer, reason);
        matches[matchIndex] = result.match;
        this.updateBatchStatistics(batchId);
        return result.match;
    }
    updateMatchInBatch(batchId, updatedMatch) {
        const matches = this.batchMatches.get(batchId);
        if (!matches)
            return;
        const matchIndex = matches.findIndex(m => m.id === updatedMatch.id);
        if (matchIndex !== -1) {
            matches[matchIndex] = updatedMatch;
        }
    }
    updateBatchStatistics(batchId) {
        const batch = this.batches.get(batchId);
        const matches = this.batchMatches.get(batchId);
        if (!batch || !matches)
            return;
        let matchedCount = 0;
        let unmatchedCount = 0;
        let reviewingCount = 0;
        let approvedCount = 0;
        let rejectedCount = 0;
        let overdueCount = 0;
        for (const match of matches) {
            if (match.isOverdue) {
                overdueCount++;
            }
            switch (match.status) {
                case types_1.ItemStatus.MATCHED:
                    matchedCount++;
                    break;
                case types_1.ItemStatus.UNMATCHED:
                    unmatchedCount++;
                    break;
                case types_1.ItemStatus.REVIEWING:
                    reviewingCount++;
                    break;
                case types_1.ItemStatus.APPROVED:
                    approvedCount++;
                    break;
                case types_1.ItemStatus.REJECTED:
                    rejectedCount++;
                    break;
            }
        }
        batch.matchedCount = matchedCount;
        batch.unmatchedCount = unmatchedCount;
        batch.reviewingCount = reviewingCount;
        batch.approvedCount = approvedCount;
        batch.rejectedCount = rejectedCount;
        batch.overdueCount = overdueCount;
    }
    completeBatch(batchId) {
        const batch = this.batches.get(batchId);
        if (!batch)
            return null;
        batch.status = 'completed';
        return batch;
    }
    getAllBatches() {
        return Array.from(this.batches.values());
    }
    generateReport(batchId) {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error('对账批次不存在');
        }
        const matches = this.batchMatches.get(batchId) || [];
        const passengerItems = this.batchPassengerItems.get(batchId) || [];
        const driverItems = this.batchDriverItems.get(batchId) || [];
        const warehouseItems = this.batchWarehouseItems.get(batchId) || [];
        const totalRecords = passengerItems.length + driverItems.length + warehouseItems.length;
        const matchRate = totalRecords > 0
            ? (batch.matchedCount + batch.approvedCount) / totalRecords
            : 0;
        const differenceBreakdown = this.calculateDifferenceBreakdown(matches);
        const report = {
            batchId,
            generatedAt: new Date().toISOString(),
            summary: {
                totalPassengerReports: passengerItems.length,
                totalDriverTurnIns: driverItems.length,
                totalWarehouseReceipts: warehouseItems.length,
                matched: batch.matchedCount,
                unmatched: batch.unmatchedCount,
                reviewing: batch.reviewingCount,
                approved: batch.approvedCount,
                rejected: batch.rejectedCount,
                overdue: batch.overdueCount,
                matchRate
            },
            details: matches,
            reviewHistory: [],
            differenceBreakdown
        };
        return report;
    }
    calculateDifferenceBreakdown(matches) {
        const counts = {
            [types_1.DifferenceType.SAME_NAME]: 0,
            [types_1.DifferenceType.OVERDUE]: 0,
            [types_1.DifferenceType.SENSITIVE_INFO]: 0,
            [types_1.DifferenceType.DESCRIPTION_MISMATCH]: 0,
            [types_1.DifferenceType.TIME_MISMATCH]: 0,
            [types_1.DifferenceType.LOCATION_MISMATCH]: 0,
            [types_1.DifferenceType.DUPLICATE]: 0
        };
        for (const match of matches) {
            for (const diff of match.differences) {
                counts[diff]++;
            }
        }
        const descriptions = {
            [types_1.DifferenceType.SAME_NAME]: '同名物品，需核对详细描述',
            [types_1.DifferenceType.OVERDUE]: '逾期未认领物品',
            [types_1.DifferenceType.SENSITIVE_INFO]: '包含敏感信息，需注意隐私',
            [types_1.DifferenceType.DESCRIPTION_MISMATCH]: '描述不匹配',
            [types_1.DifferenceType.TIME_MISMATCH]: '时间不匹配',
            [types_1.DifferenceType.LOCATION_MISMATCH]: '地点/线路不匹配',
            [types_1.DifferenceType.DUPLICATE]: '重复记录'
        };
        return Object.entries(counts)
            .filter(([, count]) => count > 0)
            .map(([type, count]) => ({
            type: type,
            count,
            description: descriptions[type]
        }))
            .sort((a, b) => b.count - a.count);
    }
    getBatchItems(batchId) {
        return {
            passengerItems: this.batchPassengerItems.get(batchId) || [],
            driverItems: this.batchDriverItems.get(batchId) || [],
            warehouseItems: this.batchWarehouseItems.get(batchId) || []
        };
    }
    searchMatches(batchId, filters) {
        let matches = this.batchMatches.get(batchId) || [];
        if (filters.status) {
            matches = matches.filter(m => m.status === filters.status);
        }
        if (filters.hasDifference) {
            matches = matches.filter(m => m.differences.includes(filters.hasDifference));
        }
        if (filters.isOverdue !== undefined) {
            matches = matches.filter(m => m.isOverdue === filters.isOverdue);
        }
        return matches;
    }
}
exports.ReconciliationService = ReconciliationService;
