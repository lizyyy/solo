const { getDb } = require('../database');
const {
  STATUS,
  ERROR_CODES,
  BusinessError,
  ENTITY_TYPES,
  OPERATIONS,
  generateId,
  safeJsonStringify,
  safeJsonParse
} = require('../utils');

class HistoryService {
  static record(entityType, entityId, operation, beforeValue = null, afterValue = null, operator = 'SYSTEM') {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO history_record (entity_type, entity_id, operation, before_value, after_value, operator)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      entityType,
      entityId,
      operation,
      safeJsonStringify(beforeValue),
      safeJsonStringify(afterValue),
      operator
    );
  }

  static getByEntity(entityType, entityId, limit = 50) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM history_record
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    return stmt.all(entityType, entityId, limit).map(row => ({
      ...row,
      before_value: safeJsonParse(row.before_value),
      after_value: safeJsonParse(row.after_value)
    }));
  }

  static getAll(entityType = null, limit = 100) {
    const db = getDb();
    let query = 'SELECT * FROM history_record';
    const params = [];
    
    if (entityType) {
      query += ' WHERE entity_type = ?';
      params.push(entityType);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const stmt = db.prepare(query);
    return stmt.all(...params).map(row => ({
      ...row,
      before_value: safeJsonParse(row.before_value),
      after_value: safeJsonParse(row.after_value)
    }));
  }
}

class WindSpeedService {
  static getLatest(location = 'main') {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM wind_speed_monitor
      WHERE location = ?
      ORDER BY recorded_at DESC
      LIMIT 1
    `);
    return stmt.get(location);
  }

  static getHistory(location = 'main', limit = 20) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM wind_speed_monitor
      WHERE location = ?
      ORDER BY recorded_at DESC
      LIMIT ?
    `);
    return stmt.all(location, limit);
  }

  static determineStatus(windSpeed, thresholdWarning = 15, thresholdStop = 25) {
    if (windSpeed < 0) {
      throw new BusinessError(
        ERROR_CODES.WIND_SPEED_INVALID,
        '风速值无效：风速不能为负数'
      );
    }

    if (windSpeed >= thresholdStop) {
      return STATUS.WIND.STOPPED;
    } else if (windSpeed >= thresholdWarning) {
      return STATUS.WIND.WARNING;
    } else {
      return STATUS.WIND.NORMAL;
    }
  }

  static record(windSpeed, location = 'main', thresholdWarning = 15, thresholdStop = 25) {
    if (windSpeed < 0) {
      throw new BusinessError(
        ERROR_CODES.WIND_SPEED_INVALID,
        '风速值无效：风速不能为负数'
      );
    }

    const previous = WindSpeedService.getLatest(location);
    const newStatus = WindSpeedService.determineStatus(windSpeed, thresholdWarning, thresholdStop);

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO wind_speed_monitor
      (location, wind_speed, status, threshold_warning, threshold_stop)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(location, windSpeed, newStatus, thresholdWarning, thresholdStop);

    const record = db.prepare(`SELECT * FROM wind_speed_monitor WHERE id = ?`).get(result.lastInsertRowid);

    if (previous && previous.status !== newStatus) {
      HistoryService.record(
        ENTITY_TYPES.WIND_SPEED,
        location,
        OPERATIONS.WIND_STATUS_CHANGE,
        { status: previous.status, wind_speed: previous.wind_speed },
        { status: newStatus, wind_speed: windSpeed }
      );
    }

    return record;
  }

  static isOperational(location = 'main') {
    const latest = WindSpeedService.getLatest(location);
    if (!latest) return true;
    return latest.status === STATUS.WIND.NORMAL;
  }

  static getCurrentStatus(location = 'main') {
    const latest = WindSpeedService.getLatest(location);
    if (!latest) {
      return {
        status: STATUS.WIND.NORMAL,
        wind_speed: 0,
        location,
        message: '暂无风速数据，默认正常运行'
      };
    }

    let message = '';
    switch (latest.status) {
      case STATUS.WIND.NORMAL:
        message = '风速正常，索道正常运行';
        break;
      case STATUS.WIND.WARNING:
        message = `风速预警（${latest.wind_speed}m/s），请注意安全`;
        break;
      case STATUS.WIND.STOPPED:
        message = `风速超标（${latest.wind_speed}m/s），索道已停运`;
        break;
    }

    return {
      status: latest.status,
      wind_speed: latest.wind_speed,
      location: latest.location,
      threshold_warning: latest.threshold_warning,
      threshold_stop: latest.threshold_stop,
      recorded_at: latest.recorded_at,
      message
    };
  }
}

class TicketService {
  static getById(id) {
    const db = getDb();
    const stmt = db.prepare(`SELECT * FROM ticket WHERE id = ?`);
    return stmt.get(id);
  }

  static getBySchedule(scheduleId) {
    const db = getDb();
    const stmt = db.prepare(`SELECT * FROM ticket WHERE schedule_id = ? ORDER BY created_at`);
    return stmt.all(scheduleId);
  }

  static create(data) {
    const { scheduleId, passengerName, passengerPhone, price } = data;

    if (!scheduleId || !passengerName || price === undefined) {
      throw new BusinessError(
        ERROR_CODES.INVALID_PARAMETER,
        '缺少必要参数：班次ID、乘客姓名、价格不能为空'
      );
    }

    const schedule = ScheduleService.getById(scheduleId);
    if (!schedule) {
      throw new BusinessError(
        ERROR_CODES.SCHEDULE_NOT_FOUND,
        `班次不存在：${scheduleId}`
      );
    }

    if (schedule.status === STATUS.SCHEDULE.CANCELLED) {
      throw new BusinessError(
        ERROR_CODES.SCHEDULE_ALREADY_CANCELLED,
        '该班次已取消，无法购票'
      );
    }

    if (price < 0) {
      throw new BusinessError(
        ERROR_CODES.INVALID_PARAMETER,
        '票价不能为负数'
      );
    }

    const id = generateId();
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO ticket
      (id, schedule_id, passenger_name, passenger_phone, price, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, scheduleId, passengerName, passengerPhone || null, price, STATUS.TICKET.PURCHASED);

    const ticket = TicketService.getById(id);

    HistoryService.record(
      ENTITY_TYPES.TICKET,
      id,
      OPERATIONS.CREATE,
      null,
      ticket
    );

    return ticket;
  }

  static canTransitionStatus(currentStatus, targetStatus) {
    const transitions = {
      [STATUS.TICKET.PURCHASED]: [STATUS.TICKET.LOCKED, STATUS.TICKET.USED, STATUS.TICKET.REFUNDABLE],
      [STATUS.TICKET.LOCKED]: [STATUS.TICKET.REFUNDABLE, STATUS.TICKET.PURCHASED],
      [STATUS.TICKET.REFUNDABLE]: [STATUS.TICKET.REFUNDED],
      [STATUS.TICKET.REFUNDED]: [],
      [STATUS.TICKET.USED]: []
    };

    return transitions[currentStatus]?.includes(targetStatus) || false;
  }

  static updateStatus(id, newStatus, refundAmount = 0) {
    const ticket = TicketService.getById(id);
    
    if (!ticket) {
      throw new BusinessError(
        ERROR_CODES.TICKET_NOT_FOUND,
        `票务不存在：${id}`
      );
    }

    if (ticket.status === STATUS.TICKET.REFUNDED) {
      throw new BusinessError(
        ERROR_CODES.TICKET_ALREADY_REFUNDED,
        '该票务已退票，无法修改状态'
      );
    }

    if (ticket.status === STATUS.TICKET.USED) {
      throw new BusinessError(
        ERROR_CODES.TICKET_ALREADY_USED,
        '该票务已使用，无法修改状态'
      );
    }

    if (!TicketService.canTransitionStatus(ticket.status, newStatus)) {
      throw new BusinessError(
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        `无效的状态转换：${ticket.status} → ${newStatus}`
      );
    }

    const beforeValue = { ...ticket };

    const db = getDb();
    const stmt = db.prepare(`
      UPDATE ticket
      SET status = ?, refund_amount = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(newStatus, refundAmount, id);

    const updatedTicket = TicketService.getById(id);

    HistoryService.record(
      ENTITY_TYPES.TICKET,
      id,
      OPERATIONS.TICKET_STATUS_CHANGE,
      beforeValue,
      updatedTicket
    );

    return updatedTicket;
  }

  static lockTicketsForSchedule(scheduleId) {
    const tickets = TicketService.getBySchedule(scheduleId);
    const results = [];

    for (const ticket of tickets) {
      if (ticket.status === STATUS.TICKET.PURCHASED) {
        try {
          const updated = TicketService.updateStatus(ticket.id, STATUS.TICKET.LOCKED);
          results.push({ id: ticket.id, success: true, ticket: updated });
        } catch (error) {
          results.push({ id: ticket.id, success: false, error: error.message });
        }
      }
    }

    return {
      total: tickets.length,
      locked: results.filter(r => r.success).length,
      results
    };
  }

  static enableRefund(id) {
    const ticket = TicketService.getById(id);
    
    if (!ticket) {
      throw new BusinessError(
        ERROR_CODES.TICKET_NOT_FOUND,
        `票务不存在：${id}`
      );
    }

    if (ticket.status !== STATUS.TICKET.LOCKED) {
      throw new BusinessError(
        ERROR_CODES.TICKET_NOT_LOCKED,
        '票务未处于锁定状态，无法开启退款通道'
      );
    }

    return TicketService.updateStatus(ticket.id, STATUS.TICKET.REFUNDABLE);
  }

  static processRefund(id, refundAmount = null) {
    const ticket = TicketService.getById(id);
    
    if (!ticket) {
      throw new BusinessError(
        ERROR_CODES.TICKET_NOT_FOUND,
        `票务不存在：${id}`
      );
    }

    if (ticket.status !== STATUS.TICKET.REFUNDABLE) {
      throw new BusinessError(
        ERROR_CODES.TICKET_REFUND_NOT_ALLOWED,
        '票务不处于可退款状态',
        { currentStatus: ticket.status }
      );
    }

    const actualRefund = refundAmount !== null ? refundAmount : ticket.price;

    if (actualRefund > ticket.price) {
      throw new BusinessError(
        ERROR_CODES.INVALID_PARAMETER,
        '退款金额不能大于票价'
      );
    }

    if (actualRefund < 0) {
      throw new BusinessError(
        ERROR_CODES.INVALID_PARAMETER,
        '退款金额不能为负数'
      );
    }

    return TicketService.updateStatus(ticket.id, STATUS.TICKET.REFUNDED, actualRefund);
  }

  static getRefundRules() {
    return {
      description: '退票规则说明',
      scenarios: [
        {
          name: '正常退票',
          conditions: ['距离发车时间 > 24小时'],
          refundRate: '100%',
          notes: '全额退款'
        },
        {
          name: '临时退票',
          conditions: ['距离发车时间 4-24小时'],
          refundRate: '80%',
          notes: '收取20%手续费'
        },
        {
          name: '紧急退票',
          conditions: ['距离发车时间 < 4小时'],
          refundRate: '50%',
          notes: '收取50%手续费'
        },
        {
          name: '因天气停运退票',
          conditions: ['索道因风速停运', '班次取消'],
          refundRate: '100%',
          notes: '因不可抗力因素全额退款'
        }
      ],
      autoProcessWhen: [
        '班次因风速取消后，所有票务自动锁定',
        '锁定后系统自动开启退票通道',
        '用户可申请全额退款'
      ]
    };
  }
}

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

module.exports = {
  HistoryService,
  WindSpeedService,
  ScheduleService,
  TicketService
};
