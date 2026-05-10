const db = require('../config/db');

const conflictTypes = {
  EQUIPMENT_OVERLAP: 'equipment_overlap',
  CLEANING_OVERLAP: 'cleaning_overlap',
  FIRE_INSPECTION_OVERLAP: 'fire_inspection_overlap',
  KITCHEN_CAPACITY_EXCEEDED: 'kitchen_capacity_exceeded',
  DUPLICATE_SUBMISSION: 'duplicate_submission',
  STATUS_CONFLICT: 'status_conflict',
  MISSING_SOURCE: 'missing_source'
};

function isTimeOverlap(start1, end1, start2, end2) {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  return s1 < e2 && e1 > s2;
}

function checkEquipmentConflict(equipmentId, startTime, endTime, excludeBookingId = null) {
  return new Promise((resolve, reject) => {
    const sql = excludeBookingId
      ? `SELECT * FROM equipment_bookings 
         WHERE equipment_id = ? AND status != 'cancelled'
         AND id != ?`
      : `SELECT * FROM equipment_bookings 
         WHERE equipment_id = ? AND status != 'cancelled'`;
    
    const params = excludeBookingId ? [equipmentId, excludeBookingId] : [equipmentId];
    
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else {
        const conflicts = rows.filter(booking => 
          isTimeOverlap(startTime, endTime, booking.start_time, booking.end_time)
        );
        resolve(conflicts);
      }
    });
  });
}

function checkCleaningConflict(kitchenId, startTime, endTime) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM cleaning_windows 
       WHERE kitchen_id = ? AND status IN ('scheduled', 'in_progress')`,
      [kitchenId],
      (err, rows) => {
        if (err) reject(err);
        else {
          const conflicts = rows.filter(window => 
            isTimeOverlap(startTime, endTime, window.start_time, window.end_time)
          );
          resolve(conflicts);
        }
      }
    );
  });
}

function checkFireInspectionConflict(kitchenId, startTime, endTime) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM fire_inspections 
       WHERE kitchen_id = ? AND status IN ('scheduled', 'in_progress')`,
      [kitchenId],
      (err, rows) => {
        if (err) reject(err);
        else {
          const inspectionEndBuffer = 2 * 60 * 60 * 1000;
          const conflicts = rows.filter(inspection => {
            const inspectionEnd = new Date(inspection.scheduled_time).getTime() + inspectionEndBuffer;
            return isTimeOverlap(startTime, endTime, inspection.scheduled_time, inspectionEnd);
          });
          resolve(conflicts);
        }
      }
    );
  });
}

function checkKitchenCapacity(kitchenId, startTime, endTime, excludeReservationId = null) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT capacity FROM kitchens WHERE id = ?`, [kitchenId], (err, kitchen) => {
      if (err) reject(err);
      else if (!kitchen) {
        resolve({ exceeded: true, current: 0, capacity: 0, conflicts: [] });
      } else {
        const sql = excludeReservationId
          ? `SELECT * FROM reservations 
             WHERE kitchen_id = ? AND status IN ('submitted', 'approved', 'in_progress')
             AND id != ?`
          : `SELECT * FROM reservations 
             WHERE kitchen_id = ? AND status IN ('submitted', 'approved', 'in_progress')`;
        
        const params = excludeReservationId ? [kitchenId, excludeReservationId] : [kitchenId];
        
        db.all(sql, params, (err, reservations) => {
          if (err) reject(err);
          else {
            const activeReservations = reservations.filter(r => 
              isTimeOverlap(startTime, endTime, r.start_time, r.end_time)
            );
            resolve({
              exceeded: activeReservations.length >= kitchen.capacity,
              current: activeReservations.length,
              capacity: kitchen.capacity,
              conflicts: activeReservations
            });
          }
        });
      }
    });
  });
}

async function checkAllConflicts(reservation) {
  const conflicts = [];
  const suggestions = [];

  const equipmentConflicts = await checkEquipmentConflict(
    reservation.equipment_id,
    reservation.start_time,
    reservation.end_time
  );
  
  if (equipmentConflicts.length > 0) {
    conflicts.push({
      type: conflictTypes.EQUIPMENT_OVERLAP,
      message: `设备 ${reservation.equipment_name || reservation.equipment_id} 在此时间段已被占用`,
      details: equipmentConflicts
    });
    suggestions.push({
      priority: 'high',
      text: '请调整预约时间或选择其他可用设备'
    });
  }

  const cleaningConflicts = await checkCleaningConflict(
    reservation.kitchen_id,
    reservation.start_time,
    reservation.end_time
  );
  
  if (cleaningConflicts.length > 0) {
    conflicts.push({
      type: conflictTypes.CLEANING_OVERLAP,
      message: '预约时间与清洁窗口冲突',
      details: cleaningConflicts
    });
    suggestions.push({
      priority: 'high',
      text: '清洁期间厨房不可用，请避开清洁时段'
    });
  }

  const fireConflicts = await checkFireInspectionConflict(
    reservation.kitchen_id,
    reservation.start_time,
    reservation.end_time
  );
  
  if (fireConflicts.length > 0) {
    conflicts.push({
      type: conflictTypes.FIRE_INSPECTION_OVERLAP,
      message: '预约时间与消防检查冲突',
      details: fireConflicts
    });
    suggestions.push({
      priority: 'high',
      text: '消防检查期间厨房暂停使用，请调整预约时间'
    });
  }

  const capacityCheck = await checkKitchenCapacity(
    reservation.kitchen_id,
    reservation.start_time,
    reservation.end_time,
    reservation.id
  );
  
  if (capacityCheck.exceeded) {
    conflicts.push({
      type: conflictTypes.KITCHEN_CAPACITY_EXCEEDED,
      message: `厨房容量已达上限 (${capacityCheck.current}/${capacityCheck.capacity})`,
      details: capacityCheck.conflicts
    });
    suggestions.push({
      priority: 'medium',
      text: '考虑调整时间或使用其他厨房'
    });
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    suggestions
  };
}

module.exports = {
  conflictTypes,
  isTimeOverlap,
  checkEquipmentConflict,
  checkCleaningConflict,
  checkFireInspectionConflict,
  checkKitchenCapacity,
  checkAllConflicts
};
