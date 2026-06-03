import { AdjustmentRepo } from '../db/repositories/AdjustmentRepo.js';
import { CustodyRepo } from '../db/repositories/CustodyRepo.js';
import type { ChartDataPoint, PieChartData, OverviewStats, AdjustmentStatus } from '../../shared/types.js';

export const ChartService = {
  getOverviewStats(): OverviewStats {
    return AdjustmentRepo.getStats();
  },

  get3DChartData(startDate?: string, endDate?: string): ChartDataPoint[] {
    let adjustments;
    
    if (startDate && endDate) {
      adjustments = AdjustmentRepo.getDateRangeData(startDate, endDate);
    } else {
      adjustments = AdjustmentRepo.findAll();
    }

    const dateMap = new Map<string, ChartDataPoint>();

    for (const adj of adjustments) {
      const existing = dateMap.get(adj.tradeDate);
      
      if (existing) {
        existing.amount += adj.amount;
        existing.count += 1;
        if (adj.hasZeroAmountButReversed) {
          existing.hasFlagged = true;
        }
        existing.adjustmentIds.push(adj.id);
      } else {
        dateMap.set(adj.tradeDate, {
          date: adj.tradeDate,
          amount: adj.amount,
          count: 1,
          hasFlagged: adj.hasZeroAmountButReversed,
          adjustmentIds: [adj.id],
        });
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  },

  getPieChartData(): PieChartData[] {
    const stats = AdjustmentRepo.getStats();
    const adjustments = AdjustmentRepo.findAll();

    const statusCounts = new Map<AdjustmentStatus, number>();
    
    for (const adj of adjustments) {
      const current = statusCounts.get(adj.status) || 0;
      statusCounts.set(adj.status, current + 1);
    }

    const statusConfig: Array<{ status: AdjustmentStatus | 'normal'; name: string; color: string }> = [
      { status: 'imported', name: '正常记录', color: '#10b981' },
      { status: 'pending_custody', name: '待补托管页', color: '#f59e0b' },
      { status: 'pending_review', name: '待风控复核', color: '#ef4444' },
      { status: 'reviewed_normal', name: '已复核正常', color: '#10b981' },
      { status: 'needs_verification', name: '需进一步核实', color: '#f59e0b' },
    ];

    const pieData: PieChartData[] = [];

    for (const config of statusConfig) {
      const count = statusCounts.get(config.status as AdjustmentStatus) || 0;
      if (count > 0) {
        pieData.push({
          name: config.name,
          value: count,
          color: config.color,
          status: config.status as AdjustmentStatus | 'normal',
        });
      }
    }

    return pieData;
  },

  getClickTarget(adjustmentId: string): { type: 'custody' | 'adjustment'; id: string; hasCustody: boolean } {
    const adjustment = AdjustmentRepo.findById(adjustmentId);
    if (!adjustment) {
      return { type: 'adjustment', id: adjustmentId, hasCustody: false };
    }

    if (adjustment.custodyConfirmId) {
      const custody = CustodyRepo.findById(adjustment.custodyConfirmId);
      if (custody) {
        return { type: 'custody', id: custody.id, hasCustody: true };
      }
    }

    return { type: 'adjustment', id: adjustmentId, hasCustody: false };
  },
};
