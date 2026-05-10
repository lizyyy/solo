const db = require('../config/db');

function getDashboardStats() {
  return new Promise((resolve, reject) => {
    const stats = {};
    
    db.serialize(() => {
      db.get(
        `SELECT COUNT(*) as total FROM reservations`,
        (err, row) => { if (!err) stats.totalReservations = row.total; }
      );
      
      db.get(
        `SELECT COUNT(*) as count FROM reservations WHERE status = 'draft'`,
        (err, row) => { if (!err) stats.draftReservations = row.count; }
      );
      
      db.get(
        `SELECT COUNT(*) as count FROM reservations WHERE status = 'submitted'`,
        (err, row) => { if (!err) stats.submittedReservations = row.count; }
      );
      
      db.get(
        `SELECT COUNT(*) as count FROM reservations WHERE status = 'approved'`,
        (err, row) => { if (!err) stats.approvedReservations = row.count; }
      );
      
      db.get(
        `SELECT COUNT(*) as count FROM reservations WHERE status = 'rejected'`,
        (err, row) => { if (!err) stats.rejectedReservations = row.count; }
      );
      
      db.get(
        `SELECT COUNT(*) as count FROM cleaning_windows WHERE status IN ('scheduled', 'in_progress')`,
        (err, row) => { if (!err) stats.activeCleaning = row.count; }
      );
      
      db.get(
        `SELECT COUNT(*) as count FROM fire_inspections WHERE status IN ('scheduled', 'in_progress')`,
        (err, row) => { if (!err) stats.pendingFireInspections = row.count; }
      );
      
      db.get(
        `SELECT COUNT(*) as count FROM equipment_bookings WHERE status = 'confirmed'`,
        (err, row) => { if (!err) stats.confirmedEquipmentBookings = row.count; }
      );
      
      setTimeout(() => resolve(stats), 100);
    });
  });
}

function getKitchenUtilization(kitchenId = null) {
  return new Promise((resolve, reject) => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    
    let sql = `SELECT k.id, k.name, k.capacity,
               COUNT(DISTINCT r.id) as reservations_count,
               SUM(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) as approved_count,
               SUM(CASE WHEN r.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
               FROM kitchens k
               LEFT JOIN reservations r ON k.id = r.kitchen_id 
                 AND r.start_time >= ? AND r.start_time < ?`;
    
    const params = [weekStart.toISOString(), weekEnd.toISOString()];
    
    if (kitchenId) {
      sql += ` WHERE k.id = ?`;
      params.push(kitchenId);
    }
    
    sql += ` GROUP BY k.id, k.name, k.capacity`;
    
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getEquipmentSchedule(equipmentId = null) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT e.id, e.name, e.type, e.status, k.name as kitchen_name,
               eb.start_time, eb.end_time, eb.status as booking_status,
               r.id as reservation_id, t.name as team_name
               FROM equipments e
               JOIN kitchens k ON e.kitchen_id = k.id
               LEFT JOIN equipment_bookings eb ON e.id = eb.equipment_id 
                 AND eb.status IN ('pending', 'confirmed')
               LEFT JOIN reservations r ON eb.reservation_id = r.id
               LEFT JOIN teams t ON r.team_id = t.id`;
    
    const params = [];
    
    if (equipmentId) {
      sql += ` WHERE e.id = ?`;
      params.push(equipmentId);
    }
    
    sql += ` ORDER BY k.name, e.name, eb.start_time`;
    
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getTimeline(startDate, endDate, kitchenId = null) {
  return new Promise((resolve, reject) => {
    const timeline = {
      reservations: [],
      cleanings: [],
      fireInspections: []
    };
    
    let reservationSql = `SELECT r.*, k.name as kitchen_name, t.name as team_name
                          FROM reservations r
                          JOIN kitchens k ON r.kitchen_id = k.id
                          JOIN teams t ON r.team_id = t.id
                          WHERE r.start_time >= ? AND r.start_time < ?
                          AND r.status IN ('submitted', 'approved', 'in_progress')`;
                          
    let cleaningSql = `SELECT cw.*, k.name as kitchen_name
                       FROM cleaning_windows cw
                       JOIN kitchens k ON cw.kitchen_id = k.id
                       WHERE cw.start_time >= ? AND cw.start_time < ?
                       AND cw.status IN ('scheduled', 'in_progress')`;
                       
    let fireSql = `SELECT fi.*, k.name as kitchen_name
                   FROM fire_inspections fi
                   JOIN kitchens k ON fi.kitchen_id = k.id
                   WHERE fi.scheduled_time >= ? AND fi.scheduled_time < ?
                   AND fi.status IN ('scheduled', 'in_progress')`;
    
    const params = [startDate, endDate];
    
    if (kitchenId) {
      reservationSql += ` AND r.kitchen_id = ?`;
      cleaningSql += ` AND cw.kitchen_id = ?`;
      fireSql += ` AND fi.kitchen_id = ?`;
      params.push(kitchenId);
    }
    
    db.serialize(() => {
      db.all(reservationSql, params, (err, rows) => {
        if (!err) timeline.reservations = rows;
      });
      
      db.all(cleaningSql, params, (err, rows) => {
        if (!err) timeline.cleanings = rows;
      });
      
      db.all(fireSql, params, (err, rows) => {
        if (!err) timeline.fireInspections = rows;
      });
      
      setTimeout(() => resolve(timeline), 100);
    });
  });
}

function getConflictReport() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
         (SELECT COUNT(*) FROM history_logs 
          WHERE action = 'submit' 
          AND new_value LIKE '%conflict%') as conflict_count,
         (SELECT COUNT(*) FROM reservations WHERE status = 'rejected') as rejected_count,
         (SELECT COUNT(*) FROM history_logs 
          WHERE action = 'status_change' 
          AND old_value LIKE '%submitted%' 
          AND new_value LIKE '%approved%') as approved_count
       FROM (SELECT 1)`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      }
    );
  });
}

module.exports = {
  getDashboardStats,
  getKitchenUtilization,
  getEquipmentSchedule,
  getTimeline,
  getConflictReport
};
