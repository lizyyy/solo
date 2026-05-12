const { prepare } = require('../db');

function getDailyReport(date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  
  const dailyData = prepare(`
    SELECT
      lr.crane_id,
      c.code as crane_code,
      COUNT(lr.id) as total_lifts,
      SUM(CASE WHEN lr.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_lifts,
      SUM(lr.actual_weight) as total_weight,
      AVG(lr.wind_speed) as avg_wind_speed,
      MAX(lr.wind_speed) as max_wind_speed
    FROM lift_records lr
    JOIN cranes c ON lr.crane_id = c.id
    WHERE DATE(lr.started_at) = ?
    GROUP BY lr.crane_id, c.code
  `).all(targetDate);
  
  const totalStats = prepare(`
    SELECT
      COUNT(*) as total_lifts,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_lifts,
      SUM(actual_weight) as total_weight,
      AVG(wind_speed) as avg_wind_speed,
      MAX(wind_speed) as max_wind_speed
    FROM lift_records
    WHERE DATE(started_at) = ?
  `).get(targetDate);
  
  const materialStats = prepare(`
    SELECT
      m.code as material_code,
      m.name as material_name,
      m.priority as material_priority,
      COUNT(lr.id) as lift_count,
      SUM(lr.actual_weight) as total_weight
    FROM lift_records lr
    JOIN materials m ON lr.material_id = m.id
    WHERE DATE(lr.started_at) = ?
    GROUP BY m.id, m.code, m.name, m.priority
    ORDER BY m.priority DESC, lift_count DESC
  `).all(targetDate);
  
  const buildingStats = prepare(`
    SELECT
      building_no,
      COUNT(id) as lift_count,
      SUM(actual_weight) as total_weight
    FROM lift_records
    WHERE DATE(started_at) = ?
    GROUP BY building_no
    ORDER BY lift_count DESC
  `).all(targetDate);
  
  const craneStats = dailyData.map(item => ({
    crane_id: item.crane_id,
    crane_code: item.crane_code,
    total_lifts: item.total_lifts,
    completed_lifts: item.completed_lifts,
    completion_rate: item.total_lifts > 0 
      ? Math.round((item.completed_lifts / item.total_lifts) * 100) / 100
      : 0,
    total_weight: item.total_weight,
    avg_wind_speed: item.avg_wind_speed,
    max_wind_speed: item.max_wind_speed
  }));
  
  return {
    date: targetDate,
    generated_at: new Date().toISOString(),
    total: {
      total_lifts: totalStats ? totalStats.total_lifts : 0,
      completed_lifts: totalStats ? totalStats.completed_lifts : 0,
      completion_rate: (totalStats && totalStats.total_lifts > 0)
        ? Math.round((totalStats.completed_lifts / totalStats.total_lifts) * 100) / 100
        : 0,
      total_weight: totalStats ? totalStats.total_weight : 0,
      avg_wind_speed: totalStats ? totalStats.avg_wind_speed : 0,
      max_wind_speed: totalStats ? totalStats.max_wind_speed : 0
    },
    by_crane: craneStats,
    by_material: materialStats,
    by_building: buildingStats
  };
}

function getDashboardData() {
  const today = new Date().toISOString().slice(0, 10);
  
  const pendingCounts = prepare(`
    SELECT status, COUNT(*) as count
    FROM lift_applications
    WHERE status IN ('PENDING', 'SCHEDULED', 'IN_PROGRESS')
    GROUP BY status
  `).all();
  
  const todayLifts = prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
    FROM lift_records
    WHERE DATE(started_at) = ?
  `).get(today);
  
  const cranesWithPending = prepare(`
    SELECT
      c.id,
      c.code,
      c.name,
      c.max_wind_speed,
      COUNT(la.id) as pending_count,
      SUM(CASE WHEN la.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_count
    FROM cranes c
    LEFT JOIN lift_applications la ON c.id = la.crane_id 
      AND la.status IN ('PENDING', 'SCHEDULED', 'IN_PROGRESS')
    GROUP BY c.id, c.code, c.name, c.max_wind_speed
    ORDER BY pending_count DESC
  `).all();
  
  const highPriorityWaiting = prepare(`
    SELECT
      la.application_no,
      la.priority,
      m.name as material_name,
      m.priority as material_priority,
      c.code as crane_code,
      la.building_no,
      la.floor,
      la.status,
      la.requested_by
    FROM lift_applications la
    JOIN materials m ON la.material_id = m.id
    JOIN cranes c ON la.crane_id = c.id
    WHERE la.status IN ('PENDING', 'SCHEDULED')
      AND (la.priority >= 80 OR m.priority >= 80)
    ORDER BY la.priority DESC, m.priority DESC, la.created_at ASC
    LIMIT 20
  `).all();
  
  const recentCompletions = prepare(`
    SELECT
      la.application_no,
      c.code as crane_code,
      m.name as material_name,
      la.building_no,
      la.floor,
      la.completed_time,
      la.requested_by
    FROM lift_applications la
    JOIN cranes c ON la.crane_id = c.id
    JOIN materials m ON la.material_id = m.id
    WHERE la.status = 'COMPLETED'
    ORDER BY la.completed_time DESC
    LIMIT 10
  `).all();
  
  const statusMap = pendingCounts.reduce((acc, item) => {
    acc[item.status] = item.count;
    return acc;
  }, {});
  
  return {
    generated_at: new Date().toISOString(),
    today_date: today,
    overview: {
      pending: statusMap.PENDING || 0,
      scheduled: statusMap.SCHEDULED || 0,
      in_progress: statusMap.IN_PROGRESS || 0,
      today_total: todayLifts ? todayLifts.total : 0,
      today_completed: todayLifts ? todayLifts.completed : 0
    },
    cranes_status: cranesWithPending,
    high_priority_waiting: highPriorityWaiting,
    recent_completions: recentCompletions
  };
}

function getCranePerformanceReport(craneId, startDate, endDate) {
  const crane = prepare('SELECT * FROM cranes WHERE id = ?').get(craneId);
  if (!crane) {
    throw new Error(`塔吊 ${craneId} 不存在`);
  }
  
  const dateFilter = [];
  const params = [crane.max_wind_speed, craneId];
  
  if (startDate) {
    dateFilter.push('DATE(lr.started_at) >= ?');
    params.push(startDate);
  }
  if (endDate) {
    dateFilter.push('DATE(lr.started_at) <= ?');
    params.push(endDate);
  }
  
  const whereClause = dateFilter.length > 0 
    ? `WHERE lr.crane_id = ? AND ${dateFilter.join(' AND ')}`
    : 'WHERE lr.crane_id = ?';
  
  const performance = prepare(`
    SELECT
      DATE(lr.started_at) as date,
      COUNT(lr.id) as total_lifts,
      SUM(CASE WHEN lr.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_lifts,
      SUM(lr.actual_weight) as total_weight,
      AVG(lr.wind_speed) as avg_wind_speed,
      MAX(lr.wind_speed) as max_wind_speed,
      SUM(CASE WHEN lr.wind_speed > ? * 0.8 THEN 1 ELSE 0 END) as high_wind_count
    FROM lift_records lr
    ${whereClause}
    GROUP BY DATE(lr.started_at)
    ORDER BY date DESC
  `).all(...params);
  
  return {
    crane: {
      id: crane.id,
      code: crane.code,
      name: crane.name,
      max_wind_speed: crane.max_wind_speed,
      max_load: crane.max_load
    },
    period: { start_date: startDate || null, end_date: endDate || null },
    daily_performance: performance,
    summary: {
      total_days: performance.length,
      total_lifts: performance.reduce((sum, d) => sum + d.total_lifts, 0),
      completed_lifts: performance.reduce((sum, d) => sum + d.completed_lifts, 0),
      total_weight: performance.reduce((sum, d) => sum + d.total_weight, 0),
      avg_wind_speed: performance.length > 0
        ? performance.reduce((sum, d) => sum + (d.avg_wind_speed || 0), 0) / performance.length
        : 0
    }
  };
}

function getMaterialPriorityReport() {
  const report = prepare(`
    SELECT
      m.id,
      m.code,
      m.name,
      m.priority,
      m.average_weight,
      COUNT(la.id) as total_applications,
      SUM(CASE WHEN la.status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN la.status = 'SCHEDULED' THEN 1 ELSE 0 END) as scheduled_count,
      SUM(CASE WHEN la.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_count,
      SUM(CASE WHEN la.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
      SUM(CASE WHEN la.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count
    FROM materials m
    LEFT JOIN lift_applications la ON m.id = la.material_id
    GROUP BY m.id, m.code, m.name, m.priority, m.average_weight
    ORDER BY m.priority DESC
  `).all();
  
  return {
    generated_at: new Date().toISOString(),
    materials: report
  };
}

module.exports = {
  getDailyReport,
  getDashboardData,
  getCranePerformanceReport,
  getMaterialPriorityReport
};
