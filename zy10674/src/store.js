const { Ticket, PauseRecord } = require('./models');

class InMemoryStore {
  constructor() {
    this.tickets = new Map();
    this.pauseRecords = new Map();
    this.nextTicketId = 1;
    this.nextPauseId = 1;
  }

  generateTicketId() {
    return `TKT${String(this.nextTicketId++).padStart(6, '0')}`;
  }

  generatePauseId() {
    return `PSE${String(this.nextPauseId++).padStart(6, '0')}`;
  }

  createTicket(data) {
    const id = data.id || this.generateTicketId();
    const ticket = new Ticket({ ...data, id });
    this.tickets.set(id, ticket);
    return ticket;
  }

  getTicket(id) {
    return this.tickets.get(id);
  }

  updateTicket(id, data) {
    const ticket = this.tickets.get(id);
    if (!ticket) return null;
    Object.assign(ticket, data, { updatedAt: new Date().toISOString() });
    return ticket;
  }

  listTickets(filters = {}) {
    let results = Array.from(this.tickets.values());
    if (filters.status) {
      results = results.filter(t => t.status === filters.status);
    }
    if (filters.customerId) {
      results = results.filter(t => t.customerId === filters.customerId);
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createPauseRecord(data) {
    const id = data.id || this.generatePauseId();
    const record = new PauseRecord({ ...data, id });
    this.pauseRecords.set(id, record);
    return record;
  }

  getPauseRecord(id) {
    return this.pauseRecords.get(id);
  }

  getPauseRecordsByTicket(ticketId) {
    return Array.from(this.pauseRecords.values())
      .filter(r => r.ticketId === ticketId)
      .sort((a, b) => new Date(b.pausedAt) - new Date(a.pausedAt));
  }

  getActivePauseRecord(ticketId) {
    return Array.from(this.pauseRecords.values())
      .find(r => r.ticketId === ticketId && r.status === 'active');
  }

  updatePauseRecord(id, data) {
    const record = this.pauseRecords.get(id);
    if (!record) return null;
    Object.assign(record, data);
    return record;
  }

  exportAll() {
    return {
      tickets: Array.from(this.tickets.values()).map(t => t.toJSON()),
      pauseRecords: Array.from(this.pauseRecords.values()).map(r => r.toJSON()),
      exportedAt: new Date().toISOString()
    };
  }

  importData(data, overwrite = false) {
    const errors = [];
    const results = { success: 0, failed: 0, errors };

    if (data.tickets) {
      data.tickets.forEach((ticketData, index) => {
        try {
          if (!ticketData.id || !ticketData.title) {
            throw new Error(`缺少必填字段: id 或 title`);
          }
          if (this.tickets.has(ticketData.id) && !overwrite) {
            throw new Error(`工单 ${ticketData.id} 已存在`);
          }
          const ticket = new Ticket(ticketData);
          this.tickets.set(ticket.id, ticket);
          results.success++;
        } catch (e) {
          errors.push({ row: index, type: 'ticket', error: e.message, data: ticketData });
          results.failed++;
        }
      });
    }

    return results;
  }

  clear() {
    this.tickets.clear();
    this.pauseRecords.clear();
    this.nextTicketId = 1;
    this.nextPauseId = 1;
  }
}

const store = new InMemoryStore();
module.exports = store;
