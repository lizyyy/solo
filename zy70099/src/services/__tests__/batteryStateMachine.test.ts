import { BatteryStateMachine } from '../batteryStateMachine';
import { BatteryStatus } from '../../types';

describe('BatteryStateMachine', () => {
  describe('状态转换有效性', () => {
    it('CHARGING 可以转换到 AVAILABLE、MAINTENANCE、SCRAPPED', () => {
      expect(BatteryStateMachine.canTransition(BatteryStatus.CHARGING, BatteryStatus.AVAILABLE)).toBe(true);
      expect(BatteryStateMachine.canTransition(BatteryStatus.CHARGING, BatteryStatus.MAINTENANCE)).toBe(true);
      expect(BatteryStateMachine.canTransition(BatteryStatus.CHARGING, BatteryStatus.SCRAPPED)).toBe(true);
      expect(BatteryStateMachine.canTransition(BatteryStatus.CHARGING, BatteryStatus.LENT)).toBe(false);
    });

    it('AVAILABLE 可以转换到 LENT、MAINTENANCE、SCRAPPED', () => {
      expect(BatteryStateMachine.canTransition(BatteryStatus.AVAILABLE, BatteryStatus.LENT)).toBe(true);
      expect(BatteryStateMachine.canTransition(BatteryStatus.AVAILABLE, BatteryStatus.MAINTENANCE)).toBe(true);
      expect(BatteryStateMachine.canTransition(BatteryStatus.AVAILABLE, BatteryStatus.SCRAPPED)).toBe(true);
      expect(BatteryStateMachine.canTransition(BatteryStatus.AVAILABLE, BatteryStatus.CHARGING)).toBe(false);
    });

    it('LENT 可以转换到 AVAILABLE、MAINTENANCE', () => {
      expect(BatteryStateMachine.canTransition(BatteryStatus.LENT, BatteryStatus.AVAILABLE)).toBe(true);
      expect(BatteryStateMachine.canTransition(BatteryStatus.LENT, BatteryStatus.MAINTENANCE)).toBe(true);
      expect(BatteryStateMachine.canTransition(BatteryStatus.LENT, BatteryStatus.SCRAPPED)).toBe(false);
    });

    it('MAINTENANCE 可以转换到 AVAILABLE、SCRAPPED', () => {
      expect(BatteryStateMachine.canTransition(BatteryStatus.MAINTENANCE, BatteryStatus.AVAILABLE)).toBe(true);
      expect(BatteryStateMachine.canTransition(BatteryStatus.MAINTENANCE, BatteryStatus.SCRAPPED)).toBe(true);
      expect(BatteryStateMachine.canTransition(BatteryStatus.MAINTENANCE, BatteryStatus.LENT)).toBe(false);
    });

    it('SCRAPPED 不能转换到任何状态', () => {
      expect(BatteryStateMachine.canTransition(BatteryStatus.SCRAPPED, BatteryStatus.AVAILABLE)).toBe(false);
      expect(BatteryStateMachine.canTransition(BatteryStatus.SCRAPPED, BatteryStatus.MAINTENANCE)).toBe(false);
      expect(BatteryStateMachine.canTransition(BatteryStatus.SCRAPPED, BatteryStatus.LENT)).toBe(false);
    });
  });

  describe('状态判断辅助方法', () => {
    it('isAvailableForLending - 只有 AVAILABLE 可以借出', () => {
      expect(BatteryStateMachine.isAvailableForLending(BatteryStatus.AVAILABLE)).toBe(true);
      expect(BatteryStateMachine.isAvailableForLending(BatteryStatus.CHARGING)).toBe(false);
      expect(BatteryStateMachine.isAvailableForLending(BatteryStatus.LENT)).toBe(false);
      expect(BatteryStateMachine.isAvailableForLending(BatteryStatus.MAINTENANCE)).toBe(false);
      expect(BatteryStateMachine.isAvailableForLending(BatteryStatus.SCRAPPED)).toBe(false);
    });

    it('isAvailableForReturn - 只有 LENT 可以归还', () => {
      expect(BatteryStateMachine.isAvailableForReturn(BatteryStatus.LENT)).toBe(true);
      expect(BatteryStateMachine.isAvailableForReturn(BatteryStatus.AVAILABLE)).toBe(false);
      expect(BatteryStateMachine.isAvailableForReturn(BatteryStatus.CHARGING)).toBe(false);
      expect(BatteryStateMachine.isAvailableForReturn(BatteryStatus.SCRAPPED)).toBe(false);
    });

    it('isInCabinet - CHARGING 和 AVAILABLE 算在柜中', () => {
      expect(BatteryStateMachine.isInCabinet(BatteryStatus.CHARGING)).toBe(true);
      expect(BatteryStateMachine.isInCabinet(BatteryStatus.AVAILABLE)).toBe(true);
      expect(BatteryStateMachine.isInCabinet(BatteryStatus.LENT)).toBe(false);
      expect(BatteryStateMachine.isInCabinet(BatteryStatus.MAINTENANCE)).toBe(false);
      expect(BatteryStateMachine.isInCabinet(BatteryStatus.SCRAPPED)).toBe(false);
    });
  });

  describe('借出状态校验', () => {
    it('AVAILABLE 状态借出成功', () => {
      const result = BatteryStateMachine.validateLendTransition(BatteryStatus.AVAILABLE);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(BatteryStatus.LENT);
      expect(result.needsManualReview).toBe(false);
    });

    it('SCRAPPED 状态借出失败，需要人工复核', () => {
      const result = BatteryStateMachine.validateLendTransition(BatteryStatus.SCRAPPED);
      expect(result.success).toBe(false);
      expect(result.newStatus).toBeNull();
      expect(result.needsManualReview).toBe(true);
    });

    it('MAINTENANCE 状态借出失败，需要人工复核', () => {
      const result = BatteryStateMachine.validateLendTransition(BatteryStatus.MAINTENANCE);
      expect(result.success).toBe(false);
      expect(result.newStatus).toBeNull();
      expect(result.needsManualReview).toBe(true);
    });

    it('LENT 状态借出失败（状态串位），需要人工复核', () => {
      const result = BatteryStateMachine.validateLendTransition(BatteryStatus.LENT);
      expect(result.success).toBe(false);
      expect(result.newStatus).toBeNull();
      expect(result.needsManualReview).toBe(true);
    });

    it('CHARGING 状态借出失败，不需要人工复核', () => {
      const result = BatteryStateMachine.validateLendTransition(BatteryStatus.CHARGING);
      expect(result.success).toBe(false);
      expect(result.newStatus).toBeNull();
      expect(result.needsManualReview).toBe(false);
    });
  });

  describe('归还状态校验', () => {
    it('LENT 状态归还成功', () => {
      const result = BatteryStateMachine.validateReturnTransition(BatteryStatus.LENT);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(BatteryStatus.AVAILABLE);
      expect(result.needsManualReview).toBe(false);
    });

    it('SCRAPPED 状态归还失败，需要人工复核', () => {
      const result = BatteryStateMachine.validateReturnTransition(BatteryStatus.SCRAPPED);
      expect(result.success).toBe(false);
      expect(result.newStatus).toBeNull();
      expect(result.needsManualReview).toBe(true);
    });

    it('AVAILABLE 状态归还失败（状态串位），需要人工复核', () => {
      const result = BatteryStateMachine.validateReturnTransition(BatteryStatus.AVAILABLE);
      expect(result.success).toBe(false);
      expect(result.newStatus).toBeNull();
      expect(result.needsManualReview).toBe(true);
    });

    it('MAINTENANCE 状态归还失败（状态串位），需要人工复核', () => {
      const result = BatteryStateMachine.validateReturnTransition(BatteryStatus.MAINTENANCE);
      expect(result.success).toBe(false);
      expect(result.newStatus).toBeNull();
      expect(result.needsManualReview).toBe(true);
    });
  });

  describe('维修状态校验', () => {
    it('CHARGING 可以进入维修', () => {
      const result = BatteryStateMachine.validateMaintenanceTransition(BatteryStatus.CHARGING);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(BatteryStatus.MAINTENANCE);
      expect(result.needsManualReview).toBe(false);
    });

    it('AVAILABLE 可以进入维修', () => {
      const result = BatteryStateMachine.validateMaintenanceTransition(BatteryStatus.AVAILABLE);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(BatteryStatus.MAINTENANCE);
      expect(result.needsManualReview).toBe(false);
    });

    it('LENT 可以进入维修', () => {
      const result = BatteryStateMachine.validateMaintenanceTransition(BatteryStatus.LENT);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(BatteryStatus.MAINTENANCE);
      expect(result.needsManualReview).toBe(false);
    });

    it('MAINTENANCE 已经在维修，无需操作', () => {
      const result = BatteryStateMachine.validateMaintenanceTransition(BatteryStatus.MAINTENANCE);
      expect(result.success).toBe(false);
      expect(result.needsManualReview).toBe(false);
    });

    it('SCRAPPED 不能进入维修', () => {
      const result = BatteryStateMachine.validateMaintenanceTransition(BatteryStatus.SCRAPPED);
      expect(result.success).toBe(false);
      expect(result.needsManualReview).toBe(false);
    });
  });

  describe('完成维修校验', () => {
    it('MAINTENANCE 可以完成维修', () => {
      const result = BatteryStateMachine.validateRepairCompleteTransition(BatteryStatus.MAINTENANCE);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(BatteryStatus.AVAILABLE);
      expect(result.needsManualReview).toBe(false);
    });

    it('其他状态完成维修失败，需要人工复核', () => {
      expect(BatteryStateMachine.validateRepairCompleteTransition(BatteryStatus.AVAILABLE).needsManualReview).toBe(true);
      expect(BatteryStateMachine.validateRepairCompleteTransition(BatteryStatus.LENT).needsManualReview).toBe(true);
      expect(BatteryStateMachine.validateRepairCompleteTransition(BatteryStatus.SCRAPPED).needsManualReview).toBe(true);
    });
  });

  describe('报废状态校验', () => {
    it('CHARGING 可以报废', () => {
      const result = BatteryStateMachine.validateScrapTransition(BatteryStatus.CHARGING);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(BatteryStatus.SCRAPPED);
      expect(result.needsManualReview).toBe(false);
    });

    it('AVAILABLE 可以报废', () => {
      const result = BatteryStateMachine.validateScrapTransition(BatteryStatus.AVAILABLE);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(BatteryStatus.SCRAPPED);
      expect(result.needsManualReview).toBe(false);
    });

    it('MAINTENANCE 可以报废', () => {
      const result = BatteryStateMachine.validateScrapTransition(BatteryStatus.MAINTENANCE);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(BatteryStatus.SCRAPPED);
      expect(result.needsManualReview).toBe(false);
    });

    it('LENT 状态不能直接报废，需要人工复核', () => {
      const result = BatteryStateMachine.validateScrapTransition(BatteryStatus.LENT);
      expect(result.success).toBe(false);
      expect(result.needsManualReview).toBe(true);
    });

    it('SCRAPPED 已经报废', () => {
      const result = BatteryStateMachine.validateScrapTransition(BatteryStatus.SCRAPPED);
      expect(result.success).toBe(false);
      expect(result.needsManualReview).toBe(false);
    });
  });

  describe('循环次数检查', () => {
    it('循环次数正常（低于 90%）', () => {
      const result = BatteryStateMachine.checkCycleCount(500, 1000);
      expect(result.needsInspection).toBe(false);
    });

    it('循环次数接近上限（>= 90%），需要检查', () => {
      const result = BatteryStateMachine.checkCycleCount(900, 1000);
      expect(result.needsInspection).toBe(true);
      expect(result.reason).toContain('接近');
    });

    it('循环次数超过上限（>= 100%），需要检查', () => {
      const result = BatteryStateMachine.checkCycleCount(1000, 1000);
      expect(result.needsInspection).toBe(true);
      expect(result.reason).toContain('超过');
    });

    it('最大循环次数配置无效（<= 0），需要检查', () => {
      const result = BatteryStateMachine.checkCycleCount(100, 0);
      expect(result.needsInspection).toBe(true);
      expect(result.reason).toContain('配置无效');
    });
  });

  describe('借出时柜格校验', () => {
    const batteryId = 'bat-123';

    it('柜格占用且电池匹配，校验通过', () => {
      const result = BatteryStateMachine.validateSlotForLend('OCCUPIED', batteryId, batteryId);
      expect(result.success).toBe(true);
      expect(result.needsManualReview).toBe(false);
    });

    it('柜格不是 OCCUPIED 状态，需要人工复核', () => {
      const result = BatteryStateMachine.validateSlotForLend('EMPTY', batteryId, null);
      expect(result.success).toBe(false);
      expect(result.needsManualReview).toBe(true);
    });

    it('柜格内电池不匹配，需要人工复核', () => {
      const result = BatteryStateMachine.validateSlotForLend('OCCUPIED', batteryId, 'other-battery');
      expect(result.success).toBe(false);
      expect(result.needsManualReview).toBe(true);
    });
  });

  describe('归还时柜格校验', () => {
    it('柜格为空，校验通过', () => {
      const result = BatteryStateMachine.validateSlotForReturn('EMPTY', null);
      expect(result.success).toBe(true);
      expect(result.needsManualReview).toBe(false);
    });

    it('柜格在维修中，需要人工复核', () => {
      const result = BatteryStateMachine.validateSlotForReturn('MAINTENANCE', null);
      expect(result.success).toBe(false);
      expect(result.needsManualReview).toBe(true);
    });

    it('柜格已有电池，需要人工复核', () => {
      const result = BatteryStateMachine.validateSlotForReturn('OCCUPIED', 'existing-battery');
      expect(result.success).toBe(false);
      expect(result.needsManualReview).toBe(true);
    });
  });
});
