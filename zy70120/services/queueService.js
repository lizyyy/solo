const { v4: uuidv4 } = require('uuid');
const storage = require('../models/storage');
const eventBus = require('../utils/eventBus');
const { getTableType, calculateWaitingTime, formatNumber } = require('../utils/helpers');
const config = require('../config');

class QueueService {
  constructor() {
    this.counters = { SMALL: 0, MEDIUM: 0, LARGE: 0 };
    this._initCounters();
    eventBus.on('*', (event) => this._recordHistory(event));
  }

  _initCounters() {
    const queue = storage.getQueue();
    const today = new Date().toDateString();
    queue.forEach(item => {
      const itemDate = new Date(item.createdAt).toDateString();
      if (itemDate === today && item.queueNumber) {
        const type = item.tableType;
        const num = parseInt(item.queueNumber.substring(1));
        if (num > this.counters[type]) {
          this.counters[type] = num;
        }
      }
    });
  }

  _getNextNumber(type) {
    this.counters[type]++;
    return formatNumber(type, this.counters[type]);
  }

  _recordHistory(event) {
    storage.addHistory({
      id: uuidv4(),
      eventType: event.type,
      timestamp: event.timestamp,
      payload: event.payload,
      details: this._generateDetails(event.type, event.payload)
    });
  }

  _generateDetails(type, payload) {
    const details = {
      'QUEUE.JOIN': () => `客户${payload.customerName || '未知'}加入排队，人数${payload.partySize}，桌型${payload.tableType}，号码${payload.queueNumber}`,
      'QUEUE.CALL': () => `呼叫号码${payload.queueNumber}，客户${payload.customerName}`,
      'QUEUE.SEATED': () => `号码${payload.queueNumber}入座，桌号${payload.tableId}，合桌：${payload.isCombined ? '是' : '否'}`,
      'QUEUE.OVERTIME': () => `号码${payload.queueNumber}过号，已跳过${payload.skipCount}次`,
      'QUEUE.CANCEL': () => `号码${payload.queueNumber}取消排队，原因：${payload.reason || '未说明'}`,
      'QUEUE.RESTORE': () => `号码${payload.queueNumber}恢复排队，新位置${payload.newPosition}`,
      'QUEUE.MANUAL_ADJUST': () => `人工调整号码${payload.queueNumber}状态：${payload.fromStatus} -> ${payload.toStatus}`,
      'TABLE.COMBINE': () => `合桌操作：${payload.tables.join('+')} -> 新桌号${payload.combinedTableId}`,
      'TABLE.SPLIT': () => `拆桌操作：${payload.combinedTableId} -> ${payload.tables.join('+')}`,
      'NOTIFICATION.SEND': () => `发送通知给${payload.customerName}，类型：${payload.type}`,
      'REPORT.GENERATE': () => `生成报表：${payload.reportType}，时间范围${payload.timeRange}`
    };
    return details[type] ? details[type]() : `事件：${type}`;
  }

  joinQueue(customerName, partySize, phone = null, isMember = false, memberLevel = null) {
    if (!customerName || !partySize || partySize < 1) {
      throw new Error('参数错误：客户名和人数必填，人数必须大于0');
    }

    const tableType = getTableType(partySize);
    const queueNumber = this._getNextNumber(tableType);
    const queue = storage.getQueue();
    
    const position = queue.filter(q => q.tableType === tableType && 
      ['WAITING', 'OVERTIME'].includes(q.status)).length + 1;

    const ticket = {
      id: uuidv4(),
      queueNumber,
      customerName,
      partySize,
      phone,
      isMember,
      memberLevel,
      tableType,
      status: 'WAITING',
      position,
      estimatedWaitTime: calculateWaitingTime(position),
      createdAt: new Date().toISOString(),
      calledAt: null,
      seatedAt: null,
      canceledAt: null,
      skipCount: 0,
      tableId: null,
      isCombined: false,
      notifications: [],
      manualAdjustments: []
    };

    queue.push(ticket);
    storage.saveQueue(queue);

    eventBus.emitEvent('QUEUE.JOIN', {
      ticketId: ticket.id,
      queueNumber,
      customerName,
      partySize,
      tableType,
      position
    });

    return ticket;
  }

  callNext(tableType) {
    const queue = storage.getQueue();
    const waitingTickets = queue.filter(t => 
      t.tableType === tableType && t.status === 'WAITING'
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (waitingTickets.length === 0) {
      throw new Error(`当前${tableType}桌型队列中没有等待的客户`);
    }

    const ticket = waitingTickets[0];
    ticket.status = 'CALLED';
    ticket.calledAt = new Date().toISOString();
    
    storage.saveQueue(queue);

    eventBus.emitEvent('QUEUE.CALL', {
      ticketId: ticket.id,
      queueNumber: ticket.queueNumber,
      customerName: ticket.customerName,
      tableType
    });

    return ticket;
  }

  markSeated(ticketId, tableId, isCombined = false) {
    const queue = storage.getQueue();
    const ticket = queue.find(t => t.id === ticketId);
    
    if (!ticket) {
      throw new Error('未找到该排队号码');
    }
    
    if (ticket.status !== 'CALLED' && ticket.status !== 'OVERTIME') {
      throw new Error('当前状态不允许入座，需要先呼叫或过号恢复');
    }

    ticket.status = 'SEATED';
    ticket.seatedAt = new Date().toISOString();
    ticket.tableId = tableId;
    ticket.isCombined = isCombined;

    const tables = storage.getTables();
    const table = tables.find(t => t.id === tableId);
    if (table) {
      table.status = 'OCCUPIED';
      table.currentTicketId = ticketId;
      storage.saveTables(tables);
    }

    storage.saveQueue(queue);

    eventBus.emitEvent('QUEUE.SEATED', {
      ticketId,
      queueNumber: ticket.queueNumber,
      tableId,
      customerName: ticket.customerName,
      isCombined
    });

    return ticket;
  }

  markOvertime(ticketId) {
    const queue = storage.getQueue();
    const ticket = queue.find(t => t.id === ticketId);
    
    if (!ticket) {
      throw new Error('未找到该排队号码');
    }
    
    if (ticket.status !== 'CALLED') {
      throw new Error('只有已呼叫的号码才能标记为过号');
    }

    ticket.skipCount = (ticket.skipCount || 0) + 1;

    if (ticket.skipCount >= config.MAX_SKIP_COUNT) {
      ticket.status = 'CANCELED';
      ticket.canceledAt = new Date().toISOString();
      
      storage.saveQueue(queue);
      
      eventBus.emitEvent('QUEUE.CANCEL', {
        ticketId,
        queueNumber: ticket.queueNumber,
        customerName: ticket.customerName,
        reason: '多次过号自动取消'
      });
      
      return { ticket, action: 'canceled', message: '已超过最大过号次数，自动取消' };
    } else {
      ticket.status = 'OVERTIME';
      
      storage.saveQueue(queue);
      
      eventBus.emitEvent('QUEUE.OVERTIME', {
        ticketId,
        queueNumber: ticket.queueNumber,
        customerName: ticket.customerName,
        skipCount: ticket.skipCount
      });
      
      return { ticket, action: 'skipped', message: `过号${ticket.skipCount}次，可恢复排队` };
    }
  }

  restoreQueue(ticketId) {
    const queue = storage.getQueue();
    const ticket = queue.find(t => t.id === ticketId);
    
    if (!ticket) {
      throw new Error('未找到该排队号码');
    }
    
    if (ticket.status !== 'OVERTIME') {
      throw new Error('只有过号状态的号码才能恢复排队');
    }

    const sameTypeWaiting = queue.filter(t => 
      t.tableType === ticket.tableType && t.status === 'WAITING'
    ).length;
    
    const newPosition = sameTypeWaiting + 3;
    ticket.status = 'WAITING';
    ticket.position = newPosition;

    storage.saveQueue(queue);

    eventBus.emitEvent('QUEUE.RESTORE', {
      ticketId,
      queueNumber: ticket.queueNumber,
      customerName: ticket.customerName,
      newPosition
    });

    return ticket;
  }

  cancelQueue(ticketId, reason = '客户主动取消') {
    const queue = storage.getQueue();
    const ticket = queue.find(t => t.id === ticketId);
    
    if (!ticket) {
      throw new Error('未找到该排队号码');
    }
    
    if (['SEATED', 'CANCELED'].includes(ticket.status)) {
      throw new Error('当前状态不允许取消');
    }

    ticket.status = 'CANCELED';
    ticket.canceledAt = new Date().toISOString();

    storage.saveQueue(queue);

    eventBus.emitEvent('QUEUE.CANCEL', {
      ticketId,
      queueNumber: ticket.queueNumber,
      customerName: ticket.customerName,
      reason
    });

    return ticket;
  }

  getQueueStatus(tableType = null) {
    const queue = storage.getQueue();
    let filtered = queue;
    
    if (tableType) {
      filtered = queue.filter(t => t.tableType === tableType);
    }

    return {
      total: filtered.length,
      waiting: filtered.filter(t => t.status === 'WAITING').length,
      called: filtered.filter(t => t.status === 'CALLED').length,
      overtime: filtered.filter(t => t.status === 'OVERTIME').length,
      seated: filtered.filter(t => t.status === 'SEATED').length,
      canceled: filtered.filter(t => t.status === 'CANCELED').length,
      tickets: filtered
    };
  }

  getTicket(ticketId) {
    const queue = storage.getQueue();
    const ticket = queue.find(t => t.id === ticketId);
    
    if (!ticket) {
      throw new Error('未找到该排队号码');
    }
    
    return ticket;
  }

  getTicketByNumber(queueNumber) {
    const queue = storage.getQueue();
    const ticket = queue.find(t => t.queueNumber === queueNumber);
    
    if (!ticket) {
      throw new Error('未找到该排队号码');
    }
    
    return ticket;
  }

  manualAdjustStatus(ticketId, newStatus, reason, operator = '系统管理员') {
    const validStatuses = ['WAITING', 'CALLED', 'OVERTIME', 'SEATED', 'CANCELED'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`无效状态，有效值：${validStatuses.join(', ')}`);
    }

    const queue = storage.getQueue();
    const ticket = queue.find(t => t.id === ticketId);
    
    if (!ticket) {
      throw new Error('未找到该排队号码');
    }

    const fromStatus = ticket.status;
    ticket.status = newStatus;
    ticket.manualAdjustments = ticket.manualAdjustments || [];
    ticket.manualAdjustments.push({
      from: fromStatus,
      to: newStatus,
      reason,
      operator,
      timestamp: new Date().toISOString()
    });

    if (newStatus === 'CANCELED') {
      ticket.canceledAt = new Date().toISOString();
    } else if (newStatus === 'SEATED') {
      ticket.seatedAt = new Date().toISOString();
    }

    storage.saveQueue(queue);

    eventBus.emitEvent('QUEUE.MANUAL_ADJUST', {
      ticketId,
      queueNumber: ticket.queueNumber,
      customerName: ticket.customerName,
      fromStatus,
      toStatus: newStatus,
      reason,
      operator
    });

    return ticket;
  }
}

module.exports = new QueueService();
