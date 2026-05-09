const { v4: uuidv4 } = require('uuid');

const store = {
  properties: [],
  locks: [],
  bookings: [],
  batteryAlerts: [],
  repairOrders: [],
  history: [],
  idempotencyKeys: new Map()
};

const DataStore = {
  generateId: () => uuidv4(),
  getTimestamp: () => new Date().toISOString(),
  
  saveIdempotencyKey: (key, response) => {
    store.idempotencyKeys.set(key, { response, timestamp: DataStore.getTimestamp() });
  },
  
  getIdempotencyKey: (key) => {
    return store.idempotencyKeys.get(key);
  },
  
  addHistory: (entityType, entityId, action, previousState, newState, operator = 'system') => {
    const record = {
      id: DataStore.generateId(),
      entityType,
      entityId,
      action,
      previousState,
      newState,
      operator,
      timestamp: DataStore.getTimestamp()
    };
    store.history.push(record);
    return record;
  },
  
  getHistory: (entityType, entityId) => {
    return store.history
      .filter(h => h.entityType === entityType && h.entityId === entityId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },
  
  addProperty: (property) => {
    const prop = {
      id: DataStore.generateId(),
      ...property,
      createdAt: DataStore.getTimestamp(),
      updatedAt: DataStore.getTimestamp()
    };
    store.properties.push(prop);
    DataStore.addHistory('property', prop.id, 'create', null, prop);
    return prop;
  },
  
  getProperty: (id) => store.properties.find(p => p.id === id),
  
  updateProperty: (id, updates) => {
    const index = store.properties.findIndex(p => p.id === id);
    if (index === -1) return null;
    const previous = { ...store.properties[index] };
    store.properties[index] = {
      ...store.properties[index],
      ...updates,
      updatedAt: DataStore.getTimestamp()
    };
    DataStore.addHistory('property', id, 'update', previous, store.properties[index]);
    return store.properties[index];
  },
  
  addLock: (lock) => {
    const l = {
      id: DataStore.generateId(),
      batteryLevel: 100,
      status: 'normal',
      lastCheckedAt: DataStore.getTimestamp(),
      ...lock,
      createdAt: DataStore.getTimestamp(),
      updatedAt: DataStore.getTimestamp()
    };
    store.locks.push(l);
    DataStore.addHistory('lock', l.id, 'create', null, l);
    return l;
  },
  
  getLock: (id) => store.locks.find(l => l.id === id),
  
  getLocksByProperty: (propertyId) => store.locks.filter(l => l.propertyId === propertyId),
  
  updateLock: (id, updates) => {
    const index = store.locks.findIndex(l => l.id === id);
    if (index === -1) return null;
    const previous = { ...store.locks[index] };
    store.locks[index] = {
      ...store.locks[index],
      ...updates,
      updatedAt: DataStore.getTimestamp()
    };
    DataStore.addHistory('lock', id, 'update', previous, store.locks[index]);
    return store.locks[index];
  },
  
  addBooking: (booking) => {
    const b = {
      id: DataStore.generateId(),
      status: 'confirmed',
      ...booking,
      createdAt: DataStore.getTimestamp(),
      updatedAt: DataStore.getTimestamp()
    };
    store.bookings.push(b);
    DataStore.addHistory('booking', b.id, 'create', null, b);
    return b;
  },
  
  getBooking: (id) => store.bookings.find(b => b.id === id),
  
  getBookingsByProperty: (propertyId) => store.bookings.filter(b => b.propertyId === propertyId),
  
  updateBooking: (id, updates) => {
    const index = store.bookings.findIndex(b => b.id === id);
    if (index === -1) return null;
    const previous = { ...store.bookings[index] };
    store.bookings[index] = {
      ...store.bookings[index],
      ...updates,
      updatedAt: DataStore.getTimestamp()
    };
    DataStore.addHistory('booking', id, 'update', previous, store.bookings[index]);
    return store.bookings[index];
  },
  
  addBatteryAlert: (alert) => {
    const a = {
      id: DataStore.generateId(),
      status: 'active',
      acknowledgedAt: null,
      resolvedAt: null,
      ...alert,
      createdAt: DataStore.getTimestamp(),
      updatedAt: DataStore.getTimestamp()
    };
    store.batteryAlerts.push(a);
    DataStore.addHistory('batteryAlert', a.id, 'create', null, a);
    return a;
  },
  
  getBatteryAlert: (id) => store.batteryAlerts.find(a => a.id === id),
  
  getBatteryAlertsByLock: (lockId) => store.batteryAlerts.filter(a => a.lockId === lockId),
  
  getActiveBatteryAlerts: () => store.batteryAlerts.filter(a => a.status === 'active'),
  
  updateBatteryAlert: (id, updates) => {
    const index = store.batteryAlerts.findIndex(a => a.id === id);
    if (index === -1) return null;
    const previous = { ...store.batteryAlerts[index] };
    store.batteryAlerts[index] = {
      ...store.batteryAlerts[index],
      ...updates,
      updatedAt: DataStore.getTimestamp()
    };
    DataStore.addHistory('batteryAlert', id, 'update', previous, store.batteryAlerts[index]);
    return store.batteryAlerts[index];
  },
  
  addRepairOrder: (order) => {
    const o = {
      id: DataStore.generateId(),
      status: 'pending',
      assignedTo: null,
      startedAt: null,
      completedAt: null,
      ...order,
      createdAt: DataStore.getTimestamp(),
      updatedAt: DataStore.getTimestamp()
    };
    store.repairOrders.push(o);
    DataStore.addHistory('repairOrder', o.id, 'create', null, o);
    return o;
  },
  
  getRepairOrder: (id) => store.repairOrders.find(o => o.id === id),
  
  getRepairOrdersByProperty: (propertyId) => store.repairOrders.filter(o => o.propertyId === propertyId),
  
  getRepairOrdersByStatus: (status) => store.repairOrders.filter(o => o.status === status),
  
  updateRepairOrder: (id, updates) => {
    const index = store.repairOrders.findIndex(o => o.id === id);
    if (index === -1) return null;
    const previous = { ...store.repairOrders[index] };
    store.repairOrders[index] = {
      ...store.repairOrders[index],
      ...updates,
      updatedAt: DataStore.getTimestamp()
    };
    DataStore.addHistory('repairOrder', id, 'update', previous, store.repairOrders[index]);
    return store.repairOrders[index];
  },
  
  getSummary: () => {
    return {
      totalProperties: store.properties.length,
      totalLocks: store.locks.length,
      lowBatteryLocks: store.locks.filter(l => l.batteryLevel < 20).length,
      activeAlerts: store.batteryAlerts.filter(a => a.status === 'active').length,
      pendingRepairs: store.repairOrders.filter(o => o.status === 'pending').length,
      inProgressRepairs: store.repairOrders.filter(o => o.status === 'in_progress').length,
      upcomingBookings: store.bookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        const now = new Date();
        const diffDays = (checkIn - now) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 3 && b.status === 'confirmed';
      }).length
    };
  }
};

module.exports = DataStore;
