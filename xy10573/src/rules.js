const dayjs = require('dayjs');
const { db } = require('./db');
const { v4: uuidv4 } = require('uuid');

const REQUIRED_VACCINES = {
  dog: ['狂犬病', '犬瘟热', '细小病毒'],
  cat: ['狂犬病', '猫瘟热', '猫鼻支']
};

const FOOD_INTERACTIONS = {
  '鸡肉': ['洋葱', '大蒜'],
  '牛肉': ['巧克力', '葡萄'],
  '海鲜': ['牛奶', '乳糖制品']
};

function checkVaccineValidity(petId, checkInDate) {
  const pet = db.prepare('SELECT species FROM pets WHERE id = ?').get(petId);
  if (!pet) {
    return { valid: false, reason: '宠物档案不存在', code: 'PET_NOT_FOUND' };
  }

  const requiredVaccines = REQUIRED_VACCINES[pet.species] || [];
  if (requiredVaccines.length === 0) {
    return { valid: true, warnings: ['未知物种，跳过疫苗检查'] };
  }

  const vaccines = db.prepare(`
    SELECT * FROM vaccine_records 
    WHERE pet_id = ?
  `).all(petId);

  const missingVaccines = [];
  const expiredVaccines = [];

  for (const vtype of requiredVaccines) {
    const records = vaccines.filter(v => v.vaccine_type === vtype);
    if (records.length === 0) {
      missingVaccines.push(vtype);
    } else {
      const latest = records.reduce((a, b) => 
        dayjs(a.expiry_date).isAfter(dayjs(b.expiry_date)) ? a : b
      );
      if (dayjs(latest.expiry_date).isBefore(dayjs(checkInDate))) {
        expiredVaccines.push({ type: vtype, expiry: latest.expiry_date });
      }
    }
  }

  if (missingVaccines.length > 0 || expiredVaccines.length > 0) {
    return {
      valid: false,
      reason: '疫苗检查未通过',
      code: 'VACCINE_CHECK_FAILED',
      missingVaccines,
      expiredVaccines
    };
  }

  return { valid: true };
}

function checkDuplicateBooking(petId, checkInDate, checkOutDate, excludeBookingId = null) {
  const existingBookings = db.prepare(`
    SELECT id, booking_no, check_in_date, check_out_date, status
    FROM boarding_bookings 
    WHERE pet_id = ?
    AND status NOT IN ('cancelled', 'completed')
  `).all(petId);

  const newStart = dayjs(checkInDate);
  const newEnd = dayjs(checkOutDate);

  const overlaps = existingBookings.filter(b => {
    if (excludeBookingId && b.id === excludeBookingId) return false;
    
    const existingStart = dayjs(b.check_in_date);
    const existingEnd = dayjs(b.check_out_date);
    
    return newStart.isBefore(existingEnd) && newEnd.isAfter(existingStart);
  });

  if (overlaps.length > 0) {
    return { conflict: true, overlaps };
  }

  return { conflict: false };
}

function checkRoomAvailability(roomId, checkInDate, checkOutDate, excludeBookingId = null) {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) {
    return { available: false, reason: '房型不存在', code: 'ROOM_NOT_FOUND' };
  }

  const start = dayjs(checkInDate);
  const end = dayjs(checkOutDate);
  const dates = [];
  for (let d = start; d.isBefore(end); d = d.add(1, 'day')) {
    dates.push(d.format('YYYY-MM-DD'));
  }

  if (dates.length === 0) {
    return { available: false, reason: '入住日期无效', code: 'INVALID_DATES' };
  }

  const roomBookings = db.prepare(`
    SELECT id, check_in_date, check_out_date, status
    FROM boarding_bookings
    WHERE room_id = ?
    AND status IN ('pending', 'confirmed', 'checked_in')
  `).all(roomId);

  const newStart = dayjs(checkInDate);
  const newEnd = dayjs(checkOutDate);

  let bookedCount = roomBookings.filter(b => {
    if (excludeBookingId && b.id === excludeBookingId) return false;
    const existingStart = dayjs(b.check_in_date);
    const existingEnd = dayjs(b.check_out_date);
    return newStart.isBefore(existingEnd) && newEnd.isAfter(existingStart);
  }).length;

  const available = room.capacity - bookedCount;

  if (available <= 0) {
    return {
      available: false,
      reason: '房型库存不足',
      code: 'ROOM_CAPACITY_EXCEEDED',
      roomName: room.name,
      booked: bookedCount,
      capacity: room.capacity
    };
  }

  return { 
    available: true, 
    availableCount: available,
    room,
    dates
  };
}

function checkFeedingCompatibility(bookingId, feedingPlan) {
  const booking = db.prepare('SELECT pet_id FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { compatible: false, reason: '预约不存在' };
  }

  const pet = db.prepare('SELECT allergies, special_needs FROM pets WHERE id = ?').get(booking.pet_id);
  if (!pet) {
    return { compatible: true, warnings: ['宠物信息不完整'] };
  }

  const conflicts = [];
  const warnings = [];

  if (pet.allergies) {
    const allergies = pet.allergies.split(/[,，、]/).map(a => a.trim());
    for (const allergy of allergies) {
      if (allergy && feedingPlan.food_type.includes(allergy)) {
        conflicts.push(`宠物对 ${allergy} 过敏，喂养计划包含过敏原`);
      }
    }
  }

  const foodType = feedingPlan.food_type;
  const interactions = FOOD_INTERACTIONS[foodType] || [];
  for (const interaction of interactions) {
    if (feedingPlan.notes?.includes(interaction) || feedingPlan.food_type.includes(interaction)) {
      warnings.push(`注意：${foodType} 与 ${interaction} 可能存在交互禁忌`);
    }
  }

  if (pet.special_needs) {
    if (pet.special_needs.includes('糖尿病') && feedingPlan.food_type.includes('含糖')) {
      conflicts.push('糖尿病宠物禁止高糖食物');
    }
    if (pet.special_needs.includes('肾脏疾病') && feedingPlan.food_type.includes('高磷')) {
      conflicts.push('肾脏疾病宠物需低磷饮食');
    }
  }

  if (conflicts.length > 0) {
    return { compatible: false, reason: '喂养禁忌检查失败', conflicts, warnings };
  }

  return { compatible: true, warnings };
}

function calculateRoomCharge(roomId, checkInDate, checkOutDate, actualCheckOut = null) {
  const room = db.prepare('SELECT base_rate FROM rooms WHERE id = ?').get(roomId);
  if (!room) return 0;

  const start = dayjs(checkInDate);
  const endDate = actualCheckOut || checkOutDate;
  const end = dayjs(endDate);
  
  const nights = end.diff(start, 'day');
  return Math.max(0, nights) * room.base_rate;
}

function calculateAddOnCharge(bookingId) {
  const addOns = db.prepare(`
    SELECT SUM(total_price) as total
    FROM booking_add_ons
    WHERE booking_id = ?
  `).get(bookingId);
  return addOns.total || 0;
}

function calculateTransportFee(bookingId) {
  const transports = db.prepare(`
    SELECT SUM(fee) as total
    FROM transport_records
    WHERE booking_id = ?
  `).get(bookingId);
  return transports.total || 0;
}

function calculateEarlyCheckoutRefund(booking, actualCheckOutDate) {
  const { check_in_date, check_out_date, room_id, total_amount } = booking;
  
  const originalNights = dayjs(check_out_date).diff(dayjs(check_in_date), 'day');
  const actualNights = dayjs(actualCheckOutDate).diff(dayjs(check_in_date), 'day');
  
  if (actualNights >= originalNights) {
    return { refundable: 0, reason: '未提前退房' };
  }

  const room = db.prepare('SELECT base_rate FROM rooms WHERE id = ?').get(room_id);
  if (!room) return { refundable: 0, reason: '房型信息缺失' };

  const unusedNights = originalNights - Math.max(0, actualNights);
  const roomRefund = unusedNights * room.base_rate * 0.5;

  const futureAddOns = db.prepare(`
    SELECT SUM(total_price) as total
    FROM booking_add_ons
    WHERE booking_id = ?
    AND applied_date >= ?
  `).get(booking.id, actualCheckOutDate);
  const addOnRefund = (futureAddOns.total || 0) * 0.8;

  return {
    refundable: Math.round((roomRefund + addOnRefund) * 100) / 100,
    roomRefund,
    addOnRefund,
    unusedNights,
    policy: '提前退房按未消费部分50%退还房费，未使用加购按80%退还'
  };
}

function recordHistory(bookingId, action, beforeData, afterData, actor, notes = '') {
  db.prepare(`
    INSERT INTO booking_histories (id, booking_id, action, before_data, after_data, actor, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    bookingId,
    action,
    beforeData ? JSON.stringify(beforeData) : null,
    afterData ? JSON.stringify(afterData) : null,
    actor,
    notes
  );
}

function checkIdempotency(key, endpoint) {
  const record = db.prepare(`
    SELECT * FROM idempotency_records
    WHERE idempotency_key = ? AND endpoint = ?
  `).get(key, endpoint);
  
  if (record) {
    return { exists: true, response: JSON.parse(record.response_body) };
  }
  return { exists: false };
}

function saveIdempotency(key, endpoint, requestBody, responseBody) {
  db.prepare(`
    INSERT INTO idempotency_records (id, idempotency_key, endpoint, request_body, response_body)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    key,
    endpoint,
    JSON.stringify(requestBody),
    JSON.stringify(responseBody)
  );
}

module.exports = {
  checkVaccineValidity,
  checkDuplicateBooking,
  checkRoomAvailability,
  checkFeedingCompatibility,
  calculateRoomCharge,
  calculateAddOnCharge,
  calculateTransportFee,
  calculateEarlyCheckoutRefund,
  recordHistory,
  checkIdempotency,
  saveIdempotency,
  REQUIRED_VACCINES,
  FOOD_INTERACTIONS
};