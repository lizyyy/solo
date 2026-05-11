const { getDb } = require('../database');
const HistoryService = require('./history');
const WindSpeedService = require('./windSpeed');
const TicketService = require('./ticket');
const {
  STATUS,
  ERROR_CODES,
  BusinessError,
  ENTITY_TYPES,
  OPERATIONS,
  generateId
} = require('../utils');

class ScheduleService {
  static getById(id) {
    const db = getDb();
    const stmt = db.prepare(`SELECT * FROM cable_car_schedule WHERE id = ?`);
    return stmt.get(id);
  }

  static getAll(status = null) {
    const db = getDb();
    let query = `SELECT * FROM cable_car_schedule`;
    const params = [];
    
    if (status) {
      query += ` WHERE status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY departure_time`;
    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  static create(data) {
    const { route, departureTime, arrivalTime, capacity = 50 } = data;

    if (!route || !departureTime || !arrivalTime) {
      throw new BusinessError(
        ERROR_CODES.INVALID_PARAMETER,
        '缺少必要参数：线路、发车时间、到达时间不能为空'
      );
    }

    const id = generateId();
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO cable_car_schedule
      (id, route, departure_time, arrival_time, capacity, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, route, departureTime, arrivalTime, capacity, STATUS.SCHEDULE.PLANNED);
    
    const schedule = ScheduleService.getById(id);
    
    HistoryService.record(
      ENTITY_TYPES.SCHEDULE,
      id,
      OPERATIONS.CREATE,
      null,
      schedule
    );

    return schedule;
  }

  static canTransitionStatus(currentStatus, targetStatus) {
    const transitions = {
      [STATUS.SCHEDULE.PLANNED]: [STATUS.SCHEDULE.RUNNING, STATUS.SCHEDULE.DELAYED, STATUS.SCHEDULE.CANCELLED],
      [STATUS.SCHEDULE.RUNNING]: [STATUS.SCHEDULE.COMPLETED, STATUS.SCHEDULE.DELAYED, STATUS.SCHEDULE.CANCELLED],
      [STATUS.SCHEDULE.DELAYED]: [STATUS.SCHEDULE.RUNNING, STATUS.SCHEDULE.CANCELLED],
      [STATUS.SCHEDULE.CANCELLED]: [],
      [STATUS.SCHEDULE.COMPLETED]: []
    };

    return transitions[currentStatus]?.includes(targetStatus) || false;
  }

  static updateStatus(id, newStatus, reason = null, lockTickets = true) {
    const schedule = ScheduleService.getById(id);
    
    if (!schedule) {
      throw new BusinessError(
        ERROR_CODES.SCHEDULE_NOT_FOUND,
        `班次不存在：${id}`
      );
    }

    if (schedule.status === STATUS.SCHEDULE.CANCELLED) {
      throw new BusinessError(
        ERROR_CODES.SCHEDULE_ALREADY_CANCELLED,
        '班次已取消，无法修改状态'
      );
    }

    if (schedule.status === STATUS.SCHEDULE.COMPLETED) {
      throw new BusinessError(
        ERROR_CODES.SCHEDULE_ALREADY_COMPLETED,
        '班次已完成，无法修改状态'
      );
    }

    if (!ScheduleService.canTransitionStatus(schedule.status, newStatus)) {
      throw new BusinessError(
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        `无效的状态转换：${schedule.status} → ${newStatus}`
      );
    }

    const beforeValue = { ...schedule };

    const db = getDb();
    const stmt = db.prepare(`
      UPDATE cable_car_schedule
      SET status = ?, reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(newStatus, reason, id);

    const updatedSchedule = ScheduleService.getById(id);

    HistoryService.record(
      ENTITY_TYPES.SCHEDULE,
      id,
      OPERATIONS.SCHEDULE_STATUS_CHANGE,
      beforeValue,
      updatedSchedule
    );

    if (newStatus === STATUS.SCHEDULE.CANCELLED && lockTickets) {
      TicketService.lockTicketsForSchedule(id);
    }

    return updatedSchedule;
  }

  static cancelDueToWind(id) {
    if (!WindSpeedService.isOperational()) {
      return ScheduleService.updateStatus(
        id,
        STATUS.SCHEDULE.CANCELLED,
        '风速超标，索道停运',
        false
      );
    }
    
    throw new BusinessError(
      ERROR_CODES.WIND_SPEED_EXCEEDED,
      '当前风速正常，无需因风速取消班次',
      { currentStatus: WindSpeedService.getCurrentStatus() }
    );
  }

  static cancelAllAffectedByWind() {
    const currentStatus = WindSpeedService.getCurrentStatus();
    
    if (currentStatus.status !== STATUS.WIND.STOPPED) {
      throw new BusinessError(
        ERROR_CODES.WIND_SPEED_EXCEEDED,
        '当前风速未达到停运标准',
        { currentStatus }
      );
    }

    const affectedSchedules = ScheduleService.getAll(STATUS.SCHEDULE.PLANNED);
    const affectedSchedules2 = ScheduleService.getAll(STATUS.SCHEDULE.DELAYED);
    const allAffected = [...affectedSchedules, ...affectedSchedules2];

    const results = [];
    const cancelledScheduleIds = [];
    
    for (const schedule of allAffected) {
      try {
        const updated = ScheduleService.cancelDueToWind(schedule.id);
        results.push({ id: schedule.id, success: true, schedule: updated });
        cancelledScheduleIds.push(schedule.id);
      } catch (error) {
        results.push({ id: schedule.id, success: false, error: error.message });
      }
    }

    for (const scheduleId of cancelledScheduleIds) {
      TicketService.lockTicketsForSchedule(scheduleId);
    }

    return {
      total: allAffected.length,
      cancelled: results.filter(r => r.success).length,
      results,
      windStatus: currentStatus
    };
  }
}

module.exports = ScheduleService;
