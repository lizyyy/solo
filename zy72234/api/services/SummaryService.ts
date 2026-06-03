import { AdjustmentRepo } from '../db/repositories/AdjustmentRepo.js';
import { CustodyRepo } from '../db/repositories/CustodyRepo.js';
import { generateSummary } from '../../shared/types.js';
import type { ExecutiveSummaryItem, TailAdjustment, CustodyConfirmation } from '../../shared/types.js';

export const SummaryService = {
  generateForAdjustment(adjustmentId: string): ExecutiveSummaryItem | undefined {
    const adjustment = AdjustmentRepo.findById(adjustmentId);
    if (!adjustment) {
      return undefined;
    }

    const custody = adjustment.custodyConfirmId
      ? CustodyRepo.findById(adjustment.custodyConfirmId)
      : undefined;

    return this.buildSummaryItem(adjustment, custody);
  },

  generateForAll(): ExecutiveSummaryItem[] {
    const adjustments = AdjustmentRepo.findAll();
    const items: ExecutiveSummaryItem[] = [];

    for (const adjustment of adjustments) {
      const custody = adjustment.custodyConfirmId
        ? CustodyRepo.findById(adjustment.custodyConfirmId)
        : undefined;
      
      items.push(this.buildSummaryItem(adjustment, custody));
    }

    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  generateForFlagged(): ExecutiveSummaryItem[] {
    const adjustments = AdjustmentRepo.findFlagged();
    const items: ExecutiveSummaryItem[] = [];

    for (const adjustment of adjustments) {
      const custody = adjustment.custodyConfirmId
        ? CustodyRepo.findById(adjustment.custodyConfirmId)
        : undefined;
      
      items.push(this.buildSummaryItem(adjustment, custody));
    }

    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  buildSummaryItem(
    adjustment: TailAdjustment,
    custody?: CustodyConfirmation
  ): ExecutiveSummaryItem {
    const summary = generateSummary(adjustment, custody);
    const updatedAt = adjustment.reviewTime || adjustment.importTime;

    return {
      adjustmentId: adjustment.id,
      adjustmentNo: adjustment.adjustmentNo,
      tradeDate: adjustment.tradeDate,
      amount: adjustment.amount,
      remark: adjustment.remark,
      status: adjustment.status,
      updatedAt,
      custody,
      ...summary,
    };
  },
};
