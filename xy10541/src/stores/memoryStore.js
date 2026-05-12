const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class MemoryStore {
  constructor() {
    this.orders = new Map();
    this.technicians = new Map();
    this.parts = new Map();
    this.reschedules = new Map();
    this.compensations = new Map();
    this.events = new Map();
    this.idempotencyKeys = new Map();
  }

  generateId() {
    return uuidv4();
  }

  now() {
    return moment().toISOString();
  }

  createOrder(orderData) {
    const id = this.generateId();
    const order = {
      id,
      ...orderData,
      createdAt: this.now(),
      updatedAt: this.now()
    };
    this.orders.set(id, order);
    return order;
  }

  getOrder(id) {
    return this.orders.get(id);
  }

  updateOrder(id, updates) {
    const order = this.orders.get(id);
    if (!order) return null;
    const updatedOrder = {
      ...order,
      ...updates,
      updatedAt: this.now()
    };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  listOrders(filters = {}) {
    let orders = Array.from(this.orders.values());
    if (filters.status) {
      orders = orders.filter(o => o.status === filters.status);
    }
    if (filters.customerId) {
      orders = orders.filter(o => o.customerId === filters.customerId);
    }
    if (filters.technicianId) {
      orders = orders.filter(o => o.technicianId === filters.technicianId);
    }
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createTechnician(techData) {
    const id = this.generateId();
    const tech = {
      id,
      ...techData,
      schedule: [],
      createdAt: this.now(),
      updatedAt: this.now()
    };
    this.technicians.set(id, tech);
    return tech;
  }

  getTechnician(id) {
    return this.technicians.get(id);
  }

  updateTechnician(id, updates) {
    const tech = this.technicians.get(id);
    if (!tech) return null;
    const updatedTech = {
      ...tech,
      ...updates,
      updatedAt: this.now()
    };
    this.technicians.set(id, updatedTech);
    return updatedTech;
  }

  listTechnicians(filters = {}) {
    let techs = Array.from(this.technicians.values());
    if (filters.skill) {
      techs = techs.filter(t => t.skills.includes(filters.skill));
    }
    return techs;
  }

  createPart(partData) {
    const id = this.generateId();
    const part = {
      id,
      ...partData,
      allocations: [],
      createdAt: this.now(),
      updatedAt: this.now()
    };
    this.parts.set(id, part);
    return part;
  }

  getPart(id) {
    return this.parts.get(id);
  }

  getPartByCode(code) {
    return Array.from(this.parts.values()).find(p => p.code === code);
  }

  updatePart(id, updates) {
    const part = this.parts.get(id);
    if (!part) return null;
    const updatedPart = {
      ...part,
      ...updates,
      updatedAt: this.now()
    };
    this.parts.set(id, updatedPart);
    return updatedPart;
  }

  listParts() {
    return Array.from(this.parts.values());
  }

  createReschedule(rescheduleData) {
    const id = this.generateId();
    const reschedule = {
      id,
      ...rescheduleData,
      createdAt: this.now(),
      updatedAt: this.now()
    };
    this.reschedules.set(id, reschedule);
    return reschedule;
  }

  getReschedule(id) {
    return this.reschedules.get(id);
  }

  listReschedulesByOrder(orderId) {
    return Array.from(this.reschedules.values())
      .filter(r => r.orderId === orderId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createCompensation(compensationData) {
    const id = this.generateId();
    const compensation = {
      id,
      ...compensationData,
      createdAt: this.now(),
      updatedAt: this.now()
    };
    this.compensations.set(id, compensation);
    return compensation;
  }

  getCompensation(id) {
    return this.compensations.get(id);
  }

  updateCompensation(id, updates) {
    const comp = this.compensations.get(id);
    if (!comp) return null;
    const updatedComp = {
      ...comp,
      ...updates,
      updatedAt: this.now()
    };
    this.compensations.set(id, updatedComp);
    return updatedComp;
  }

  listCompensations(filters = {}) {
    let comps = Array.from(this.compensations.values());
    if (filters.orderId) {
      comps = comps.filter(c => c.orderId === filters.orderId);
    }
    return comps;
  }

  createEvent(eventData) {
    const id = this.generateId();
    const event = {
      id,
      ...eventData,
      timestamp: this.now()
    };
    this.events.set(id, event);
    return event;
  }

  listEvents(orderId) {
    return Array.from(this.events.values())
      .filter(e => e.orderId === orderId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  checkIdempotency(key) {
    return this.idempotencyKeys.get(key);
  }

  saveIdempotency(key, response) {
    this.idempotencyKeys.set(key, {
      response,
      createdAt: this.now()
    });
  }
}

module.exports = new MemoryStore();
