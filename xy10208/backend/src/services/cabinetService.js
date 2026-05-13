const {
  SLOT_STATUS,
  BATTERY_STATUS,
  RESERVATION_STATUS,
  FLOW_STATUS,
  createCabinet,
  createBattery,
  createReservation: createReservationModel,
  createHistoryRecord
} = require('../models/cabinet');

const cabinets = new Map();
const initSampleData = () => {
  if (!cabinets.has('cabinet-001')) {
    const cabinet = createCabinet('cabinet-001', '一号换电柜 (中关村店)', 12);
    cabinet.slots[2].status = SLOT_STATUS.FAULT;
    cabinet.slots[2].faultReason = '插槽通信故障，无法读取电池信息';
    cabinet.slots[5].status = SLOT_STATUS.EMPTY;
    cabinet.slots[5].battery = null;
    cabinet.slots[7].status = SLOT_STATUS.FULL;
    cabinet.slots[7].battery = createBattery(BATTERY_STATUS.FAULT);
    cabinet.slots[7].faultReason = '检测到电池异常，已自动标记为故障';
    cabinets.set('cabinet-001', cabinet);
  }
};
initSampleData();

const getAllCabinets = () => {
  return Array.from(cabinets.values()).map(cabinet => ({
    id: cabinet.id,
    name: cabinet.name,
    slotCount: cabinet.slotCount,
    stats: getCabinetStats(cabinet)
  }));
};

const getCabinetStats = (cabinet) => {
  const stats = {
    total: cabinet.slotCount,
    full: 0,
    empty: 0,
    reserved: 0,
    occupied: 0,
    fault: 0,
    locked: 0,
    availableFull: 0
  };
  
  cabinet.slots.forEach(slot => {
    stats[slot.status] = (stats[slot.status] || 0) + 1;
    if (slot.status === SLOT_STATUS.FULL && !slot.locked) {
      stats.availableFull++;
    }
  });
  
  return stats;
};

const getCabinet = (id) => {
  const cabinet = cabinets.get(id);
  if (!cabinet) return null;
  
  return {
    ...cabinet,
    stats: getCabinetStats(cabinet)
  };
};

const getSlot = (cabinetId, slotNumber) => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) return null;
  return cabinet.slots.find(s => s.slotNumber === slotNumber);
};

const findAvailableFullSlot = (cabinetId, excludeSlots = []) => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) return null;
  
  return cabinet.slots.find(slot => 
    slot.status === SLOT_STATUS.FULL && 
    !slot.locked && 
    !excludeSlots.includes(slot.slotNumber) &&
    slot.battery && 
    slot.battery.status === BATTERY_STATUS.FULL
  );
};

const findAvailableEmptySlot = (cabinetId, excludeSlots = []) => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) return null;
  
  return cabinet.slots.find(slot => 
    slot.status === SLOT_STATUS.EMPTY && 
    !slot.locked && 
    !excludeSlots.includes(slot.slotNumber)
  );
};

const addHistory = (cabinetId, slotId, action, details, userId = 'system') => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) return;
  
  const record = createHistoryRecord(slotId, action, details, userId);
  cabinet.history.unshift(record);
  cabinet.updatedAt = new Date().toISOString();
};

const createReservation = async (cabinetId, riderName, riderPhone, targetSlotNumber = null) => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) {
    return { success: false, error: '换电柜不存在', code: 'CABINET_NOT_FOUND' };
  }

  const fullSlot = findAvailableFullSlot(cabinetId);
  if (!fullSlot) {
    return {
      success: false,
      error: '当前没有可用的满电电池槽位',
      code: 'NO_FULL_SLOT',
      suggestion: '请等待电池充满或联系运营人员补充电池'
    };
  }

  const emptySlot = findAvailableEmptySlot(cabinetId, [fullSlot.slotNumber]);
  if (!emptySlot) {
    return {
      success: false,
      error: '当前没有可用的空槽位用于归还电池',
      code: 'NO_EMPTY_SLOT',
      suggestion: '请等待其他用户完成换电或联系运营人员'
    };
  }

  const pendingReservations = cabinet.reservations.filter(r => 
    r.status === RESERVATION_STATUS.PENDING || 
    r.status === RESERVATION_STATUS.CONFIRMED ||
    r.status === RESERVATION_STATUS.IN_PROGRESS
  ).length;
  
  if (pendingReservations >= 3) {
    return {
      success: false,
      error: '当前换电柜预约量过大，请稍后重试',
      code: 'TOO_MANY_RESERVATIONS',
      suggestion: '建议选择其他换电柜或等待5分钟后重试'
    };
  }

  const reservation = createReservationModel(cabinetId, riderName, riderPhone, targetSlotNumber);
  reservation.reserveSlot = fullSlot.slotNumber;
  reservation.returnSlot = emptySlot.slotNumber;
  reservation.status = RESERVATION_STATUS.CONFIRMED;
  reservation.currentFlow = FLOW_STATUS.RESERVATION_CONFIRMED;
  
  fullSlot.status = SLOT_STATUS.RESERVED;
  fullSlot.reservationId = reservation.id;
  fullSlot.currentFlow = FLOW_STATUS.RESERVATION_CONFIRMED;
  fullSlot.updatedAt = new Date().toISOString();
  
  emptySlot.status = SLOT_STATUS.RESERVED;
  emptySlot.reservationId = reservation.id;
  emptySlot.currentFlow = FLOW_STATUS.WAITING_EMPTY_BATTERY;
  emptySlot.updatedAt = new Date().toISOString();
  
  cabinet.reservations.push(reservation);
  
  addHistory(cabinetId, fullSlot.id, 'RESERVATION_LOCK', `槽位被预约锁定，预约号: ${reservation.id.substr(0, 8)}`, 'system');
  addHistory(cabinetId, emptySlot.id, 'RESERVATION_LOCK', `槽位被预约锁定用于归还，预约号: ${reservation.id.substr(0, 8)}`, 'system');
  
  cabinet.updatedAt = new Date().toISOString();
  
  return {
    success: true,
    data: {
      reservationId: reservation.id,
      reserveSlot: fullSlot.slotNumber,
      returnSlot: emptySlot.slotNumber,
      expiresAt: reservation.expiresAt
    }
  };
};

const insertEmptyBattery = async (cabinetId, reservationId, slotNumber, batteryCode) => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) {
    return { success: false, error: '换电柜不存在', code: 'CABINET_NOT_FOUND' };
  }

  const reservation = cabinet.reservations.find(r => r.id === reservationId);
  if (!reservation) {
    return { success: false, error: '预约不存在', code: 'RESERVATION_NOT_FOUND' };
  }

  if (reservation.status !== RESERVATION_STATUS.CONFIRMED && 
      reservation.status !== RESERVATION_STATUS.IN_PROGRESS) {
    return { success: false, error: '预约状态无效', code: 'INVALID_RESERVATION_STATUS' };
  }

  if (reservation.returnSlot !== slotNumber) {
    return {
      success: false,
      error: `请在指定槽位 ${reservation.returnSlot} 归还电池`,
      code: 'WRONG_SLOT',
      suggestion: `检查预约信息，应使用槽位 ${reservation.returnSlot}`
    };
  }

  const slot = cabinet.slots.find(s => s.slotNumber === slotNumber);
  if (!slot) {
    return { success: false, error: '槽位不存在', code: 'SLOT_NOT_FOUND' };
  }

  if (slot.battery) {
    return {
      success: false,
      error: '该槽位已有电池',
      code: 'SLOT_OCCUPIED',
      suggestion: '请检查槽位状态，可能存在异常需要运营复核'
    };
  }

  if (Date.now() > new Date(reservation.expiresAt).getTime()) {
    return {
      success: false,
      error: '预约已超时',
      code: 'RESERVATION_EXPIRED',
      suggestion: '请重新发起预约'
    };
  }

  let customSoc = null;
  if (batteryCode && batteryCode.toUpperCase().startsWith('HIGH')) {
    customSoc = 85 + Math.floor(Math.random() * 15);
  }
  
  const battery = createBattery(BATTERY_STATUS.EMPTY, batteryCode, customSoc);
  
  if (battery.soc > 80) {
    reservation.status = RESERVATION_STATUS.NEEDS_REVIEW;
    reservation.currentFlow = FLOW_STATUS.FAULT;
    slot.status = SLOT_STATUS.OCCUPIED;
    slot.battery = battery;
    slot.currentFlow = FLOW_STATUS.FAULT;
    slot.updatedAt = new Date().toISOString();
    
    addHistory(cabinetId, slot.id, 'BATTERY_RETURNED', `归还电池 ${batteryCode}，电量 ${battery.soc}%，触发待复核（电量过高）`, 'system');
    
    cabinet.updatedAt = new Date().toISOString();
    
    return {
      success: false,
      error: '归还电池电量异常，需要运营复核',
      code: 'HIGH_SOC_RETURN',
      currentStatus: 'NEEDS_REVIEW',
      suggestion: '请联系运营人员处理，或确认是否误操作'
    };
  }

  slot.status = SLOT_STATUS.OCCUPIED;
  slot.battery = battery;
  slot.currentFlow = FLOW_STATUS.EMPTY_BATTERY_INSERTED;
  slot.updatedAt = new Date().toISOString();
  
  reservation.status = RESERVATION_STATUS.IN_PROGRESS;
  reservation.currentFlow = FLOW_STATUS.EMPTY_BATTERY_INSERTED;
  reservation.batteryReturned = battery.id;
  reservation.updatedAt = new Date().toISOString();
  
  addHistory(cabinetId, slot.id, 'BATTERY_RETURNED', `归还电池 ${batteryCode}，电量 ${battery.soc}%`, 'system');
  
  cabinet.updatedAt = new Date().toISOString();
  
  return {
    success: true,
    data: {
      message: '电池归还成功',
      nextStep: `请前往槽位 ${reservation.reserveSlot} 取满电电池`,
      reserveSlot: reservation.reserveSlot
    }
  };
};

const takeFullBattery = async (cabinetId, reservationId, slotNumber) => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) {
    return { success: false, error: '换电柜不存在', code: 'CABINET_NOT_FOUND' };
  }

  const reservation = cabinet.reservations.find(r => r.id === reservationId);
  if (!reservation) {
    return { success: false, error: '预约不存在', code: 'RESERVATION_NOT_FOUND' };
  }

  if (reservation.status === RESERVATION_STATUS.NEEDS_REVIEW) {
    return {
      success: false,
      error: '该预约存在异常，需要运营复核',
      code: 'NEEDS_REVIEW',
      suggestion: '请联系运营人员处理'
    };
  }

  if (reservation.status !== RESERVATION_STATUS.IN_PROGRESS) {
    return {
      success: false,
      error: '请先归还电池',
      code: 'INVALID_FLOW',
      suggestion: '当前流程状态：' + reservation.currentFlow
    };
  }

  if (reservation.reserveSlot !== slotNumber) {
    return {
      success: false,
      error: `请在指定槽位 ${reservation.reserveSlot} 取电池`,
      code: 'WRONG_SLOT',
      suggestion: `检查预约信息，应使用槽位 ${reservation.reserveSlot}`
    };
  }

  const slot = cabinet.slots.find(s => s.slotNumber === slotNumber);
  if (!slot) {
    return { success: false, error: '槽位不存在', code: 'SLOT_NOT_FOUND' };
  }

  if (!slot.battery) {
    return {
      success: false,
      error: '该槽位没有电池',
      code: 'SLOT_EMPTY',
      suggestion: '请检查槽位状态，可能存在异常需要运营复核'
    };
  }

  if (slot.battery.status === BATTERY_STATUS.FAULT) {
    reservation.status = RESERVATION_STATUS.NEEDS_REVIEW;
    reservation.currentFlow = FLOW_STATUS.FAULT;
    slot.status = SLOT_STATUS.FAULT;
    slot.faultReason = '取电时发现电池故障，已触发待复核';
    slot.updatedAt = new Date().toISOString();
    
    addHistory(cabinetId, slot.id, 'FAULT_DETECTED', `取电时发现电池故障 ${slot.battery.code}`, 'system');
    
    cabinet.updatedAt = new Date().toISOString();
    
    return {
      success: false,
      error: '该槽位电池故障，需要运营复核',
      code: 'BATTERY_FAULT',
      currentStatus: 'NEEDS_REVIEW',
      suggestion: '请联系运营人员处理'
    };
  }

  const battery = slot.battery;
  
  slot.status = SLOT_STATUS.EMPTY;
  slot.battery = null;
  slot.reservationId = null;
  slot.currentFlow = FLOW_STATUS.IDLE;
  slot.updatedAt = new Date().toISOString();
  
  const returnSlot = cabinet.slots.find(s => s.slotNumber === reservation.returnSlot);
  if (returnSlot) {
    returnSlot.status = SLOT_STATUS.OCCUPIED;
    returnSlot.battery.status = BATTERY_STATUS.CHARGING;
    returnSlot.reservationId = null;
    returnSlot.currentFlow = FLOW_STATUS.IDLE;
    returnSlot.updatedAt = new Date().toISOString();
  }
  
  reservation.status = RESERVATION_STATUS.COMPLETED;
  reservation.currentFlow = FLOW_STATUS.COMPLETED;
  reservation.batteryTaken = battery.id;
  reservation.updatedAt = new Date().toISOString();
  
  addHistory(cabinetId, slot.id, 'BATTERY_TAKEN', `取出电池 ${battery.code}，电量 ${battery.soc}%`, 'system');
  
  cabinet.updatedAt = new Date().toISOString();
  
  return {
    success: true,
    data: {
      message: '换电完成！',
      battery: {
        code: battery.code,
        soc: battery.soc,
        health: battery.health
      }
    }
  };
};

const cancelReservation = async (cabinetId, reservationId, reason = '用户取消') => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) {
    return { success: false, error: '换电柜不存在', code: 'CABINET_NOT_FOUND' };
  }

  const reservation = cabinet.reservations.find(r => r.id === reservationId);
  if (!reservation) {
    return { success: false, error: '预约不存在', code: 'RESERVATION_NOT_FOUND' };
  }

  if (reservation.status === RESERVATION_STATUS.COMPLETED ||
      reservation.status === RESERVATION_STATUS.CANCELLED ||
      reservation.status === RESERVATION_STATUS.EXPIRED) {
    return { success: false, error: '预约已完成或已取消', code: 'INVALID_STATUS' };
  }

  if (reservation.status === RESERVATION_STATUS.IN_PROGRESS) {
    return {
      success: false,
      error: '换电流程已开始，无法取消',
      code: 'FLOW_STARTED',
      suggestion: '请联系运营人员处理'
    };
  }

  const reserveSlot = cabinet.slots.find(s => s.slotNumber === reservation.reserveSlot);
  if (reserveSlot) {
    reserveSlot.status = SLOT_STATUS.FULL;
    reserveSlot.reservationId = null;
    reserveSlot.currentFlow = FLOW_STATUS.IDLE;
    reserveSlot.updatedAt = new Date().toISOString();
  }

  const returnSlot = cabinet.slots.find(s => s.slotNumber === reservation.returnSlot);
  if (returnSlot) {
    returnSlot.status = SLOT_STATUS.EMPTY;
    returnSlot.reservationId = null;
    returnSlot.currentFlow = FLOW_STATUS.IDLE;
    returnSlot.updatedAt = new Date().toISOString();
  }

  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.updatedAt = new Date().toISOString();
  
  addHistory(cabinetId, reserveSlot?.id, 'RESERVATION_CANCEL', `预约被取消: ${reason}`, 'system');
  
  cabinet.updatedAt = new Date().toISOString();
  
  return { success: true, data: { message: '预约已取消' } };
};

const checkTimeout = async (cabinetId) => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) return [];

  const now = Date.now();
  const expired = [];

  cabinet.reservations.forEach(reservation => {
    if ((reservation.status === RESERVATION_STATUS.PENDING ||
         reservation.status === RESERVATION_STATUS.CONFIRMED) &&
        now > new Date(reservation.expiresAt).getTime()) {
      
      reservation.status = RESERVATION_STATUS.EXPIRED;
      reservation.currentFlow = FLOW_STATUS.TIMEOUT;
      reservation.updatedAt = new Date().toISOString();
      
      const reserveSlot = cabinet.slots.find(s => s.slotNumber === reservation.reserveSlot);
      if (reserveSlot) {
        reserveSlot.status = SLOT_STATUS.FULL;
        reserveSlot.reservationId = null;
        reserveSlot.currentFlow = FLOW_STATUS.IDLE;
        reserveSlot.updatedAt = new Date().toISOString();
        addHistory(cabinetId, reserveSlot.id, 'TIMEOUT_RELEASE', '预约超时，槽位已自动释放', 'system');
      }

      const returnSlot = cabinet.slots.find(s => s.slotNumber === reservation.returnSlot);
      if (returnSlot) {
        returnSlot.status = SLOT_STATUS.EMPTY;
        returnSlot.reservationId = null;
        returnSlot.currentFlow = FLOW_STATUS.IDLE;
        returnSlot.updatedAt = new Date().toISOString();
      }
      
      expired.push(reservation.id);
    }
  });

  cabinet.updatedAt = new Date().toISOString();
  return expired;
};

const markSlotFault = async (cabinetId, slotNumber, reason, operator = 'operator') => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) {
    return { success: false, error: '换电柜不存在', code: 'CABINET_NOT_FOUND' };
  }

  const slot = cabinet.slots.find(s => s.slotNumber === slotNumber);
  if (!slot) {
    return { success: false, error: '槽位不存在', code: 'SLOT_NOT_FOUND' };
  }

  if (slot.reservationId) {
    return {
      success: false,
      error: '该槽位有进行中的预约，无法直接标记故障',
      code: 'SLOT_IN_USE',
      suggestion: '请先处理相关预约，或使用紧急隔离功能'
    };
  }

  slot.status = SLOT_STATUS.FAULT;
  slot.faultReason = reason;
  slot.locked = true;
  slot.updatedAt = new Date().toISOString();
  
  addHistory(cabinetId, slot.id, 'FAULT_MARKED', `运营标记故障: ${reason}`, operator);
  
  cabinet.updatedAt = new Date().toISOString();
  
  return { success: true, data: { message: '槽位已标记为故障' } };
};

const releaseSlotFault = async (cabinetId, slotNumber, operator = 'operator') => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) {
    return { success: false, error: '换电柜不存在', code: 'CABINET_NOT_FOUND' };
  }

  const slot = cabinet.slots.find(s => s.slotNumber === slotNumber);
  if (!slot) {
    return { success: false, error: '槽位不存在', code: 'SLOT_NOT_FOUND' };
  }

  if (slot.status !== SLOT_STATUS.FAULT) {
    return { success: false, error: '该槽位不是故障状态', code: 'NOT_FAULT' };
  }

  const newStatus = slot.battery ? 
    (slot.battery.status === BATTERY_STATUS.FAULT ? SLOT_STATUS.FAULT : SLOT_STATUS.FULL) : 
    SLOT_STATUS.EMPTY;
  
  slot.status = newStatus;
  slot.faultReason = null;
  slot.locked = false;
  slot.updatedAt = new Date().toISOString();
  
  addHistory(cabinetId, slot.id, 'FAULT_RELEASED', '故障解除，槽位已恢复', operator);
  
  cabinet.updatedAt = new Date().toISOString();
  
  return { success: true, data: { message: '槽位故障已解除' } };
};

const reviewReservation = async (cabinetId, reservationId, action, operator = 'operator') => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) {
    return { success: false, error: '换电柜不存在', code: 'CABINET_NOT_FOUND' };
  }

  const reservation = cabinet.reservations.find(r => r.id === reservationId);
  if (!reservation) {
    return { success: false, error: '预约不存在', code: 'RESERVATION_NOT_FOUND' };
  }

  if (reservation.status !== RESERVATION_STATUS.NEEDS_REVIEW) {
    return { success: false, error: '该预约不需要复核', code: 'NO_REVIEW_NEEDED' };
  }

  if (action === 'approve') {
    reservation.status = RESERVATION_STATUS.IN_PROGRESS;
    reservation.currentFlow = FLOW_STATUS.WAITING_FULL_BATTERY;
    
    const reserveSlot = cabinet.slots.find(s => s.slotNumber === reservation.reserveSlot);
    if (reserveSlot) {
      reserveSlot.status = SLOT_STATUS.RESERVED;
      reserveSlot.currentFlow = FLOW_STATUS.WAITING_FULL_BATTERY;
      reserveSlot.updatedAt = new Date().toISOString();
    }
    
    addHistory(cabinetId, reserveSlot?.id, 'REVIEW_APPROVED', `运营复核通过: 允许继续换电流程`, operator);
  } else if (action === 'reject') {
    reservation.status = RESERVATION_STATUS.FAILED;
    reservation.currentFlow = FLOW_STATUS.FAULT;
    
    const reserveSlot = cabinet.slots.find(s => s.slotNumber === reservation.reserveSlot);
    if (reserveSlot) {
      reserveSlot.status = SLOT_STATUS.FULL;
      reserveSlot.reservationId = null;
      reserveSlot.currentFlow = FLOW_STATUS.IDLE;
      reserveSlot.updatedAt = new Date().toISOString();
    }
    
    const returnSlot = cabinet.slots.find(s => s.slotNumber === reservation.returnSlot);
    if (returnSlot && returnSlot.battery) {
      returnSlot.battery.status = BATTERY_STATUS.FAULT;
      returnSlot.status = SLOT_STATUS.FAULT;
      returnSlot.faultReason = '运营复核拒绝，电池标记为待处理';
      returnSlot.reservationId = null;
      returnSlot.currentFlow = FLOW_STATUS.IDLE;
      returnSlot.updatedAt = new Date().toISOString();
    }
    
    addHistory(cabinetId, reserveSlot?.id, 'REVIEW_REJECTED', `运营复核拒绝: 终止换电流程`, operator);
  } else {
    return { success: false, error: '无效的操作', code: 'INVALID_ACTION' };
  }

  reservation.updatedAt = new Date().toISOString();
  cabinet.updatedAt = new Date().toISOString();

  return {
    success: true,
    data: {
      message: action === 'approve' ? '复核通过，可继续换电' : '复核拒绝，流程终止',
      status: action === 'approve' ? 'IN_PROGRESS' : 'FAILED'
    }
  };
};

const getReservations = (cabinetId, status = null) => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) return [];
  
  let reservations = cabinet.reservations;
  if (status) {
    reservations = reservations.filter(r => r.status === status);
  }
  
  return reservations;
};

const getHistory = (cabinetId, slotNumber = null) => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) return [];
  
  let history = cabinet.history;
  if (slotNumber) {
    const slot = cabinet.slots.find(s => s.slotNumber === slotNumber);
    if (slot) {
      history = history.filter(h => h.slotId === slot.id);
    }
  }
  
  return history.slice(0, 100);
};

const generateReport = (cabinetId, startDate = null, endDate = null) => {
  const cabinet = cabinets.get(cabinetId);
  if (!cabinet) return null;
  
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : now;
  
  const reservationsInPeriod = cabinet.reservations.filter(r => {
    const created = new Date(r.createdAt);
    return created >= start && created <= end;
  });
  
  const report = {
    cabinetId,
    cabinetName: cabinet.name,
    period: {
      start: start.toISOString(),
      end: end.toISOString()
    },
    summary: {
      totalReservations: reservationsInPeriod.length,
      completed: reservationsInPeriod.filter(r => r.status === RESERVATION_STATUS.COMPLETED).length,
      cancelled: reservationsInPeriod.filter(r => r.status === RESERVATION_STATUS.CANCELLED).length,
      expired: reservationsInPeriod.filter(r => r.status === RESERVATION_STATUS.EXPIRED).length,
      failed: reservationsInPeriod.filter(r => r.status === RESERVATION_STATUS.FAILED).length,
      needsReview: reservationsInPeriod.filter(r => r.status === RESERVATION_STATUS.NEEDS_REVIEW).length,
      successRate: reservationsInPeriod.length > 0 
        ? Math.round((reservationsInPeriod.filter(r => r.status === RESERVATION_STATUS.COMPLETED).length / reservationsInPeriod.length) * 100)
        : 0
    },
    currentStats: getCabinetStats(cabinet),
    faultSlots: cabinet.slots.filter(s => s.status === SLOT_STATUS.FAULT).map(s => ({
      slotNumber: s.slotNumber,
      faultReason: s.faultReason,
      batteryCode: s.battery?.code
    })),
    pendingReservations: reservationsInPeriod.filter(r => 
      r.status === RESERVATION_STATUS.PENDING || 
      r.status === RESERVATION_STATUS.CONFIRMED ||
      r.status === RESERVATION_STATUS.IN_PROGRESS
    ).map(r => ({
      id: r.id,
      riderName: r.riderName,
      status: r.status,
      currentFlow: r.currentFlow,
      reserveSlot: r.reserveSlot,
      returnSlot: r.returnSlot,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt
    }))
  };
  
  return report;
};

const resetForDemo = async () => {
  cabinets.clear();
  initSampleData();
  return { success: true, message: '演示数据已重置' };
};

const initDemoSlot = (cabinetId, slotNumber, status, options = {}) => {
  let battery = null;
  let faultReason = null;
  let locked = false;
  
  if (status === SLOT_STATUS.FULL || status === SLOT_STATUS.OCCUPIED) {
    if (options.batteryFault) {
      battery = createBattery(BATTERY_STATUS.FAULT, options.batteryCode);
      faultReason = options.faultReason || '电池故障';
    } else {
      battery = createBattery(
        status === SLOT_STATUS.OCCUPIED ? BATTERY_STATUS.CHARGING : BATTERY_STATUS.FULL,
        options.batteryCode
      );
    }
  } else if (status === SLOT_STATUS.FAULT) {
    faultReason = options.faultReason || '槽位故障';
    locked = true;
    if (options.withBattery) {
      battery = createBattery(BATTERY_STATUS.FAULT, options.batteryCode);
    }
  }
  
  return {
    id: `slot-${cabinetId}-${slotNumber}`,
    slotNumber,
    cabinetId,
    status,
    battery,
    reservationId: options.reservationId || null,
    currentFlow: options.currentFlow || null,
    locked,
    faultReason,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const loadDemoData = async (scenario = 'normal') => {
  cabinets.clear();
  const cabinet = {
    id: 'cabinet-001',
    name: '一号换电柜 (中关村店)',
    slotCount: 12,
    slots: [],
    reservations: [],
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  if (scenario === 'normal') {
    cabinet.slots = [
      initDemoSlot('cabinet-001', 1, SLOT_STATUS.FULL),
      initDemoSlot('cabinet-001', 2, SLOT_STATUS.FULL),
      initDemoSlot('cabinet-001', 3, SLOT_STATUS.FULL),
      initDemoSlot('cabinet-001', 4, SLOT_STATUS.EMPTY),
      initDemoSlot('cabinet-001', 5, SLOT_STATUS.EMPTY),
      initDemoSlot('cabinet-001', 6, SLOT_STATUS.EMPTY),
      initDemoSlot('cabinet-001', 7, SLOT_STATUS.EMPTY),
      initDemoSlot('cabinet-001', 8, SLOT_STATUS.FULL),
      initDemoSlot('cabinet-001', 9, SLOT_STATUS.FULL),
      initDemoSlot('cabinet-001', 10, SLOT_STATUS.EMPTY),
      initDemoSlot('cabinet-001', 11, SLOT_STATUS.EMPTY),
      initDemoSlot('cabinet-001', 12, SLOT_STATUS.EMPTY)
    ];
  } else if (scenario === 'mixed') {
    const testReservation = createReservationModel('cabinet-001', '测试骑手', '13800138000');
    testReservation.reserveSlot = 3;
    testReservation.returnSlot = 6;
    testReservation.status = RESERVATION_STATUS.CONFIRMED;
    testReservation.currentFlow = FLOW_STATUS.RESERVATION_CONFIRMED;
    cabinet.reservations.push(testReservation);
    
    cabinet.slots = [
      initDemoSlot('cabinet-001', 1, SLOT_STATUS.FAULT, {
        faultReason: '插槽通信故障，无法读取电池信息'
      }),
      initDemoSlot('cabinet-001', 2, SLOT_STATUS.FULL),
      initDemoSlot('cabinet-001', 3, SLOT_STATUS.RESERVED, {
        reservationId: testReservation.id,
        currentFlow: FLOW_STATUS.RESERVATION_CONFIRMED,
        battery: createBattery(BATTERY_STATUS.FULL),
        locked: true
      }),
      initDemoSlot('cabinet-001', 4, SLOT_STATUS.FULL),
      initDemoSlot('cabinet-001', 5, SLOT_STATUS.FAULT, {
        withBattery: true,
        faultReason: '电池温度异常，已自动隔离',
        batteryCode: 'BAT-FAULT01'
      }),
      initDemoSlot('cabinet-001', 6, SLOT_STATUS.RESERVED, {
        reservationId: testReservation.id,
        currentFlow: FLOW_STATUS.WAITING_EMPTY_BATTERY,
        locked: true
      }),
      initDemoSlot('cabinet-001', 7, SLOT_STATUS.EMPTY),
      initDemoSlot('cabinet-001', 8, SLOT_STATUS.FULL),
      initDemoSlot('cabinet-001', 9, SLOT_STATUS.OCCUPIED),
      initDemoSlot('cabinet-001', 10, SLOT_STATUS.EMPTY),
      initDemoSlot('cabinet-001', 11, SLOT_STATUS.FULL),
      initDemoSlot('cabinet-001', 12, SLOT_STATUS.EMPTY)
    ];
    
    cabinet.slots[2].battery = createBattery(BATTERY_STATUS.FULL);
  }
  
  cabinets.set('cabinet-001', cabinet);
  
  return {
    success: true,
    message: `已加载 ${scenario === 'normal' ? '正常场景' : '混合场景'} 演示数据`,
    scenario
  };
};

module.exports = {
  getAllCabinets,
  getCabinet,
  getSlot,
  createReservation,
  insertEmptyBattery,
  takeFullBattery,
  cancelReservation,
  checkTimeout,
  markSlotFault,
  releaseSlotFault,
  reviewReservation,
  getReservations,
  getHistory,
  generateReport,
  resetForDemo,
  loadDemoData
};