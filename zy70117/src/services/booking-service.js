const { 
  banquetHalls, 
  menuVersions, 
  waiters, 
  bookings, 
  resourceLocks, 
  generateId 
} = require('../models');

const createBooking = async (bookingData, operationId) => {
  const { hallId, menuId, waiterIds, startTime, endTime, customerName, guestsCount } = bookingData;
  
  const hall = banquetHalls.get(hallId);
  if (!hall) {
    throw new Error('宴会厅不存在');
  }
  
  const menu = menuVersions.get(menuId);
  if (!menu) {
    throw new Error('菜单版本不存在');
  }
  
  for (const waiterId of waiterIds) {
    if (!waiters.has(waiterId)) {
      throw new Error(`服务员 ${waiterId} 不存在`);
    }
  }
  
  if (guestsCount > hall.capacity) {
    throw new Error(`宾客数量 ${guestsCount} 超过宴会厅容量 ${hall.capacity}`);
  }
  
  const timeOverlap = checkTimeOverlap(hallId, startTime, endTime);
  if (timeOverlap) {
    throw new Error('宴会厅在该时间段已被占用');
  }
  
  for (const waiterId of waiterIds) {
    const waiter = waiters.get(waiterId);
    const waiterOverlap = checkWaiterOverlap(waiter, startTime, endTime);
    if (waiterOverlap) {
      throw new Error(`服务员 ${waiter.name} 在该时间段已有安排`);
    }
  }
  
  const bookingId = generateId();
  const totalPrice = calculatePrice(hall, menu, guestsCount, startTime, endTime);
  
  const booking = {
    id: bookingId,
    customerName,
    hallId,
    menuId,
    waiterIds,
    startTime,
    endTime,
    guestsCount,
    totalPrice,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    operationId
  };
  
  bookings.set(bookingId, booking);
  
  lockResources(bookingId, hallId, waiterIds, startTime, endTime);
  
  return booking;
};

const rescheduleBooking = async (bookingId, newStartTime, newEndTime, operationId) => {
  const booking = bookings.get(bookingId);
  if (!booking) {
    throw new Error('订单不存在');
  }
  
  if (booking.status === 'cancelled') {
    throw new Error('订单已取消，无法改期');
  }
  
  const hall = banquetHalls.get(booking.hallId);
  if (!hall) {
    throw new Error('宴会厅不存在');
  }
  
  const timeOverlap = checkTimeOverlap(booking.hallId, newStartTime, newEndTime, bookingId);
  if (timeOverlap) {
    throw new Error('宴会厅在新时间段已被占用');
  }
  
  for (const waiterId of booking.waiterIds) {
    const waiter = waiters.get(waiterId);
    const waiterOverlap = checkWaiterOverlap(waiter, newStartTime, newEndTime, bookingId);
    if (waiterOverlap) {
      throw new Error(`服务员 ${waiter.name} 在新时间段已有安排`);
    }
  }
  
  releaseResources(bookingId);
  
  booking.startTime = newStartTime;
  booking.endTime = newEndTime;
  booking.totalPrice = calculatePrice(hall, menuVersions.get(booking.menuId), booking.guestsCount, newStartTime, newEndTime);
  booking.updatedAt = new Date().toISOString();
  booking.operationId = operationId;
  
  lockResources(bookingId, booking.hallId, booking.waiterIds, newStartTime, newEndTime);
  
  return booking;
};

const cancelBooking = async (bookingId, operationId) => {
  const booking = bookings.get(bookingId);
  if (!booking) {
    throw new Error('订单不存在');
  }
  
  if (booking.status === 'cancelled') {
    return booking;
  }
  
  releaseResources(bookingId);
  
  booking.status = 'cancelled';
  booking.cancelledAt = new Date().toISOString();
  booking.operationId = operationId;
  
  return booking;
};

const getBooking = (bookingId) => {
  const booking = bookings.get(bookingId);
  if (!booking) {
    throw new Error('订单不存在');
  }
  
  return booking;
};

const lockResources = (bookingId, hallId, waiterIds, startTime, endTime) => {
  const hallLock = {
    id: generateId(),
    bookingId,
    resourceType: 'hall',
    resourceId: hallId,
    startTime,
    endTime,
    lockedAt: new Date().toISOString()
  };
  resourceLocks.set(hallLock.id, hallLock);
  
  const hall = banquetHalls.get(hallId);
  markSlotsUnavailable(hall.availableTimeSlots, startTime, endTime);
  
  for (const waiterId of waiterIds) {
    const waiterLock = {
      id: generateId(),
      bookingId,
      resourceType: 'waiter',
      resourceId: waiterId,
      startTime,
      endTime,
      lockedAt: new Date().toISOString()
    };
    resourceLocks.set(waiterLock.id, waiterLock);
    
    const waiter = waiters.get(waiterId);
    markSlotsUnavailable(waiter.schedule, startTime, endTime);
  }
};

const releaseResources = (bookingId) => {
  const locksToRelease = [];
  
  for (const [lockId, lock] of resourceLocks) {
    if (lock.bookingId === bookingId) {
      locksToRelease.push(lock);
    }
  }
  
  for (const lock of locksToRelease) {
    resourceLocks.delete(lock.id);
    
    if (lock.resourceType === 'hall') {
      const hall = banquetHalls.get(lock.resourceId);
      markSlotsAvailable(hall.availableTimeSlots, lock.startTime, lock.endTime);
    } else if (lock.resourceType === 'waiter') {
      const waiter = waiters.get(lock.resourceId);
      markSlotsAvailable(waiter.schedule, lock.startTime, lock.endTime);
    }
  }
};

const checkTimeOverlap = (hallId, startTime, endTime, excludeBookingId = null) => {
  for (const [lockId, lock] of resourceLocks) {
    if (lock.resourceType === 'hall' && lock.resourceId === hallId) {
      if (excludeBookingId && lock.bookingId === excludeBookingId) {
        continue;
      }
      
      if (isOverlapping(startTime, endTime, lock.startTime, lock.endTime)) {
        return true;
      }
    }
  }
  
  return false;
};

const checkWaiterOverlap = (waiter, startTime, endTime, excludeBookingId = null) => {
  for (const [lockId, lock] of resourceLocks) {
    if (lock.resourceType === 'waiter' && lock.resourceId === waiter.id) {
      if (excludeBookingId && lock.bookingId === excludeBookingId) {
        continue;
      }
      
      if (isOverlapping(startTime, endTime, lock.startTime, lock.endTime)) {
        return true;
      }
    }
  }
  
  return false;
};

const isOverlapping = (start1, end1, start2, end2) => {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  
  return s1 < e2 && e1 > s2;
};

const markSlotsUnavailable = (slots, startTime, endTime) => {
  const s = new Date(startTime).getTime();
  const e = new Date(endTime).getTime();
  
  for (const slot of slots) {
    const slotStart = new Date(slot.startTime).getTime();
    const slotEnd = new Date(slot.endTime).getTime();
    
    if (isOverlapping(slotStart, slotEnd, s, e)) {
      slot.available = false;
    }
  }
};

const markSlotsAvailable = (slots, startTime, endTime) => {
  const s = new Date(startTime).getTime();
  const e = new Date(endTime).getTime();
  
  for (const slot of slots) {
    const slotStart = new Date(slot.startTime).getTime();
    const slotEnd = new Date(slot.endTime).getTime();
    
    if (isOverlapping(slotStart, slotEnd, s, e)) {
      slot.available = true;
    }
  }
};

const calculatePrice = (hall, menu, guestsCount, startTime, endTime) => {
  const hours = (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60);
  const hallPrice = hall.pricePerHour * hours;
  const menuPrice = menu.price * guestsCount;
  return hallPrice + menuPrice;
};

const getAvailableHalls = (startTime, endTime) => {
  const available = [];
  
  for (const [hallId, hall] of banquetHalls) {
    if (!checkTimeOverlap(hallId, startTime, endTime)) {
      available.push(hall);
    }
  }
  
  return available;
};

const getAvailableWaiters = (startTime, endTime) => {
  const available = [];
  
  for (const [waiterId, waiter] of waiters) {
    if (!checkWaiterOverlap(waiter, startTime, endTime)) {
      available.push(waiter);
    }
  }
  
  return available;
};

module.exports = {
  createBooking,
  rescheduleBooking,
  cancelBooking,
  getBooking,
  getAvailableHalls,
  getAvailableWaiters,
  releaseResources
};
