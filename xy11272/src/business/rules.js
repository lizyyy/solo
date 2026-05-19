const {
  ForkliftRepository,
  ChargingStationRepository,
  ChargingLockRepository,
  ShiftRepository,
  OperationLogRepository,
  ExceptionRepository
} = require('../storage/repositories');

class RuleResult {
  constructor(passed, reason, data = null) {
    this.passed = passed;
    this.reason = reason;
    this.data = data;
  }
}

class RuleEngine {
  constructor() {
    this.forkliftRepo = new ForkliftRepository();
    this.stationRepo = new ChargingStationRepository();
    this.lockRepo = new ChargingLockRepository();
    this.shiftRepo = new ShiftRepository();
    this.logRepo = new OperationLogRepository();
    this.exceptionRepo = new ExceptionRepository();
    this.BATTERY_THRESHOLD = 30;
  }

  async checkLowBatteryPriority(forkliftId, requestingBattery) {
    const activeLocks = await this.lockRepo.findAll({ status: 'locked' });
    const lowerBatteryForklifts = [];
    
    for (const lock of activeLocks) {
      const forklift = await this.forkliftRepo.findById(lock.forklift_id);
      if (forklift && forklift.battery_level < requestingBattery) {
        lowerBatteryForklifts.push(forklift);
      }
    }

    if (lowerBatteryForklifts.length > 0) {
      return new RuleResult(false, 
        `存在${lowerBatteryForklifts.length}辆电量更低的叉车正在充电，请优先安排低电量叉车`,
        { lowerBatteryCount: lowerBatteryForklifts.length }
      );
    }

    if (requestingBattery <= this.BATTERY_THRESHOLD) {
      return new RuleResult(true, 
        `电量${requestingBattery}% <= ${this.BATTERY_THRESHOLD}%，享受低电量优先`,
        { isLowBattery: true }
      );
    }

    return new RuleResult(true, 
      `电量${requestingBattery}%正常，按普通队列处理`,
      { isLowBattery: false }
    );
  }

  async checkCrossShiftOccupancy(stationId, shiftId, expectedReleaseTime) {
    const shift = await this.shiftRepo.findById(shiftId);
    if (!shift) {
      return new RuleResult(false, '班次不存在');
    }

    const activeLock = await this.lockRepo.findActiveByStation(stationId);
    if (!activeLock) {
      return new RuleResult(true, '充电桩当前空闲');
    }

    if (activeLock.shift_id === shiftId) {
      return new RuleResult(true, '当前班次内锁定，允许续用');
    }

    const otherShift = await this.shiftRepo.findById(activeLock.shift_id);
    if (!otherShift) {
      return new RuleResult(false, '跨班次占用：充电桩被未知班次锁定');
    }

    const releaseTime = new Date(expectedReleaseTime);
    const otherShiftEnd = new Date(`${shift.date}T${otherShift.end_time}`);
    const currentShiftEnd = new Date(`${shift.date}T${shift.end_time}`);

    if (releaseTime > otherShiftEnd && releaseTime <= currentShiftEnd) {
      return new RuleResult(true, 
        `跨班次占用：${otherShift.name}锁定将在本班次内释放，可预约`,
        { waitingForRelease: true, otherShiftName: otherShift.name }
      );
    }

    return new RuleResult(false, 
      `跨班次占用：充电桩被${otherShift.name}锁定至${activeLock.expected_release_time}`,
      { otherShiftName: otherShift.name, lockedUntil: activeLock.expected_release_time }
    );
  }

  async checkIdempotentLock(stationId, forkliftId, shiftId) {
    const existingLock = await this.lockRepo.findDuplicateLock(stationId, forkliftId, shiftId);
    if (existingLock) {
      return new RuleResult(false, 
        '重复锁桩：该叉车在本班次内已锁定此充电桩',
        { existingLockId: existingLock.id }
      );
    }

    const forkliftActiveLock = await this.lockRepo.findActiveByForklift(forkliftId);
    if (forkliftActiveLock) {
      if (forkliftActiveLock.station_id === stationId) {
        return new RuleResult(false, 
          '重复锁桩：该叉车已锁定此充电桩',
          { existingLockId: forkliftActiveLock.id }
        );
      }
      return new RuleResult(false, 
        '锁桩冲突：该叉车已锁定其他充电桩，请先释放',
        { existingStationId: forkliftActiveLock.station_id }
      );
    }

    return new RuleResult(true, '无重复锁桩，幂等检查通过');
  }

  async checkStationAvailability(stationId) {
    const station = await this.stationRepo.findById(stationId);
    if (!station) {
      return new RuleResult(false, '充电桩不存在');
    }

    if (station.status === 'available') {
      return new RuleResult(true, '充电桩可用', { station });
    }

    const activeLock = await this.lockRepo.findActiveByStation(stationId);
    if (activeLock) {
      return new RuleResult(false, 
        `充电桩被占用：被叉车${activeLock.forklift_id}锁定`,
        { lockedBy: activeLock.forklift_id, lockId: activeLock.id }
      );
    }

    return new RuleResult(false, `充电桩状态异常：${station.status}`);
  }

  async checkForkliftAvailability(forkliftId) {
    const forklift = await this.forkliftRepo.findById(forkliftId);
    if (!forklift) {
      return new RuleResult(false, '叉车不存在');
    }

    if (forklift.status === 'maintenance') {
      return new RuleResult(false, '叉车正在维护中');
    }

    return new RuleResult(true, '叉车可用', { forklift });
  }

  async validateLockRequest(stationId, forkliftId, shiftId, driver) {
    const results = [];

    const forkliftCheck = await this.checkForkliftAvailability(forkliftId);
    results.push({ rule: 'forklift_availability', ...forkliftCheck });

    if (forkliftCheck.passed) {
      const batteryCheck = await this.checkLowBatteryPriority(forkliftId, forkliftCheck.data.forklift.battery_level);
      results.push({ rule: 'low_battery_priority', ...batteryCheck });
    }

    const idempotentCheck = await this.checkIdempotentLock(stationId, forkliftId, shiftId);
    results.push({ rule: 'idempotent_lock', ...idempotentCheck });

    if (idempotentCheck.passed) {
      const stationCheck = await this.checkStationAvailability(stationId);
      results.push({ rule: 'station_availability', ...stationCheck });

      if (stationCheck.passed) {
        const crossShiftCheck = await this.checkCrossShiftOccupancy(stationId, shiftId, 
          new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
        );
        results.push({ rule: 'cross_shift_occupancy', ...crossShiftCheck });
      }
    }

    const allPassed = results.every(r => r.passed);
    const failedRules = results.filter(r => !r.passed);

    return {
      allowed: allPassed,
      summary: allPassed ? '所有规则通过，允许锁桩' : `规则拦截：${failedRules.map(r => r.reason).join('; ')}`,
      details: results
    };
  }

  async logOperation(operationType, entityType, entityId, operator, status, reason, details) {
    return await this.logRepo.create({
      operation_type: operationType,
      entity_type: entityType,
      entity_id: entityId,
      operator: operator,
      status: status,
      reason: reason,
      details: details ? JSON.stringify(details) : null
    });
  }

  async recordException(exceptionType, entityType, entityId, severity, description) {
    return await this.exceptionRepo.create({
      exception_type: exceptionType,
      entity_type: entityType,
      entity_id: entityId,
      severity: severity,
      description: description
    });
  }
}

module.exports = {
  RuleEngine,
  RuleResult
};
