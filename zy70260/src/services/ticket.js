const { getDb } = require('../database');
const HistoryService = require('./history');
const ScheduleService = require('./schedule');
const {
  STATUS,
  ERROR_CODES,
  BusinessError,
  ENTITY_TYPES,
  OPERATIONS,
  generateId
} = require('../utils');

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

module.exports = TicketService;
