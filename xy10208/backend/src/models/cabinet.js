const { v4: uuidv4 } = require('uuid');

const SLOT_STATUS = {
  EMPTY: 'empty',
  FULL: 'full',
  RESERVED: 'reserved',
  OCCUPIED: 'occupied',
  FAULT: 'fault',
  RELEASED: 'released',
  LOCKED: 'locked'
};

const BATTERY_STATUS = {
  FULL: 'full',
  EMPTY: 'empty',
  FAULT: 'fault',
  CHARGING: 'charging',
  IN_USE: 'in_use'
};

const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  NEEDS_REVIEW: 'needs_review'
};

const FLOW_STATUS = {
  IDLE: 'idle',
  WAITING_RESERVATION: 'waiting_reservation',
  RESERVATION_CONFIRMED: 'reservation_confirmed',
  WAITING_EMPTY_BATTERY: 'waiting_empty_battery',
  EMPTY_BATTERY_INSERTED: 'empty_battery_inserted',
  WAITING_FULL_BATTERY: 'waiting_full_battery',
  FULL_BATTERY_TAKEN: 'full_battery_taken',
  COMPLETED: 'completed',
  FAULT: 'fault',
  TIMEOUT: 'timeout'
};

const createCabinet = (id, name, slotCount = 12) => {
  const slots = [];
  for (let i = 0; i < slotCount; i++) {
    slots.push({
      id: `slot-${id}-${i + 1}`,
      slotNumber: i + 1,
      cabinetId: id,
      status: i < 6 ? SLOT_STATUS.FULL : SLOT_STATUS.EMPTY,
      battery: i < 6 ? createBattery(BATTERY_STATUS.FULL) : null,
      reservationId: null,
      currentFlow: null,
      locked: false,
      faultReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  return {
    id,
    name,
    slotCount,
    slots,
    reservations: [],
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const createBattery = (status = BATTERY_STATUS.FULL, code = null, customSoc = null) => {
  let soc;
  if (customSoc !== null) {
    soc = Math.min(100, Math.max(0, customSoc));
  } else {
    soc = status === BATTERY_STATUS.FULL ? 100 : status === BATTERY_STATUS.EMPTY ? 10 : Math.floor(Math.random() * 80) + 20;
  }
  
  return {
    id: uuidv4(),
    code: code || `BAT-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
    status,
    soc,
    temperature: 25,
    health: 100,
    cycleCount: Math.floor(Math.random() * 100),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const createReservation = (cabinetId, riderName, riderPhone, targetSlotNumber = null) => {
  return {
    id: uuidv4(),
    cabinetId,
    riderName,
    riderPhone,
    targetSlotNumber,
    reserveSlot: null,
    returnSlot: null,
    status: RESERVATION_STATUS.PENDING,
    currentFlow: FLOW_STATUS.IDLE,
    batteryTaken: null,
    batteryReturned: null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const createHistoryRecord = (slotId, action, details, userId = 'system') => {
  return {
    id: uuidv4(),
    slotId,
    action,
    details,
    userId,
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  SLOT_STATUS,
  BATTERY_STATUS,
  RESERVATION_STATUS,
  FLOW_STATUS,
  createCabinet,
  createBattery,
  createReservation,
  createHistoryRecord
};