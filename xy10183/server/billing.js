const MIDNIGHT_HOUR = 0;
const MORNING_HOUR = 6;

const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PAID: 'paid',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  EXCEPTION: 'exception'
};

const ORDER_STATUS_FLOW = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.IN_PROGRESS]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.EXCEPTION],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.REFUNDED]: [],
  [ORDER_STATUS.EXCEPTION]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUNDED]
};

function canTransition(from, to) {
  const allowed = ORDER_STATUS_FLOW[from] || [];
  return allowed.includes(to);
}

function calculateOvernightPeriods(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  if (start >= end) return 0;
  
  let overnightCount = 0;
  const current = new Date(start);
  
  while (current < end) {
    const currentHour = current.getHours();
    
    if (currentHour >= MIDNIGHT_HOUR && currentHour < MORNING_HOUR) {
      const nextMorning = new Date(current);
      nextMorning.setHours(MORNING_HOUR, 0, 0, 0);
      
      if (nextMorning < end) {
        overnightCount++;
      }
    }
    
    current.setHours(current.getHours() + 1);
  }
  
  return overnightCount;
}

function calculateRegularHours(startTime, endTime, overnightPeriods) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  if (start >= end) return 0;
  
  let totalHours = (end - start) / (1000 * 60 * 60);
  let regularHours = totalHours - (overnightPeriods * 6);
  
  return Math.max(0, regularHours);
}

function calculatePrice(spot, startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  if (start >= end) {
    return { regularHours: 0, overnightPeriods: 0, regularPrice: 0, overnightPrice: 0, total: 0 };
  }
  
  const overnightPeriods = calculateOvernightPeriods(startTime, endTime);
  const regularHours = calculateRegularHours(startTime, endTime, overnightPeriods);
  
  const regularHoursRounded = Math.ceil(regularHours);
  const regularPrice = regularHoursRounded * spot.pricePerHour;
  const overnightPrice = overnightPeriods * spot.overnightPrice;
  
  return {
    regularHours: regularHoursRounded,
    overnightPeriods,
    regularPrice,
    overnightPrice,
    total: regularPrice + overnightPrice
  };
}

function calculateCancellationFee(order, cancelTime) {
  const now = new Date(cancelTime);
  const startTime = new Date(order.startTime);
  
  const hoursBeforeStart = (startTime - now) / (1000 * 60 * 60);
  
  if (hoursBeforeStart >= 24) {
    return {
      fee: 0,
      refundAmount: order.totalPrice,
      reason: '提前24小时取消，全额退款'
    };
  } else if (hoursBeforeStart >= 2) {
    const fee = Math.ceil(order.totalPrice * 0.1);
    return {
      fee,
      refundAmount: order.totalPrice - fee,
      reason: '提前2-24小时取消，收取10%手续费'
    };
  } else if (hoursBeforeStart >= 0) {
    const fee = Math.ceil(order.totalPrice * 0.5);
    return {
      fee,
      refundAmount: order.totalPrice - fee,
      reason: '不足2小时取消，收取50%手续费'
    };
  } else {
    return {
      fee: order.totalPrice,
      refundAmount: 0,
      reason: '已过预约时间，不予退款'
    };
  }
}

function getTimeSlotsForDate(date, existingOrders) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    const slotStart = new Date(dayStart);
    slotStart.setHours(hour, 0, 0, 0);
    
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    
    const isAvailable = !existingOrders.some(order => {
      const orderStart = new Date(order.startTime);
      const orderEnd = new Date(order.endTime);
      return !(slotEnd <= orderStart || slotStart >= orderEnd);
    });
    
    slots.push({
      hour,
      startTime: slotStart.toISOString(),
      endTime: slotEnd.toISOString(),
      available: isAvailable
    });
  }
  
  return slots;
}

module.exports = {
  ORDER_STATUS,
  ORDER_STATUS_FLOW,
  canTransition,
  calculatePrice,
  calculateCancellationFee,
  getTimeSlotsForDate
};