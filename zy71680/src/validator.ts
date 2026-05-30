import type { Booking, Room, Engineer, Equipment, ValidationResult, Provenance } from './types.js';

export function validateBooking(booking: Booking): ValidationResult {
  const issues: string[] = [];

  if (!booking.id) issues.push('缺少预约编号');
  if (!booking.clientName) issues.push('缺少客户姓名');
  if (!booking.roomId) issues.push('缺少房间ID');
  if (!booking.date) issues.push('缺少日期');
  if (!booking.startTime) issues.push('缺少开始时间');
  if (!booking.endTime) issues.push('缺少结束时间');

  if (booking.date && !/^\d{4}-\d{2}-\d{2}$/.test(booking.date)) {
    issues.push(`日期格式异常: "${booking.date}"，期望 YYYY-MM-DD`);
  }

  if (booking.startTime && booking.endTime) {
    if (booking.startTime >= booking.endTime) {
      issues.push(`开始时间(${booking.startTime}) >= 结束时间(${booking.endTime})，时间范围不合理`);
    }
  }

  if (booking.date) {
    const d = new Date(booking.date);
    if (isNaN(d.getTime())) {
      issues.push(`日期无法解析: "${booking.date}"`);
    } else if (d.getDay() === 0 && booking.startTime < '10:00') {
      issues.push('周日10:00前不在营业时间内');
    }
  }

  if (!['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].includes(booking.status)) {
    issues.push(`未知的预约状态: "${booking.status}"`);
  }

  return {
    recordId: booking.id,
    recordType: 'booking',
    valid: issues.length === 0,
    issues,
    provenance: booking.provenance,
  };
}

export function validateRoom(room: Room): ValidationResult {
  const issues: string[] = [];
  if (!room.id) issues.push('缺少房间ID');
  if (!room.name) issues.push('缺少房间名称');
  if (!['drum', 'vocal', 'mixing', 'live', 'rehearsal'].includes(room.type)) {
    issues.push(`未知的房间类型: "${room.type}"`);
  }
  return {
    recordId: room.id,
    recordType: 'room',
    valid: issues.length === 0,
    issues,
    provenance: room.provenance,
  };
}

export function validateEngineer(engineer: Engineer): ValidationResult {
  const issues: string[] = [];
  if (!engineer.id) issues.push('缺少工程师ID');
  if (!engineer.name) issues.push('缺少工程师姓名');
  if (engineer.specialties.length === 0) issues.push('未指定专业方向');
  return {
    recordId: engineer.id,
    recordType: 'engineer',
    valid: issues.length === 0,
    issues,
    provenance: engineer.provenance,
  };
}

export function validateEquipment(equipment: Equipment): ValidationResult {
  const issues: string[] = [];
  if (!equipment.id) issues.push('缺少设备ID');
  if (!equipment.name) issues.push('缺少设备名称');
  if (equipment.quantity < 1) issues.push(`设备数量异常: ${equipment.quantity}`);
  return {
    recordId: equipment.id,
    recordType: 'equipment',
    valid: issues.length === 0,
    issues,
    provenance: equipment.provenance,
  };
}

export function validateAll(
  bookings: Booking[],
  rooms: Room[],
  engineers: Engineer[],
  equipment: Equipment[]
): ValidationResult[] {
  return [
    ...bookings.map(validateBooking),
    ...rooms.map(validateRoom),
    ...engineers.map(validateEngineer),
    ...equipment.map(validateEquipment),
  ];
}
