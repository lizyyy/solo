import { BatteryStatus } from '../types';

export interface StateTransitionResult {
  success: boolean;
  newStatus: BatteryStatus | null;
  reason: string;
  needsManualReview: boolean;
}

export class BatteryStateMachine {
  private static readonly VALID_TRANSITIONS: Record<BatteryStatus, BatteryStatus[]> = {
    [BatteryStatus.CHARGING]: [BatteryStatus.AVAILABLE, BatteryStatus.MAINTENANCE, BatteryStatus.SCRAPPED],
    [BatteryStatus.AVAILABLE]: [BatteryStatus.LENT, BatteryStatus.MAINTENANCE, BatteryStatus.SCRAPPED],
    [BatteryStatus.LENT]: [BatteryStatus.AVAILABLE, BatteryStatus.MAINTENANCE],
    [BatteryStatus.MAINTENANCE]: [BatteryStatus.AVAILABLE, BatteryStatus.SCRAPPED],
    [BatteryStatus.SCRAPPED]: [],
  };

  static canTransition(from: BatteryStatus, to: BatteryStatus): boolean {
    const validTransitions = this.VALID_TRANSITIONS[from] || [];
    return validTransitions.includes(to);
  }

  static isAvailableForLending(status: BatteryStatus): boolean {
    return status === BatteryStatus.AVAILABLE;
  }

  static isAvailableForReturn(status: BatteryStatus): boolean {
    return status === BatteryStatus.LENT;
  }

  static isInMaintenance(status: BatteryStatus): boolean {
    return status === BatteryStatus.MAINTENANCE;
  }

  static isScrapped(status: BatteryStatus): boolean {
    return status === BatteryStatus.SCRAPPED;
  }

  static isInCabinet(status: BatteryStatus): boolean {
    return [BatteryStatus.CHARGING, BatteryStatus.AVAILABLE].includes(status);
  }

  static validateLendTransition(currentStatus: BatteryStatus): StateTransitionResult {
    if (this.isScrapped(currentStatus)) {
      return {
        success: false,
        newStatus: null,
        reason: '电池已报废，无法借出',
        needsManualReview: true,
      };
    }

    if (this.isInMaintenance(currentStatus)) {
      return {
        success: false,
        newStatus: null,
        reason: '电池正在维修中，无法借出',
        needsManualReview: true,
      };
    }

    if (!this.isAvailableForLending(currentStatus)) {
      return {
        success: false,
        newStatus: null,
        reason: `电池当前状态(${currentStatus})不允许借出`,
        needsManualReview: currentStatus === BatteryStatus.LENT,
      };
    }

    return {
      success: true,
      newStatus: BatteryStatus.LENT,
      reason: '状态转换有效',
      needsManualReview: false,
    };
  }

  static validateReturnTransition(currentStatus: BatteryStatus): StateTransitionResult {
    if (this.isScrapped(currentStatus)) {
      return {
        success: false,
        newStatus: null,
        reason: '电池已报废，无法归还',
        needsManualReview: true,
      };
    }

    if (!this.isAvailableForReturn(currentStatus)) {
      return {
        success: false,
        newStatus: null,
        reason: `电池当前状态(${currentStatus})不是借出状态，可能存在状态串位`,
        needsManualReview: true,
      };
    }

    return {
      success: true,
      newStatus: BatteryStatus.AVAILABLE,
      reason: '状态转换有效',
      needsManualReview: false,
    };
  }

  static validateMaintenanceTransition(currentStatus: BatteryStatus): StateTransitionResult {
    if (this.isScrapped(currentStatus)) {
      return {
        success: false,
        newStatus: null,
        reason: '电池已报废，无法标记为维修',
        needsManualReview: false,
      };
    }

    if (this.isInMaintenance(currentStatus)) {
      return {
        success: false,
        newStatus: null,
        reason: '电池已在维修中',
        needsManualReview: false,
      };
    }

    if (!this.canTransition(currentStatus, BatteryStatus.MAINTENANCE)) {
      return {
        success: false,
        newStatus: null,
        reason: `无法从状态(${currentStatus})转换到维修状态`,
        needsManualReview: true,
      };
    }

    return {
      success: true,
      newStatus: BatteryStatus.MAINTENANCE,
      reason: '状态转换有效',
      needsManualReview: false,
    };
  }

  static validateRepairCompleteTransition(currentStatus: BatteryStatus): StateTransitionResult {
    if (!this.isInMaintenance(currentStatus)) {
      return {
        success: false,
        newStatus: null,
        reason: '电池不在维修状态，无法完成维修',
        needsManualReview: true,
      };
    }

    return {
      success: true,
      newStatus: BatteryStatus.AVAILABLE,
      reason: '状态转换有效',
      needsManualReview: false,
    };
  }

  static validateScrapTransition(currentStatus: BatteryStatus): StateTransitionResult {
    if (this.isScrapped(currentStatus)) {
      return {
        success: false,
        newStatus: null,
        reason: '电池已报废',
        needsManualReview: false,
      };
    }

    if (currentStatus === BatteryStatus.LENT) {
      return {
        success: false,
        newStatus: null,
        reason: '电池处于借出状态，无法直接报废，请先确认电池位置',
        needsManualReview: true,
      };
    }

    return {
      success: true,
      newStatus: BatteryStatus.SCRAPPED,
      reason: '状态转换有效',
      needsManualReview: false,
    };
  }

  static checkCycleCount(cycleCount: number, maxCycleCount: number): { needsInspection: boolean; reason: string } {
    if (maxCycleCount <= 0) {
      return { needsInspection: true, reason: '最大循环次数配置无效' };
    }

    const usageRatio = cycleCount / maxCycleCount;

    if (usageRatio >= 1) {
      return { needsInspection: true, reason: `循环次数(${cycleCount})已超过最大限制(${maxCycleCount})` };
    }

    if (usageRatio >= 0.9) {
      return { needsInspection: true, reason: `循环次数(${cycleCount})接近最大限制(${maxCycleCount})，建议检查` };
    }

    return { needsInspection: false, reason: '循环次数正常' };
  }

  static validateSlotForLend(
    slotStatus: string,
    expectedBatteryId: string | null,
    actualBatteryId: string | null
  ): { success: boolean; reason: string; needsManualReview: boolean } {
    if (slotStatus !== 'OCCUPIED') {
      return {
        success: false,
        reason: `柜格状态为${slotStatus}，应为OCCUPIED`,
        needsManualReview: true,
      };
    }

    if (expectedBatteryId !== actualBatteryId) {
      return {
        success: false,
        reason: `柜格内电池不匹配，期望: ${expectedBatteryId}, 实际: ${actualBatteryId}`,
        needsManualReview: true,
      };
    }

    return { success: true, reason: '柜格状态正常', needsManualReview: false };
  }

  static validateSlotForReturn(
    slotStatus: string,
    existingBatteryId: string | null
  ): { success: boolean; reason: string; needsManualReview: boolean } {
    if (slotStatus === 'MAINTENANCE') {
      return {
        success: false,
        reason: '柜格处于维修状态',
        needsManualReview: true,
      };
    }

    if (existingBatteryId !== null) {
      return {
        success: false,
        reason: '柜格内已有电池，无法归还',
        needsManualReview: true,
      };
    }

    return { success: true, reason: '柜格状态正常', needsManualReview: false };
  }
}
