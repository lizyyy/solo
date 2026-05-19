import { storage } from '../storage/StorageManager';
import { LockAcquireInput, LockReleaseInput, LockExceptionInput, LockRecord } from '../models/LockRecord';
import { ResultWithReason, Role } from '../models/types';
import { RuleEngine } from './RuleEngine';
import { AuditService } from './AuditService';
import { getCurrentTime, addMinutes, generateIdempotentKey } from '../utils/dateUtils';

export class LockService {
  static acquireLock(input: LockAcquireInput): ResultWithReason<LockRecord> {
    const validation = RuleEngine.validateLockAcquire(
      input.chargingPileId,
      input.forkliftId,
      input.shiftId,
      input.date,
      input.idempotentKey
    );

    const resultAny = validation as any;
    if (resultAny.result && 'idempotentKey' in resultAny.result) {
      AuditService.logLockAcquire(
        resultAny.result.id,
        input.operator,
        input.role as Role,
        'allowed',
        validation.reason,
        { idempotentKey: input.idempotentKey },
        input.idempotentKey
      );
      return resultAny;
    }

    if (!validation.success) {
      AuditService.logLockAcquire(
        '',
        input.operator,
        input.role as Role,
        'blocked',
        validation.reason,
        {
          chargingPileId: input.chargingPileId,
          forkliftId: input.forkliftId,
          shiftId: input.shiftId
        },
        input.idempotentKey
      );
      return {
        success: false,
        reason: validation.reason,
        operationResult: 'blocked',
        idempotentKey: input.idempotentKey
      };
    }

    const { pile, forklift } = validation.result!;
    const now = getCurrentTime();
    const expectedDuration = input.expectedDurationMinutes || 120;
    const expectedReleaseTime = addMinutes(now, expectedDuration);

    const lockRecord = storage.lockRecords.create({
      idempotentKey: input.idempotentKey,
      chargingPileId: input.chargingPileId,
      chargingPileCode: pile.code,
      forkliftId: input.forkliftId,
      forkliftCode: forklift.code,
      shiftId: input.shiftId,
      date: input.date,
      shiftType: input.shiftType,
      status: 'active',
      lockTime: now,
      expectedReleaseTime,
      batteryLevelAtLock: forklift.batteryLevel,
      createdAt: now,
      updatedAt: now,
      createdBy: input.operator,
      updatedBy: input.operator
    });

    storage.lockRecords.setIdempotentResult(input.idempotentKey, lockRecord.id);

    storage.chargingPiles.update(input.chargingPileId, {
      status: 'occupied',
      currentForkliftId: input.forkliftId,
      currentLockId: lockRecord.id,
      updatedAt: now,
      updatedBy: input.operator
    });

    storage.forklifts.update(input.forkliftId, {
      status: 'charging',
      currentShift: input.shiftId,
      lastChargingTime: now,
      updatedAt: now,
      updatedBy: input.operator
    });

    const lowBatteryCheck = RuleEngine.checkLowBatteryPriority(forklift);

    AuditService.logLockAcquire(
      lockRecord.id,
      input.operator,
      input.role as Role,
      'allowed',
      `锁定成功：${lowBatteryCheck.reason}`,
      {
        chargingPileCode: pile.code,
        forkliftCode: forklift.code,
        batteryLevel: forklift.batteryLevel,
        expectedReleaseTime,
        isLowBattery: lowBatteryCheck.result
      },
      input.idempotentKey
    );

    return {
      success: true,
      result: lockRecord,
      reason: `锁定成功：充电桩 ${pile.code} 已被叉车 ${forklift.code} 锁定，${lowBatteryCheck.reason}`,
      operationResult: 'allowed',
      idempotentKey: input.idempotentKey
    };
  }

  static releaseLock(input: LockReleaseInput): ResultWithReason<LockRecord> {
    const lockRecord = storage.lockRecords.getById(input.lockId);
    if (!lockRecord) {
      AuditService.logLockRelease(
        input.lockId,
        input.operator,
        input.role as Role,
        'blocked',
        `锁定记录不存在：ID ${input.lockId}`
      );
      return {
        success: false,
        reason: `锁定记录不存在：ID ${input.lockId}`,
        operationResult: 'blocked'
      };
    }

    if (lockRecord.status !== 'active') {
      AuditService.logLockRelease(
        input.lockId,
        input.operator,
        input.role as Role,
        'blocked',
        `锁定状态异常：当前状态为 ${lockRecord.status}，无法释放`
      );
      return {
        success: false,
        reason: `锁定状态异常：当前状态为 ${lockRecord.status}，无法释放`,
        operationResult: 'blocked'
      };
    }

    const now = getCurrentTime();
    const updatedRecord = storage.lockRecords.update(input.lockId, {
      status: 'released',
      actualReleaseTime: now,
      releaseReason: input.releaseReason,
      updatedAt: now,
      updatedBy: input.operator
    });

    storage.chargingPiles.update(lockRecord.chargingPileId, {
      status: 'available',
      currentForkliftId: undefined,
      currentLockId: undefined,
      updatedAt: now,
      updatedBy: input.operator
    });

    storage.forklifts.update(lockRecord.forkliftId, {
      status: 'available',
      currentShift: undefined,
      updatedAt: now,
      updatedBy: input.operator
    });

    AuditService.logLockRelease(
      input.lockId,
      input.operator,
      input.role as Role,
      'allowed',
      `释放成功：${input.releaseReason}`,
      {
        chargingPileCode: lockRecord.chargingPileCode,
        forkliftCode: lockRecord.forkliftCode,
        lockDuration: Math.round(
          (new Date(now).getTime() - new Date(lockRecord.lockTime).getTime()) / 60000
        ) + '分钟'
      }
    );

    return {
      success: true,
      result: updatedRecord!,
      reason: `释放成功：充电桩 ${lockRecord.chargingPileCode} 已释放，原因：${input.releaseReason}`,
      operationResult: 'allowed'
    };
  }

  static handleException(input: LockExceptionInput): ResultWithReason<LockRecord> {
    const lockRecord = storage.lockRecords.getById(input.lockId);
    if (!lockRecord) {
      AuditService.logLockException(
        input.lockId,
        input.operator,
        input.role as Role,
        'blocked',
        `锁定记录不存在：ID ${input.lockId}`
      );
      return {
        success: false,
        reason: `锁定记录不存在：ID ${input.lockId}`,
        operationResult: 'blocked'
      };
    }

    if (lockRecord.status === 'exception') {
      return {
        success: true,
        result: lockRecord,
        reason: `已处于异常状态：${lockRecord.releaseReason || '未知原因'}`,
        operationResult: 'allowed'
      };
    }

    const now = getCurrentTime();
    const updatedRecord = storage.lockRecords.update(input.lockId, {
      status: 'exception',
      actualReleaseTime: now,
      releaseReason: input.exceptionReason,
      updatedAt: now,
      updatedBy: input.operator
    });

    storage.chargingPiles.update(lockRecord.chargingPileId, {
      status: 'available',
      currentForkliftId: undefined,
      currentLockId: undefined,
      updatedAt: now,
      updatedBy: input.operator
    });

    storage.forklifts.update(lockRecord.forkliftId, {
      status: 'available',
      currentShift: undefined,
      updatedAt: now,
      updatedBy: input.operator
    });

    AuditService.logLockException(
      input.lockId,
      input.operator,
      input.role as Role,
      'allowed',
      `异常处理：${input.exceptionReason}`,
      {
        chargingPileCode: lockRecord.chargingPileCode,
        forkliftCode: lockRecord.forkliftCode,
        previousStatus: lockRecord.status
      }
    );

    return {
      success: true,
      result: updatedRecord!,
      reason: `异常处理完成：充电桩 ${lockRecord.chargingPileCode} 强制释放，原因：${input.exceptionReason}`,
      operationResult: 'allowed'
    };
  }

  static getLockById(lockId: string): LockRecord | undefined {
    return storage.lockRecords.getById(lockId);
  }

  static getActiveLocks(): LockRecord[] {
    return storage.lockRecords.find(lock => lock.status === 'active');
  }

  static getLocksByShift(shiftId: string): LockRecord[] {
    return storage.lockRecords.find(lock => lock.shiftId === shiftId);
  }

  static getLocksByDate(date: string): LockRecord[] {
    return storage.lockRecords.find(lock => lock.date === date);
  }

  static getLocksByForklift(forkliftId: string): LockRecord[] {
    return storage.lockRecords.find(lock => lock.forkliftId === forkliftId);
  }

  static getAllLocks(): LockRecord[] {
    return storage.lockRecords.getAll();
  }

  static getLockHistory(lockId: string): {
    record: LockRecord | undefined;
    audit: ReturnType<typeof AuditService.getHistory>;
  } {
    const record = storage.lockRecords.getById(lockId);
    const audit = AuditService.getHistory('LockRecord', lockId);
    return { record, audit };
  }
}
