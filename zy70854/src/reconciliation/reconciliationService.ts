import { v4 as uuidv4 } from 'uuid';
import {
  ReconciliationBatch,
  MatchRecord,
  PassengerLostItem,
  DriverTurnedInItem,
  WarehouseItem,
  RouteSchedule,
  ItemStatus,
  ReportData,
  DifferenceType
} from '../types';
import { MatchingEngine } from '../matching/matchingEngine';
import { ReviewService } from '../review/reviewService';

export class ReconciliationService {
  private batches: Map<string, ReconciliationBatch> = new Map();
  private batchMatches: Map<string, MatchRecord[]> = new Map();
  private batchPassengerItems: Map<string, PassengerLostItem[]> = new Map();
  private batchDriverItems: Map<string, DriverTurnedInItem[]> = new Map();
  private batchWarehouseItems: Map<string, WarehouseItem[]> = new Map();
  private batchRouteSchedules: Map<string, RouteSchedule[]> = new Map();

  private matchingEngine: MatchingEngine;
  private reviewService: ReviewService;

  constructor() {
    this.matchingEngine = new MatchingEngine();
    this.reviewService = new ReviewService();
  }

  createBatch(
    name: string,
    createdBy: string,
    passengerItems: PassengerLostItem[],
    driverItems: DriverTurnedInItem[],
    warehouseItems: WarehouseItem[],
    routeSchedules: RouteSchedule[] = []
  ): ReconciliationBatch {
    const batchId = uuidv4();
    const now = new Date().toISOString();

    const batch: ReconciliationBatch = {
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

  runMatching(batchId: string): MatchRecord[] {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error('对账批次不存在');
    }

    const passengerItems = this.batchPassengerItems.get(batchId) || [];
    const driverItems = this.batchDriverItems.get(batchId) || [];
    const warehouseItems = this.batchWarehouseItems.get(batchId) || [];
    const routeSchedules = this.batchRouteSchedules.get(batchId) || [];

    let matches = this.matchingEngine.matchPassengerToDriver(
      passengerItems,
      driverItems,
      routeSchedules
    );

    matches = this.matchingEngine.matchDriverToWarehouse(
      driverItems,
      warehouseItems,
      matches
    );

    matches = matches.map(match => ({
      ...match,
      batchId
    }));

    matches = this.matchingEngine.updateOverdueStatus(
      matches,
      [...passengerItems, ...driverItems, ...warehouseItems]
    );

    this.batchMatches.set(batchId, matches);
    this.updateBatchStatistics(batchId);

    return matches;
  }

  recalculateMatching(batchId: string): MatchRecord[] {
    return this.runMatching(batchId);
  }

  getBatch(batchId: string): ReconciliationBatch | undefined {
    return this.batches.get(batchId);
  }

  getBatchMatches(batchId: string): MatchRecord[] {
    return this.batchMatches.get(batchId) || [];
  }

  getMatchDetail(batchId: string, matchId: string): {
    match: MatchRecord | undefined;
    passengerItem: PassengerLostItem | undefined;
    driverItem: DriverTurnedInItem | undefined;
    warehouseItem: WarehouseItem | undefined;
    reviewHistory: any[];
  } {
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

  updateMatchStatus(
    batchId: string,
    matchId: string,
    status: ItemStatus,
    reviewer: string,
    reason: string
  ): MatchRecord | null {
    const matches = this.batchMatches.get(batchId);
    if (!matches) return null;

    const matchIndex = matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) return null;

    const match = matches[matchIndex];
    const previousStatus = match.status;
    match.status = status;
    match.updatedAt = new Date().toISOString();

    matches[matchIndex] = match;
    this.updateBatchStatistics(batchId);

    return match;
  }

  approveMatch(batchId: string, matchId: string, reviewer: string, reason: string): MatchRecord | null {
    const result = this.reviewService.approveMatch(matchId, reviewer, reason);
    if (result) {
      this.updateMatchInBatch(batchId, result);
      this.updateBatchStatistics(batchId);
    }
    return result;
  }

  rejectMatch(batchId: string, matchId: string, reviewer: string, reason: string): MatchRecord | null {
    const result = this.reviewService.rejectMatch(matchId, reviewer, reason);
    if (result) {
      this.updateMatchInBatch(batchId, result);
      this.updateBatchStatistics(batchId);
    }
    return result;
  }

  manualMatch(
    batchId: string,
    matchId: string,
    reviewer: string,
    reason: string,
    targetIds: {
      passengerItemId?: string;
      driverItemId?: string;
      warehouseItemId?: string;
    }
  ): MatchRecord | null {
    const result = this.reviewService.manualMatch(matchId, reviewer, reason, targetIds);
    if (result) {
      this.updateMatchInBatch(batchId, result);
      this.updateBatchStatistics(batchId);
    }
    return result;
  }

  unmatch(batchId: string, matchId: string, reviewer: string, reason: string): MatchRecord | null {
    const result = this.reviewService.unmatch(matchId, reviewer, reason);
    if (result) {
      this.updateMatchInBatch(batchId, result);
      this.updateBatchStatistics(batchId);
    }
    return result;
  }

  private updateMatchInBatch(batchId: string, updatedMatch: MatchRecord): void {
    const matches = this.batchMatches.get(batchId);
    if (!matches) return;

    const matchIndex = matches.findIndex(m => m.id === updatedMatch.id);
    if (matchIndex !== -1) {
      matches[matchIndex] = updatedMatch;
    }
  }

  private updateBatchStatistics(batchId: string): void {
    const batch = this.batches.get(batchId);
    const matches = this.batchMatches.get(batchId);

    if (!batch || !matches) return;

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
        case ItemStatus.MATCHED:
          matchedCount++;
          break;
        case ItemStatus.UNMATCHED:
          unmatchedCount++;
          break;
        case ItemStatus.REVIEWING:
          reviewingCount++;
          break;
        case ItemStatus.APPROVED:
          approvedCount++;
          break;
        case ItemStatus.REJECTED:
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

  completeBatch(batchId: string): ReconciliationBatch | null {
    const batch = this.batches.get(batchId);
    if (!batch) return null;

    batch.status = 'completed';
    return batch;
  }

  getAllBatches(): ReconciliationBatch[] {
    return Array.from(this.batches.values());
  }

  generateReport(batchId: string): ReportData {
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

    const report: ReportData = {
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

  private calculateDifferenceBreakdown(matches: MatchRecord[]): {
    type: DifferenceType;
    count: number;
    description: string;
  }[] {
    const counts: Record<DifferenceType, number> = {
      [DifferenceType.SAME_NAME]: 0,
      [DifferenceType.OVERDUE]: 0,
      [DifferenceType.SENSITIVE_INFO]: 0,
      [DifferenceType.DESCRIPTION_MISMATCH]: 0,
      [DifferenceType.TIME_MISMATCH]: 0,
      [DifferenceType.LOCATION_MISMATCH]: 0,
      [DifferenceType.DUPLICATE]: 0
    };

    for (const match of matches) {
      for (const diff of match.differences) {
        counts[diff]++;
      }
    }

    const descriptions: Record<DifferenceType, string> = {
      [DifferenceType.SAME_NAME]: '同名物品，需核对详细描述',
      [DifferenceType.OVERDUE]: '逾期未认领物品',
      [DifferenceType.SENSITIVE_INFO]: '包含敏感信息，需注意隐私',
      [DifferenceType.DESCRIPTION_MISMATCH]: '描述不匹配',
      [DifferenceType.TIME_MISMATCH]: '时间不匹配',
      [DifferenceType.LOCATION_MISMATCH]: '地点/线路不匹配',
      [DifferenceType.DUPLICATE]: '重复记录'
    };

    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({
        type: type as DifferenceType,
        count,
        description: descriptions[type as DifferenceType]
      }))
      .sort((a, b) => b.count - a.count);
  }

  getBatchItems(batchId: string): {
    passengerItems: PassengerLostItem[];
    driverItems: DriverTurnedInItem[];
    warehouseItems: WarehouseItem[];
  } {
    return {
      passengerItems: this.batchPassengerItems.get(batchId) || [],
      driverItems: this.batchDriverItems.get(batchId) || [],
      warehouseItems: this.batchWarehouseItems.get(batchId) || []
    };
  }

  searchMatches(
    batchId: string,
    filters: {
      status?: ItemStatus;
      hasDifference?: DifferenceType;
      isOverdue?: boolean;
      itemName?: string;
    }
  ): MatchRecord[] {
    let matches = this.batchMatches.get(batchId) || [];

    if (filters.status) {
      matches = matches.filter(m => m.status === filters.status);
    }

    if (filters.hasDifference) {
      matches = matches.filter(m => m.differences.includes(filters.hasDifference!));
    }

    if (filters.isOverdue !== undefined) {
      matches = matches.filter(m => m.isOverdue === filters.isOverdue);
    }

    return matches;
  }
}
