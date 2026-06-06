import { findMany, updateOne } from '../database';
import { CardService } from './cardService';
import { CardStatus } from '../types';

export class WithdrawService {
  private cardService = new CardService();

  withdrawToPreviousVersion(cardId: string, withdrawnBy: string): {
    success: boolean;
    previousVersion: number | null;
    message: string;
  } {
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
      const revenues = findMany('revenue', (r: any) => r.cardId === cardId && r.version === card.revenueVersion);
      revenues.forEach((r: any) => {
        updateOne('revenue', (x: any) => x.id === r.id, { isWithdrawn: true });
      });
    }

    const previousRevenueVersion = snapshot.revenueVersion;
    if (previousRevenueVersion) {
      const revenues = findMany('revenue', (r: any) => r.cardId === cardId && r.version === previousRevenueVersion);
      revenues.forEach((r: any) => {
        updateOne('revenue', (x: any) => x.id === r.id, { isWithdrawn: false });
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

  withdrawRevenueVersion(cardId: string, withdrawnBy: string): {
    success: boolean;
    message: string;
  } {
    const card = this.cardService.getCard(cardId);
    if (!card) {
      return { success: false, message: '卡片不存在' };
    }

    if (!card.revenueVersion || card.revenueVersion <= 0) {
      return { success: false, message: '暂无分账版本可撤回' };
    }

    const currentRevVersion = card.revenueVersion;
    const revenues = findMany('revenue', (r: any) => r.cardId === cardId && r.version === currentRevVersion);
    revenues.forEach((r: any) => {
      updateOne('revenue', (x: any) => x.id === r.id, { isWithdrawn: true });
    });

    const previousRevenueVersion = card.revenueVersion - 1;
    if (previousRevenueVersion > 0) {
      const prevRevenues = findMany('revenue', (r: any) => r.cardId === cardId && r.version === previousRevenueVersion);
      prevRevenues.forEach((r: any) => {
        updateOne('revenue', (x: any) => x.id === r.id, { isWithdrawn: false });
      });
    }

    const newRevenueVersion: number | undefined = previousRevenueVersion > 0 ? previousRevenueVersion : undefined;
    const newStatus: CardStatus = newRevenueVersion ? 'REVENUE_CALCULATED' : 'CONFLICT_RESOLVED';

    this.cardService.updateCardFields(cardId, {
      revenueVersion: newRevenueVersion,
      status: newStatus,
    });

    return {
      success: true,
      message: `已撤回分账版本 ${card.revenueVersion}，分账明细已恢复至上一版`,
    };
  }

  getVersionHistory(cardId: string): Array<{
    version: number;
    status: CardStatus;
    createdAt: string;
    createdBy: string;
    hasRevenue: boolean;
  }> {
    const snapshots = findMany('snapshots', (s: any) => s.cardId === cardId)
      .sort((a, b) => b.version - a.version);

    const activeRevenueVersions = new Set(
      findMany('revenue', (r: any) => r.cardId === cardId && !r.isWithdrawn)
        .map((r: any) => r.version)
    );

    return snapshots.map((s: any) => ({
      version: s.version,
      status: s.status as CardStatus,
      createdAt: s.createdAt,
      createdBy: s.createdBy,
      hasRevenue: s.revenueVersion ? activeRevenueVersions.has(s.revenueVersion) : false,
    }));
  }
}
