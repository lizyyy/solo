const { db } = require('../database/db');

function getBedOccupancyReport(hospitalId, departmentId, date) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  
  let query = `
    SELECT 
      h.id as hospital_id,
      h.name as hospital_name,
      d.id as department_id,
      d.name as department_name,
      COUNT(DISTINCT b.id) as total_beds,
      SUM(CASE WHEN b.status = 'available' THEN 1 ELSE 0 END) as available_beds,
      SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END) as occupied_beds,
      SUM(CASE WHEN b.status = 'reserved' THEN 1 ELSE 0 END) as reserved_beds,
      (
        SELECT COUNT(*) FROM waiting_queue wq
        WHERE wq.department_id = d.id 
          AND wq.scheduled_date = ?
          AND wq.status = 'waiting'
      ) as waiting_count
    FROM hospitals h
    JOIN departments d ON h.id = d.hospital_id
    JOIN beds b ON d.id = b.department_id
    WHERE 1=1
  `;
  const params = [dateStr];
  
  if (hospitalId) {
    query += ' AND h.id = ?';
    params.push(hospitalId);
  }
  
  if (departmentId) {
    query += ' AND d.id = ?';
    params.push(departmentId);
  }
  
  query += ' GROUP BY h.id, d.id ORDER BY h.name, d.name';
  
  const results = db.prepare(query).all(...params);
  
  return results.map(r => ({
    ...r,
    occupancy_rate: r.total_beds > 0 
      ? Math.round(((r.occupied_beds + r.reserved_beds) / r.total_beds) * 100) 
      : 0,
    date: dateStr
  }));
}

function getWaitingQueueReport(hospitalId, departmentId, date) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  
  let query = `
    SELECT 
      h.id as hospital_id,
      h.name as hospital_name,
      d.id as department_id,
      d.name as department_name,
      wq.queue_position,
      wq.priority_score,
      tr.id as request_id,
      tr.severity_level,
      tr.diagnosis,
      tr.current_status,
      p.name as patient_name,
      p.age as patient_age,
      p.gender as patient_gender,
      wq.created_at as queue_time
    FROM waiting_queue wq
    JOIN transfer_requests tr ON wq.request_id = tr.id
    JOIN patients p ON tr.patient_id = p.id
    JOIN departments d ON wq.department_id = d.id
    JOIN hospitals h ON d.hospital_id = h.id
    WHERE wq.scheduled_date = ? AND wq.status = 'waiting'
  `;
  const params = [dateStr];
  
  if (hospitalId) {
    query += ' AND h.id = ?';
    params.push(hospitalId);
  }
  
  if (departmentId) {
    query += ' AND d.id = ?';
    params.push(departmentId);
  }
  
  query += ' ORDER BY h.name, d.name, wq.queue_position';
  
  return db.prepare(query).all(...params);
}

function getExceptionReport(hospitalId, departmentId, resolved) {
  let query = `
    SELECT 
      e.id as exception_id,
      e.exception_type,
      e.message,
      e.created_at,
      e.resolved_at,
      e.resolved_by,
      e.entity_type,
      e.entity_id,
      h.id as hospital_id,
      h.name as hospital_name,
      d.id as department_id,
      d.name as department_name,
      tr.current_status as request_status,
      p.name as patient_name
    FROM exceptions e
    LEFT JOIN transfer_requests tr ON e.entity_type = 'transfer_request' AND e.entity_id = tr.id
    LEFT JOIN patients p ON tr.patient_id = p.id
    LEFT JOIN departments d ON tr.to_department_id = d.id
    LEFT JOIN hospitals h ON d.hospital_id = h.id
    WHERE 1=1
  `;
  const params = [];
  
  if (hospitalId) {
    query += ' AND h.id = ?';
    params.push(hospitalId);
  }
  
  if (departmentId) {
    query += ' AND d.id = ?';
    params.push(departmentId);
  }
  
  if (resolved === true) {
    query += ' AND e.resolved_at IS NOT NULL';
  } else if (resolved === false) {
    query += ' AND e.resolved_at IS NULL';
  }
  
  query += ' ORDER BY e.created_at DESC';
  
  return db.prepare(query).all(...params);
}

function getDashboardSummary() {
  const today = new Date().toISOString().split('T')[0];
  
  const totalRequests = db.prepare(`
    SELECT COUNT(*) as count FROM transfer_requests
  `).get().count;
  
  const pendingRequests = db.prepare(`
    SELECT COUNT(*) as count FROM transfer_requests 
    WHERE current_status IN ('pending', 'waiting', 'scheduled', 'confirmed')
  `).get().count;
  
  const completedRequests = db.prepare(`
    SELECT COUNT(*) as count FROM transfer_requests 
    WHERE current_status = 'completed'
  `).get().count;
  
  const cancelledRequests = db.prepare(`
    SELECT COUNT(*) as count FROM transfer_requests 
    WHERE current_status IN ('cancelled', 'timed_out', 'rejected')
  `).get().count;
  
  const totalBeds = db.prepare(`
    SELECT COUNT(*) as count FROM beds
  `).get().count;
  
  const availableBeds = db.prepare(`
    SELECT COUNT(*) as count FROM beds WHERE status = 'available'
  `).get().count;
  
  const totalWaiting = db.prepare(`
    SELECT COUNT(*) as count FROM waiting_queue WHERE status = 'waiting'
  `).get().count;
  
  const unresolvedExceptions = db.prepare(`
    SELECT COUNT(*) as count FROM exceptions WHERE resolved_at IS NULL
  `).get().count;
  
  const criticalWaiting = db.prepare(`
    SELECT COUNT(*) as count 
    FROM waiting_queue wq
    JOIN transfer_requests tr ON wq.request_id = tr.id
    WHERE wq.status = 'waiting' AND tr.severity_level = 'critical'
  `).get().count;
  
  return {
    summary: {
      totalRequests,
      pendingRequests,
      completedRequests,
      cancelledRequests,
      completionRate: totalRequests > 0 
        ? Math.round((completedRequests / totalRequests) * 100) 
        : 0
    },
    beds: {
      total: totalBeds,
      available: availableBeds,
      occupied: totalBeds - availableBeds,
      availabilityRate: totalBeds > 0 
        ? Math.round((availableBeds / totalBeds) * 100) 
        : 0
    },
    queue: {
      totalWaiting,
      criticalWaiting
    },
    exceptions: {
      unresolved: unresolvedExceptions
    },
    date: today
  };
}

function getFullReport(hospitalId, departmentId, date) {
  return {
    dashboard: getDashboardSummary(),
    bedOccupancy: getBedOccupancyReport(hospitalId, departmentId, date),
    waitingQueue: getWaitingQueueReport(hospitalId, departmentId, date),
    exceptions: getExceptionReport(hospitalId, departmentId, false)
  };
}

module.exports = {
  getBedOccupancyReport,
  getWaitingQueueReport,
  getExceptionReport,
  getDashboardSummary,
  getFullReport
};
