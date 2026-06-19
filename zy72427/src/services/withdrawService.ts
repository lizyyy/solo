import { findMany, updateOne, findOne } from '../database';
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
    revenueVersion?: number;
    changeDescription: string;
  }> {
    const snapshots = findMany('snapshots', (s: any) => s.cardId === cardId)
      .sort((a, b) => b.version - a.version);

    const card = findOne('cards', (c: any) => c.id === cardId);
    const currentRevenueVersion = card?.revenueVersion;

    const allRevenues = findMany('revenue', (r: any) => r.cardId === cardId);
    const versionRevenueExists = new Map<number, boolean>();
    for (const r of allRevenues) {
      if (!r.isWithdrawn) {
        versionRevenueExists.set(r.version, true);
      }
    }

    return snapshots.map((s: any, index: number) => {
      let hasRevenue = false;
      let revenueVersion: number | undefined;
      let changeDescription = '';

      if (s.revenueVersion) {
        revenueVersion = s.revenueVersion;
        hasRevenue = versionRevenueExists.get(s.revenueVersion) || false;
        
        if (s.revenueVersion === currentRevenueVersion) {
          changeDescription = `当前分账版本 v${s.revenueVersion}`;
        } else if (hasRevenue) {
          changeDescription = `历史分账版本 v${s.revenueVersion}（仍有效）`;
        } else {
          changeDescription = `分账版本 v${s.revenueVersion}（已被重算取代）`;
        }
      } else if (s.status === 'ATTENDANCE_IMPORTED') {
        changeDescription = '导入课时签到照片';
      } else if (s.status === 'TICKET_SUPPLEMENTED') {
        changeDescription = '补充票务导出表';
      } else if (s.status === 'CONFLICT_DETECTED') {
        changeDescription = '检测到冲突';
      } else if (s.status === 'CONFLICT_RESOLVED') {
        changeDescription = '冲突已解决';
      } else if (s.status === 'DRAFT') {
        changeDescription = '创建卡片';
      }

      if (index < snapshots.length - 1) {
        const prevSnapshot = snapshots[index + 1];
        if (s.revenueVersion && prevSnapshot.revenueVersion !== s.revenueVersion) {
          if (prevSnapshot.revenueVersion) {
            changeDescription = `重算分账：v${prevSnapshot.revenueVersion} → v${s.revenueVersion}`;
          } else {
            changeDescription = `首次计算分账 v${s.revenueVersion}`;
          }
        }
      }

      return {
        version: s.version,
        status: s.status as CardStatus,
        createdAt: s.createdAt,
        createdBy: s.createdBy,
        hasRevenue,
        revenueVersion,
        changeDescription,
      };
    });
  }
}
