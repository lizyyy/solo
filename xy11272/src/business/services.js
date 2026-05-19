const {
  ForkliftRepository,
  ChargingStationRepository,
  ShiftRepository,
  AssignmentRepository,
  ChargingLockRepository,
  OperationLogRepository,
  ExceptionRepository
} = require('../storage/repositories');
const { RuleEngine } = require('./rules');

function now() {
  return new Date().toISOString();
}

class ForkliftService {
  constructor() {
    this.repo = new ForkliftRepository();
    this.ruleEngine = new RuleEngine();
  }

  async createForklift(id, name, batteryLevel = 100) {
    const existing = await this.repo.findById(id);
    if (existing) {
      return { success: true, data: existing, message: '叉车已存在，幂等返回' };
    }

    const forklift = await this.repo.create({
      id,
      name,
      battery_level: batteryLevel,
      status: 'idle',
      last_updated: now()
    });

    await this.ruleEngine.logOperation('create', 'forklift', id, 'system', 'success', '创建叉车', null);
    return { success: true, data: forklift, message: '叉车创建成功' };
  }

  async updateBattery(id, batteryLevel, operator) {
    const forklift = await this.repo.findById(id);
    if (!forklift) {
      return { success: false, message: '叉车不存在' };
    }

    const oldBattery = forklift.battery_level;
    const updated = await this.repo.updateBattery(id, batteryLevel);

    await this.ruleEngine.logOperation('update_battery', 'forklift', id, operator, 'success', 
      `电量从${oldBattery}%更新为${batteryLevel}%`, { oldBattery, newBattery: batteryLevel });

    if (batteryLevel <= 20) {
      await this.ruleEngine.recordException('LOW_BATTERY', 'forklift', id, 'high', 
        `叉车${id}电量过低：${batteryLevel}%`);
    }

    return { success: true, data: updated, message: '电量更新成功' };
  }

  async listForklifts(status = null) {
    if (status) {
      return { success: true, data: await this.repo.findByStatus(status) };
    }
    return { success: true, data: await this.repo.findAll() };
  }

  async getLowBatteryForklifts(threshold = 30) {
    return { success: true, data: await this.repo.findLowBattery(threshold) };
  }
}

class ChargingStationService {
  constructor() {
    this.repo = new ChargingStationRepository();
    this.lockRepo = new ChargingLockRepository();
    this.ruleEngine = new RuleEngine();
  }

  async createStation(id, name) {
    const existing = await this.repo.findById(id);
    if (existing) {
      return { success: true, data: existing, message: '充电桩已存在，幂等返回' };
    }

    const station = await this.repo.create({
      id,
      name,
      status: 'available',
      last_updated: now()
    });

    await this.ruleEngine.logOperation('create', 'station', id, 'system', 'success', '创建充电桩', null);
    return { success: true, data: station, message: '充电桩创建成功' };
  }

  async listStations(status = null) {
    if (status === 'available') {
      return { success: true, data: await this.repo.findAvailable() };
    }
    return { success: true, data: await this.repo.findAll() };
  }
}

class ShiftService {
  constructor() {
    this.repo = new ShiftRepository();
    this.assignmentRepo = new AssignmentRepository();
    this.ruleEngine = new RuleEngine();
  }

  async createShift(id, name, shiftType, startTime, endTime, date, manager) {
    const existing = await this.repo.findById(id);
    if (existing) {
      return { success: true, data: existing, message: '班次已存在，幂等返回' };
    }

    const shift = await this.repo.create({
      id,
      name,
      shift_type: shiftType,
      start_time: startTime,
      end_time: endTime,
      date,
      manager,
      status: 'scheduled'
    });

    await this.ruleEngine.logOperation('create', 'shift', id, manager, 'success', '创建班次', null);
    return { success: true, data: shift, message: '班次创建成功' };
  }

  async getShiftsByDate(date) {
    return { success: true, data: await this.repo.findByDate(date) };
  }

  async getShiftsByDateRange(startDate, endDate) {
    return { success: true, data: await this.repo.findByDateRange(startDate, endDate) };
  }

  async createAssignment(shiftId, forkliftId, driver, taskDescription, startTime, operator) {
    const shift = await this.repo.findById(shiftId);
    if (!shift) {
      return { success: false, message: '班次不存在' };
    }

    const existingAssignments = await this.assignmentRepo.findByForkliftAndTime(forkliftId, startTime, shift.end_time);
    if (existingAssignments.length > 0) {
      return { 
        success: false, 
        message: '该叉车在此时间段已有排班',
        data: { conflictingAssignments: existingAssignments }
      };
    }

    const assignment = await this.assignmentRepo.create({
      shift_id: shiftId,
      forklift_id: forkliftId,
      driver,
      task_description: taskDescription,
      start_time: startTime,
      end_time: shift.end_time,
      status: 'pending'
    });

    await this.ruleEngine.logOperation('assign', 'shift', shiftId, operator, 'success', 
      `分配叉车${forkliftId}给${driver}`, { forkliftId, driver });

    return { success: true, data: assignment, message: '排班成功' };
  }

  async getShiftAssignments(shiftId) {
    return { success: true, data: await this.assignmentRepo.findByShift(shiftId) };
  }
}

class ChargingLockService {
  constructor() {
    this.lockRepo = new ChargingLockRepository();
    this.stationRepo = new ChargingStationRepository();
    this.forkliftRepo = new ForkliftRepository();
    this.ruleEngine = new RuleEngine();
  }

  async lockStation(stationId, forkliftId, shiftId, driver, expectedDurationHours = 8) {
    const validation = await this.ruleEngine.validateLockRequest(stationId, forkliftId, shiftId, driver);

    await this.ruleEngine.logOperation('lock_validate', 'station', stationId, driver, 
      validation.allowed ? 'success' : 'blocked', validation.summary, JSON.stringify(validation.details));

    if (!validation.allowed) {
      await this.ruleEngine.recordException('LOCK_FAILED', 'station', stationId, 'medium', validation.summary);
      return { success: false, message: validation.summary, details: validation.details };
    }

    const expectedReleaseTime = new Date(Date.now() + expectedDurationHours * 60 * 60 * 1000).toISOString();

    const lock = await this.lockRepo.create({
      station_id: stationId,
      forklift_id: forkliftId,
      driver,
      shift_id: shiftId,
      lock_time: now(),
      expected_release_time: expectedReleaseTime,
      status: 'locked',
      reason: validation.summary
    });

    await this.stationRepo.lockStation(stationId, forkliftId, driver, expectedReleaseTime);
    await this.forkliftRepo.update(forkliftId, { status: 'charging' });

    await this.ruleEngine.logOperation('lock', 'station', stationId, driver, 'success', 
      `锁桩成功，预计释放时间：${expectedReleaseTime}`, { lockId: lock.id });

    return { success: true, data: lock, message: '锁桩成功', details: validation.details };
  }

  async releaseStation(stationId, operator) {
    const activeLock = await this.lockRepo.findActiveByStation(stationId);
    if (!activeLock) {
      return { success: false, message: '该充电桩当前无锁定' };
    }

    await this.lockRepo.releaseLock(activeLock.id);
    await this.stationRepo.releaseStation(stationId);
    await this.forkliftRepo.update(activeLock.forklift_id, { status: 'idle' });

    await this.ruleEngine.logOperation('release', 'station', stationId, operator, 'success', 
      '释放充电桩成功', { lockId: activeLock.id });

    return { success: true, message: '释放成功' };
  }

  async getActiveLocks() {
    return { success: true, data: await this.lockRepo.findAll({ status: 'locked' }) };
  }

  async getLocksByShift(shiftId) {
    return { success: true, data: await this.lockRepo.findByShift(shiftId) };
  }
}

class QueryService {
  constructor() {
    this.logRepo = new OperationLogRepository();
    this.exceptionRepo = new ExceptionRepository();
    this.shiftRepo = new ShiftRepository();
    this.lockRepo = new ChargingLockRepository();
  }

  async queryLogs(filters = {}) {
    const { operator, startDate, endDate, entityType, status } = filters;
    
    let sql = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];

    if (operator) {
      sql += ' AND operator = ?';
      params.push(operator);
    }
    if (startDate) {
      sql += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND created_at <= ?';
      params.push(endDate + 'T23:59:59.999Z');
    }
    if (entityType) {
      sql += ' AND entity_type = ?';
      params.push(entityType);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';
    
    const db = this.logRepo;
    const data = await db.findAll();

    let filteredData = data;
    if (operator) {
      filteredData = filteredData.filter(d => d.operator === operator);
    }
    if (startDate) {
      filteredData = filteredData.filter(d => d.created_at >= startDate);
    }
    if (endDate) {
      const end = endDate + 'T23:59:59.999Z';
      filteredData = filteredData.filter(d => d.created_at <= end);
    }
    if (entityType) {
      filteredData = filteredData.filter(d => d.entity_type === entityType);
    }
    if (status) {
      filteredData = filteredData.filter(d => d.status === status);
    }

    return {
      success: true,
      data: filteredData,
      summary: {
        total: filteredData.length,
        successCount: filteredData.filter(l => l.status === 'success').length,
        blockedCount: filteredData.filter(l => l.status === 'blocked').length
      }
    };
  }

  async queryExceptions(filters = {}) {
    const { exceptionType, severity, handled, startDate, endDate } = filters;
    
    let sql = 'SELECT * FROM exceptions WHERE 1=1';
    const params = [];

    if (exceptionType) {
      sql += ' AND exception_type = ?';
      params.push(exceptionType);
    }
    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }
    if (handled !== undefined) {
      sql += ' AND handled = ?';
      params.push(handled ? 1 : 0);
    }
    if (startDate) {
      sql += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND created_at <= ?';
      params.push(endDate + 'T23:59:59.999Z');
    }

    sql += ' ORDER BY created_at DESC';
    
    const data = await this.exceptionRepo.findAll();

    let filteredData = data;
    if (exceptionType) {
      filteredData = filteredData.filter(d => d.exception_type === exceptionType);
    }
    if (severity) {
      filteredData = filteredData.filter(d => d.severity === severity);
    }
    if (handled !== undefined) {
      filteredData = filteredData.filter(d => d.handled === (handled ? 1 : 0));
    }
    if (startDate) {
      filteredData = filteredData.filter(d => d.created_at >= startDate);
    }
    if (endDate) {
      const end = endDate + 'T23:59:59.999Z';
      filteredData = filteredData.filter(d => d.created_at <= end);
    }

    return {
      success: true,
      data: filteredData,
      summary: {
        total: filteredData.length,
        unhandled: filteredData.filter(e => !e.handled).length,
        highSeverity: filteredData.filter(e => e.severity === 'high').length
      }
    };
  }

  async handleException(exceptionId, handler) {
    const exception = await this.exceptionRepo.findById(exceptionId);
    if (!exception) {
      return { success: false, message: '异常记录不存在' };
    }

    await this.exceptionRepo.markHandled(exceptionId, handler);
    return { success: true, message: '异常已标记为已处理' };
  }
}

class DailyReportService {
  constructor() {
    this.shiftRepo = new ShiftRepository();
    this.lockRepo = new ChargingLockRepository();
    this.logRepo = new OperationLogRepository();
    this.exceptionRepo = new ExceptionRepository();
    this.forkliftRepo = new ForkliftRepository();
  }

  async generateDailyReport(date) {
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const shifts = await this.shiftRepo.findByDate(date);
    const activeLocks = await this.lockRepo.findAll({ status: 'locked' });
    const logs = await this.logRepo.findByDateRange(startOfDay, endOfDay);
    const allExceptions = await this.exceptionRepo.findAll();
    const exceptions = allExceptions.filter(e => 
      e.created_at >= startOfDay && e.created_at <= endOfDay
    );
    const lowBatteryForklifts = await this.forkliftRepo.findLowBattery(30);

    const shiftSummaries = shifts.map(shift => ({
      shiftId: shift.id,
      shiftName: shift.name,
      manager: shift.manager,
      lockCount: activeLocks.filter(l => l.shift_id === shift.id).length,
      status: shift.status
    }));

    const report = {
      date,
      generatedAt: now(),
      summary: {
        totalShifts: shifts.length,
        activeLocks: activeLocks.length,
        totalOperations: logs.length,
        successfulOperations: logs.filter(l => l.status === 'success').length,
        blockedOperations: logs.filter(l => l.status === 'blocked').length,
        totalExceptions: exceptions.length,
        unhandledExceptions: exceptions.filter(e => !e.handled).length,
        lowBatteryForklifts: lowBatteryForklifts.length
      },
      shifts: shiftSummaries,
      exceptions: exceptions.map(e => ({
        id: e.id,
        type: e.exception_type,
        severity: e.severity,
        description: e.description,
        handled: !!e.handled,
        createdAt: e.created_at
      })),
      lowBatteryAlert: lowBatteryForklifts.map(f => ({
        forkliftId: f.id,
        name: f.name,
        batteryLevel: f.battery_level
      }))
    };

    return { success: true, data: report };
  }
}

module.exports = {
  ForkliftService,
  ChargingStationService,
  ShiftService,
  ChargingLockService,
  QueryService,
  DailyReportService
};
