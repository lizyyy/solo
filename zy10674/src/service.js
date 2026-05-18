const { TICKET_STATUS, ERROR_CODES, PAUSE_REASON } = require('./constants');
const store = require('./store');

class SLAService {
  constructor() {
    this.store = store;
  }

  validatePauseInput(data) {
    const errors = [];
    if (!data.ticketId) errors.push('ticketId 是必填字段');
    if (!data.reason) errors.push('reason 是必填字段');
    if (!data.pausedBy) errors.push('pausedBy 是必填字段');
    if (!Object.values(PAUSE_REASON).includes(data.reason)) {
      errors.push(`无效的暂停原因: ${data.reason}`);
    }
    return errors;
  }

  canPause(ticket) {
    return ticket.status === TICKET_STATUS.TIMING;
  }

  canResume(ticket) {
    return ticket.status === TICKET_STATUS.PAUSED;
  }

  pauseTicket(data) {
    const validationErrors = this.validatePauseInput(data);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: ERROR_CODES.INVALID_INPUT,
        message: validationErrors.join(', ')
      };
    }

    const ticket = this.store.getTicket(data.ticketId);
    if (!ticket) {
      return {
        success: false,
        error: ERROR_CODES.TICKET_NOT_FOUND,
        message: `工单 ${data.ticketId} 不存在`
      };
    }

    const activePause = this.store.getActivePauseRecord(data.ticketId);
    if (activePause) {
      return {
        success: false,
        error: ERROR_CODES.DUPLICATE_PAUSE,
        message: `工单 ${data.ticketId} 已有活跃的暂停记录`,
        conflictRecord: activePause.toJSON()
      };
    }

    if (!this.canPause(ticket)) {
      return {
        success: false,
        error: ERROR_CODES.INVALID_STATUS_TRANSITION,
        message: `工单状态 ${ticket.status} 不允许暂停`
      };
    }

    const pauseRecord = this.store.createPauseRecord({
      ticketId: data.ticketId,
      reason: data.reason,
      reasonDetail: data.reasonDetail || '',
      proofMaterials: data.proofMaterials || [],
      pausedBy: data.pausedBy,
      customerWaiting: data.customerWaiting !== undefined ? data.customerWaiting : true,
      notes: data.notes || ''
    });

    this.store.updateTicket(data.ticketId, {
      status: TICKET_STATUS.PAUSED
    });

    return {
      success: true,
      data: {
        ticket: this.store.getTicket(data.ticketId).toJSON(),
        pauseRecord: pauseRecord.toJSON()
      }
    };
  }

  resumeTicket(data) {
    const errors = [];
    if (!data.ticketId) errors.push('ticketId 是必填字段');
    if (!data.resumedBy) errors.push('resumedBy 是必填字段');
    if (errors.length > 0) {
      return {
        success: false,
        error: ERROR_CODES.INVALID_INPUT,
        message: errors.join(', ')
      };
    }

    const ticket = this.store.getTicket(data.ticketId);
    if (!ticket) {
      return {
        success: false,
        error: ERROR_CODES.TICKET_NOT_FOUND,
        message: `工单 ${data.ticketId} 不存在`
      };
    }

    if (!this.canResume(ticket)) {
      return {
        success: false,
        error: ERROR_CODES.INVALID_STATUS_TRANSITION,
        message: `工单状态 ${ticket.status} 不允许恢复`
      };
    }

    const activePause = this.store.getActivePauseRecord(data.ticketId);
    if (!activePause) {
      return {
        success: false,
        error: ERROR_CODES.INVALID_STATUS_TRANSITION,
        message: `工单 ${data.ticketId} 没有活跃的暂停记录`
      };
    }

    const resumedAt = new Date().toISOString();
    const pausedAt = new Date(activePause.pausedAt);
    const pausedDuration = Math.floor((new Date(resumedAt) - pausedAt) / 1000);

    this.store.updatePauseRecord(activePause.id, {
      status: 'completed',
      resumedBy: data.resumedBy,
      resumedAt: resumedAt,
      notes: data.notes ? `${activePause.notes} ${data.notes}`.trim() : activePause.notes
    });

    this.store.updateTicket(data.ticketId, {
      status: TICKET_STATUS.RESUMED,
      actualResumeTime: resumedAt,
      totalPausedDuration: ticket.totalPausedDuration + pausedDuration
    });

    return {
      success: true,
      data: {
        ticket: this.store.getTicket(data.ticketId).toJSON(),
        pauseRecord: this.store.getPauseRecord(activePause.id).toJSON(),
        pausedDuration: pausedDuration
      }
    };
  }

  getTicketDetail(ticketId) {
    const ticket = this.store.getTicket(ticketId);
    if (!ticket) {
      return {
        success: false,
        error: ERROR_CODES.TICKET_NOT_FOUND,
        message: `工单 ${ticketId} 不存在`
      };
    }

    const pauseRecords = this.store.getPauseRecordsByTicket(ticketId);

    return {
      success: true,
      data: {
        ticket: ticket.toJSON(),
        pauseRecords: pauseRecords.map(r => r.toJSON())
      }
    };
  }

  listTickets(filters = {}) {
    const tickets = this.store.listTickets(filters);
    return {
      success: true,
      data: {
        tickets: tickets.map(t => t.toJSON()),
        total: tickets.length
      }
    };
  }

  getTicketHistory(ticketId) {
    const result = this.getTicketDetail(ticketId);
    if (!result.success) return result;

    const history = [];
    const { ticket, pauseRecords } = result.data;

    history.push({
      type: 'created',
      timestamp: ticket.createdAt,
      message: '工单创建，开始计时',
      status: TICKET_STATUS.TIMING
    });

    pauseRecords.forEach(record => {
      history.push({
        type: 'paused',
        timestamp: record.pausedAt,
        message: `暂停计时，原因: ${record.reason}`,
        operator: record.pausedBy,
        pauseRecordId: record.id,
        customerWaiting: record.customerWaiting
      });

      if (record.status === 'completed' && record.resumedAt) {
        history.push({
          type: 'resumed',
          timestamp: record.resumedAt,
          message: '恢复计时',
          operator: record.resumedBy,
          pauseRecordId: record.id
        });
      }
    });

    if (ticket.status === TICKET_STATUS.RESUMED) {
      history.push({
        type: 'status_updated',
        timestamp: ticket.updatedAt,
        message: '工单已恢复',
        status: TICKET_STATUS.RESUMED
      });
    }

    history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return {
      success: true,
      data: {
        ticketId,
        history
      }
    };
  }

  exportData() {
    return {
      success: true,
      data: this.store.exportAll()
    };
  }

  importData(data, overwrite = false) {
    const result = this.store.importData(data, overwrite);
    return {
      success: result.failed === 0,
      data: result
    };
  }

  createTicket(data) {
    const ticket = this.store.createTicket(data);
    return {
      success: true,
      data: ticket.toJSON()
    };
  }

  checkTimeout() {
    const tickets = this.store.listTickets();
    const now = new Date();
    const timeoutTickets = [];

    tickets.forEach(ticket => {
      if (ticket.slaDeadline && new Date(ticket.slaDeadline) < now) {
        if (ticket.status !== TICKET_STATUS.TIMEOUT) {
          this.store.updateTicket(ticket.id, { status: TICKET_STATUS.TIMEOUT });
          timeoutTickets.push(ticket.id);
        }
      }
    });

    return {
      success: true,
      data: { timeoutTickets }
    };
  }
}

module.exports = new SLAService();
