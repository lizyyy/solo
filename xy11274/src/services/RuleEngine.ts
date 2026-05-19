import { storage } from '../storage/StorageManager';
import { LockRecord } from '../models/LockRecord';
import { Forklift } from '../models/Forklift';
import { ChargingPile } from '../models/ChargingPile';
import { ResultWithReason } from '../models/types';
import { getCurrentTime } from '../utils/dateUtils';

export class RuleEngine {
  private static LOW_BATTERY_THRESHOLD = 30;
  private static CRITICAL_BATTERY_THRESHOLD = 15;

  static checkIdempotency(idempotentKey: string): ResultWithReason<LockRecord | null> {
    const existingResultId = storage.lockRecords.getIdempotentResult(idempotentKey);
    if (existingResultId) {
      const existingRecord = storage.lockRecords.getById(existingResultId);
      if (existingRecord) {
        return {
          success: true,
          result: existingRecord,
          reason: `幂等命中：已存在相同请求，返回历史结果，请求键: ${idempotentKey}`,
          operationResult: 'allowed',
          idempotentKey
        };
      }
    }
    return {
      success: true,
      result: null,
      reason: '幂等校验通过：无重复请求',
      operationResult: 'allowed',
      idempotentKey
    };
  }

  static checkLowBatteryPriority(forklift: Forklift): ResultWithReason<boolean> {
    if (forklift.batteryLevel <= this.CRITICAL_BATTERY_THRESHOLD) {
      return {
        success: true,
        result: true,
        reason: `低电量优先：叉车 ${forklift.code} 电量 ${forklift.batteryLevel}%，低于临界值 ${this.CRITICAL_BATTERY_THRESHOLD}%，享有最高优先级`,
        operationResult: 'allowed'
      };
    }
    if (forklift.batteryLevel <= this.LOW_BATTERY_THRESHOLD) {
      return {
        success: true,
        result: true,
        reason: `低电量优先：叉车 ${forklift.code} 电量 ${forklift.batteryLevel}%，低于阈值 ${this.LOW_BATTERY_THRESHOLD}%，享有优先级`,
        operationResult: 'allowed'
      };
    }
    return {
      success: true,
      result: false,
      reason: `电量正常：叉车 ${forklift.code} 电量 ${forklift.batteryLevel}%，无需优先充电`,
      operationResult: 'allowed'
    };
  }

  static checkCrossShiftOccupancy(
    chargingPile: ChargingPile,
    targetShiftId: string,
    targetDate: string
  ): ResultWithReason<LockRecord | null> {
    const activeLocks = storage.lockRecords.find(
      lock => lock.chargingPileId === chargingPile.id && 
              lock.status === 'active'
    );

    for (const lock of activeLocks) {
      if (lock.shiftId !== targetShiftId || lock.date !== targetDate) {
        return {
          success: false,
          result: lock,
          reason: `跨班占用：充电桩 ${chargingPile.code} 已被班次 ${lock.shiftType}(${lock.date}) 占用，叉车 ${lock.forkliftCode}，锁定时间: ${lock.lockTime}`,
          operationResult: 'blocked'
        };
      }
    }
    return {
      success: true,
      result: null,
      reason: `跨班校验通过：充电桩 ${chargingPile.code} 在目标班次可用`,
      operationResult: 'allowed'
    };
  }

  static checkPileAvailability(chargingPile: ChargingPile): ResultWithReason<boolean> {
    if (chargingPile.status === 'maintenance') {
      return {
        success: false,
        result: false,
        reason: `充电桩不可用：${chargingPile.code} 正在维护中`,
        operationResult: 'blocked'
      };
    }
    if (chargingPile.status === 'occupied') {
      const activeLock = storage.lockRecords.findOne(
        lock => lock.chargingPileId === chargingPile.id && lock.status === 'active'
      );
      if (activeLock) {
        return {
          success: false,
          result: false,
          reason: `充电桩已占用：${chargingPile.code} 已被叉车 ${activeLock.forkliftCode} 锁定`,
          operationResult: 'blocked'
        };
      }
    }
    return {
      success: true,
      result: true,
      reason: `充电桩可用：${chargingPile.code} 状态正常`,
      operationResult: 'allowed'
    };
  }

  static checkForkliftAvailability(forklift: Forklift): ResultWithReason<boolean> {
    if (forklift.status === 'maintenance') {
      return {
        success: false,
        result: false,
        reason: `叉车不可用：${forklift.code} 正在维护中`,
        operationResult: 'blocked'
      };
    }
    const activeLock = storage.lockRecords.findOne(
      lock => lock.forkliftId === forklift.id && lock.status === 'active'
    );
    if (activeLock) {
      return {
        success: false,
        result: false,
        reason: `叉车已锁定：${forklift.code} 已锁定充电桩 ${activeLock.chargingPileCode}`,
        operationResult: 'blocked'
      };
    }
    return {
      success: true,
      result: true,
      reason: `叉车可用：${forklift.code} 状态正常`,
      operationResult: 'allowed'
    };
  }

  static canPreemptLowBattery(
    existingLock: LockRecord,
    newForklift: Forklift
  ): ResultWithReason<boolean> {
    const existingForklift = storage.forklifts.getById(existingLock.forkliftId);
    if (!existingForklift) {
      return {
        success: false,
        result: false,
        reason: '原叉车信息不存在',
        operationResult: 'blocked'
      };
    }

    const newBatteryCheck = this.checkLowBatteryPriority(newForklift);
    const existingBatteryCheck = this.checkLowBatteryPriority(existingForklift);

    if (newBatteryCheck.result && !existingBatteryCheck.result) {
      const difference = existingForklift.batteryLevel - newForklift.batteryLevel;
      return {
        success: true,
        result: true,
        reason: `可抢占：新请求叉车 ${newForklift.code} 电量 ${newForklift.batteryLevel}% 低于阈值，原叉车 ${existingForklift.code} 电量 ${existingForklift.batteryLevel}%，电量差 ${difference}%，允许低电量优先抢占`,
        operationResult: 'allowed'
      };
    }

    return {
      success: false,
      result: false,
      reason: `不可抢占：新请求叉车 ${newForklift.code} 电量 ${newForklift.batteryLevel}%，原叉车 ${existingForklift.code} 电量 ${existingForklift.batteryLevel}%，不满足低电量抢占条件`,
      operationResult: 'blocked'
    };
  }

  static validateLockAcquire(
    chargingPileId: string,
    forkliftId: string,
    shiftId: string,
    date: string,
    idempotentKey: string
  ): ResultWithReason<{ pile: ChargingPile; forklift: Forklift } | null> {
    const idempotencyCheck = this.checkIdempotency(idempotentKey);
    if (idempotencyCheck.result) {
      return idempotencyCheck as ResultWithReason<any>;
    }

    const chargingPile = storage.chargingPiles.getById(chargingPileId);
    if (!chargingPile) {
      return {
        success: false,
        result: null,
        reason: `充电桩不存在：ID ${chargingPileId}`,
        operationResult: 'blocked'
      };
    }

    const forklift = storage.forklifts.getById(forkliftId);
    if (!forklift) {
      return {
        success: false,
        result: null,
        reason: `叉车不存在：ID ${forkliftId}`,
        operationResult: 'blocked'
      };
    }

    const shift = storage.shifts.getById(shiftId);
    if (!shift) {
      return {
        success: false,
        result: null,
        reason: `班次不存在：ID ${shiftId}`,
        operationResult: 'blocked'
      };
    }

    const pileAvailability = this.checkPileAvailability(chargingPile);
    if (!pileAvailability.success) {
      return pileAvailability as ResultWithReason<any>;
    }

    const forkliftAvailability = this.checkForkliftAvailability(forklift);
    if (!forkliftAvailability.success) {
      return forkliftAvailability as ResultWithReason<any>;
    }

    const crossShiftCheck = this.checkCrossShiftOccupancy(chargingPile, shiftId, date);
    if (!crossShiftCheck.success) {
      return crossShiftCheck as ResultWithReason<any>;
    }

    return {
      success: true,
      result: { pile: chargingPile, forklift },
      reason: `所有规则校验通过：充电桩 ${chargingPile.code}、叉车 ${forklift.code}、班次 ${shift.shiftType} 均符合锁定条件`,
      operationResult: 'allowed'
    };
  }

  static getAllRules(): string[] {
    return [
      `低电量优先阈值：电量 <= ${this.LOW_BATTERY_THRESHOLD}% 享有优先级`,
      `临界电量阈值：电量 <= ${this.CRITICAL_BATTERY_THRESHOLD}% 享有最高优先级`,
      '跨班占用检测：不允许不同班次占用同一充电桩',
      '幂等性校验：相同请求键重复提交返回相同结果',
      '状态校验：充电桩和叉车需处于可用状态',
      '低电量抢占：低电量叉车可抢占非低电量叉车的充电位'
    ];
  }
}
