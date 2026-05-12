const { v4: uuidv4 } = require('uuid');

class DataStore {
  constructor() {
    this.tickets = [];
    this.ferryClasses = [];
    this.weatherSuspensions = [];
    this.orders = [];
    this.refunds = [];
    this.rebookings = [];
    this.validations = [];
    this.manualCorrections = [];
    this.idempotentKeys = new Map();
    this.auditLogs = [];
  }

  saveAuditLog(action, module, recordId, before, after, operator, reason) {
    const log = {
      id: uuidv4(),
      action,
      module,
      recordId,
      before: before ? JSON.parse(JSON.stringify(before)) : null,
      after: after ? JSON.parse(JSON.stringify(after)) : null,
      operator: operator || 'system',
      reason: reason || '',
      timestamp: new Date().toISOString()
    };
    this.auditLogs.push(log);
    return log;
  }

  checkIdempotency(key, result) {
    if (this.idempotentKeys.has(key)) {
      return { isDuplicate: true, result: this.idempotentKeys.get(key) };
    }
    this.idempotentKeys.set(key, result);
    return { isDuplicate: false };
  }

  createTicket(data) {
    const ticket = {
      id: uuidv4(),
      scenicSpotId: data.scenicSpotId,
      name: data.name,
      price: data.price,
      description: data.description || '',
      validFrom: data.validFrom,
      validTo: data.validTo,
      stock: data.stock,
      createdAt: new Date().toISOString()
    };
    this.tickets.push(ticket);
    this.saveAuditLog('CREATE', 'Ticket', ticket.id, null, ticket, 'system');
    return ticket;
  }

  getTicketById(id) {
    return this.tickets.find(t => t.id === id);
  }

  createFerryClass(data) {
    const ferry = {
      id: uuidv4(),
      route: data.route,
      departureTime: data.departureTime,
      arrivalTime: data.arrivalTime,
      vesselName: data.vesselName,
      capacity: data.capacity,
      bookedCount: 0,
      status: 'available',
      price: data.price,
      date: data.date,
      createdAt: new Date().toISOString()
    };
    this.ferryClasses.push(ferry);
    this.saveAuditLog('CREATE', 'FerryClass', ferry.id, null, ferry, 'system');
    return ferry;
  }

  getFerryClassById(id) {
    return this.ferryClasses.find(f => f.id === id);
  }

  updateFerryClass(id, data) {
    const index = this.ferryClasses.findIndex(f => f.id === id);
    if (index === -1) return null;
    const before = JSON.parse(JSON.stringify(this.ferryClasses[index]));
    const updated = { ...this.ferryClasses[index], ...data, updatedAt: new Date().toISOString() };
    this.ferryClasses[index] = updated;
    this.saveAuditLog('UPDATE', 'FerryClass', id, before, updated, 'system');
    return updated;
  }

  createWeatherSuspension(data) {
    const suspension = {
      id: uuidv4(),
      ferryClassId: data.ferryClassId,
      reason: data.reason,
      suspendedAt: data.suspendedAt || new Date().toISOString(),
      status: 'active',
      createdAt: new Date().toISOString()
    };
    this.weatherSuspensions.push(suspension);
    const ferry = this.getFerryClassById(data.ferryClassId);
    if (ferry) {
      this.updateFerryClass(data.ferryClassId, { status: 'suspended' });
    }
    this.saveAuditLog('CREATE', 'WeatherSuspension', suspension.id, null, suspension, 'system');
    return suspension;
  }

  getSuspensionByFerryClass(ferryClassId) {
    return this.weatherSuspensions.find(
      s => s.ferryClassId === ferryClassId && s.status === 'active'
    );
  }

  createOrder(data) {
    const order = {
      id: uuidv4(),
      orderNo: data.orderNo || `ORD${Date.now()}`,
      ticketId: data.ticketId,
      ferryClassId: data.ferryClassId,
      passengerName: data.passengerName,
      passengerId: data.passengerId,
      totalAmount: data.totalAmount,
      ticketAmount: data.ticketAmount,
      ferryAmount: data.ferryAmount,
      status: 'pending',
      segments: {
        ticket: { status: 'pending', validatedAt: null },
        ferry: { status: 'pending', validatedAt: null }
      },
      rebookCount: 0,
      maxRebookCount: 2,
      history: [],
      createdAt: new Date().toISOString()
    };
    this.orders.push(order);
    this.saveAuditLog('CREATE', 'Order', order.id, null, order, data.operator || 'system');
    return order;
  }

  getOrderById(id) {
    return this.orders.find(o => o.id === id);
  }

  getOrderByNo(orderNo) {
    return this.orders.find(o => o.orderNo === orderNo);
  }

  updateOrder(id, data, operator = 'system', reason = '') {
    const index = this.orders.findIndex(o => o.id === id);
    if (index === -1) return null;
    const before = JSON.parse(JSON.stringify(this.orders[index]));
    const updated = { ...this.orders[index], ...data, updatedAt: new Date().toISOString() };
    this.orders[index] = updated;
    this.saveAuditLog('UPDATE', 'Order', id, before, updated, operator, reason);
    return updated;
  }

  addOrderHistory(orderId, event, details) {
    const order = this.getOrderById(orderId);
    if (!order) return null;
    const historyItem = {
      id: uuidv4(),
      event,
      details,
      timestamp: new Date().toISOString()
    };
    order.history.push(historyItem);
    return historyItem;
  }

  createRebooking(data) {
    const rebooking = {
      id: uuidv4(),
      orderId: data.orderId,
      oldFerryClassId: data.oldFerryClassId,
      newFerryClassId: data.newFerryClassId,
      reason: data.reason,
      operator: data.operator || 'system',
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    this.rebookings.push(rebooking);
    this.saveAuditLog('CREATE', 'Rebooking', rebooking.id, null, rebooking, data.operator);
    return rebooking;
  }

  createRefund(data) {
    const refund = {
      id: uuidv4(),
      orderId: data.orderId,
      refundType: data.refundType,
      amount: data.amount,
      reason: data.reason,
      operator: data.operator || 'system',
      status: 'completed',
      details: data.details || {},
      createdAt: new Date().toISOString()
    };
    this.refunds.push(refund);
    this.saveAuditLog('CREATE', 'Refund', refund.id, null, refund, data.operator);
    return refund;
  }

  createValidation(data) {
    const validation = {
      id: uuidv4(),
      orderId: data.orderId,
      segment: data.segment,
      operator: data.operator || 'system',
      validatedAt: new Date().toISOString()
    };
    this.validations.push(validation);
    this.saveAuditLog('CREATE', 'Validation', validation.id, null, validation, data.operator);
    return validation;
  }

  createManualCorrection(data) {
    const correction = {
      id: uuidv4(),
      orderId: data.orderId,
      field: data.field,
      beforeValue: data.beforeValue,
      afterValue: data.afterValue,
      operator: data.operator,
      reason: data.reason,
      createdAt: new Date().toISOString()
    };
    this.manualCorrections.push(correction);
    this.saveAuditLog(
      'MANUAL_CORRECTION',
      'Order',
      data.orderId,
      { [data.field]: data.beforeValue },
      { [data.field]: data.afterValue },
      data.operator,
      data.reason
    );
    return correction;
  }

  getAllOrders() {
    return this.orders;
  }

  getAllRefunds() {
    return this.refunds;
  }

  getAllRebookings() {
    return this.rebookings;
  }

  getAllAuditLogs() {
    return this.auditLogs;
  }

  findAvailableFerryClasses(excludeId, date) {
    return this.ferryClasses.filter(f => 
      f.id !== excludeId && 
      f.status === 'available' && 
      f.bookedCount < f.capacity &&
      (date ? f.date === date : true)
    );
  }
}

module.exports = new DataStore();
