const { prepare } = require('../db');
const craneService = require('./craneService');
const { APPLICATION_STATES } = require('../utils/status');

function checkWindSpeedConstraints(crane, currentWind) {
  if (!crane || currentWind == null) return null;
  
  if (currentWind > crane.max_wind_speed) {
    return {
      type: 'BLOCK',
      level: 'HIGH',
      message: `当前风速 ${currentWind} m/s 超过塔吊 ${crane.code} 最大允许值 ${crane.max_wind_speed} m/s`,
      detail: {
        current_wind: currentWind,
        max_allowed: crane.max_wind_speed,
        crane: crane.code
      }
    };
  }
  
  const warningThreshold = crane.max_wind_speed * 0.8;
  if (currentWind > warningThreshold) {
    return {
      type: 'WARNING',
      level: 'MEDIUM',
      message: `当前风速 ${currentWind} m/s 接近塔吊 ${crane.code} 限制值 ${crane.max_wind_speed} m/s`,
      detail: {
        current_wind: currentWind,
        max_allowed: crane.max_wind_speed,
        crane: crane.code,
        threshold: warningThreshold
      }
    };
  }
  
  return null;
}

function checkLoadConstraints(crane, estimatedWeight) {
  if (!crane || estimatedWeight == null) return null;
  
  if (estimatedWeight > crane.max_load) {
    return {
      type: 'BLOCK',
      level: 'HIGH',
      message: `预估重量 ${estimatedWeight} 吨超过塔吊 ${crane.code} 最大起重能力 ${crane.max_load} 吨`,
      detail: {
        estimated_weight: estimatedWeight,
        max_load: crane.max_load,
        crane: crane.code
      }
    };
  }
  
  return null;
}

function checkBuildingRange(crane, buildingNo) {
  if (!crane || !buildingNo || !crane.building_range) return null;
  
  const ranges = crane.building_range.split(',').map(r => r.trim());
  const buildingMatch = ranges.some(range => {
    if (range.includes('-')) {
      const [start, end] = range.split('-').map(Number);
      const num = Number(buildingNo);
      return !isNaN(num) && num >= start && num <= end;
    }
    return range === buildingNo || range === 'ALL';
  });
  
  if (!buildingMatch) {
    return {
      type: 'BLOCK',
      level: 'HIGH',
      message: `塔吊 ${crane.code} 服务范围 ${crane.building_range} 不包含楼栋 ${buildingNo}`,
      detail: {
        building_no: buildingNo,
        building_range: crane.building_range,
        crane: crane.code
      }
    };
  }
  
  return null;
}

function evaluateApplicationConstraints(application, currentWind, pendingSameCrane = []) {
  const warnings = [];
  const blocks = [];
  
  const crane = {
    code: application.crane_code,
    max_wind_speed: application.crane_max_wind_speed,
    max_load: application.crane_max_load,
    building_range: application.crane_building_range
  };
  
  const windCheck = checkWindSpeedConstraints(crane, currentWind);
  if (windCheck) {
    if (windCheck.type === 'BLOCK') blocks.push(windCheck);
    else warnings.push(windCheck);
  }
  
  const loadCheck = checkLoadConstraints(crane, application.estimated_weight);
  if (loadCheck) {
    if (loadCheck.type === 'BLOCK') blocks.push(loadCheck);
    else warnings.push(loadCheck);
  }
  
  const rangeCheck = checkBuildingRange(crane, application.building_no);
  if (rangeCheck) {
    blocks.push(rangeCheck);
  }
  
  const sameBuildingPending = pendingSameCrane.filter(
    p => p.building_no === application.building_no && p.id !== application.id
  );
  
  if (sameBuildingPending.length > 0) {
    warnings.push({
      type: 'WARNING',
      level: 'MEDIUM',
      message: `同一塔吊 ${application.crane_code} 在楼栋 ${application.building_no} 已有 ${sameBuildingPending.length} 个待排吊次`,
      detail: {
        count: sameBuildingPending.length,
        building_no: application.building_no,
        crane: application.crane_code,
        pending_applications: sameBuildingPending.map(p => ({
          id: p.id,
          application_no: p.application_no,
          floor: p.floor,
          priority: p.priority
        }))
      }
    });
  }
  
  return {
    can_execute: blocks.length === 0,
    blocks,
    warnings
  };
}

function generateSchedule(craneId = null, currentWind = null) {
  const windData = currentWind != null ? { wind_speed: currentWind } : craneService.getLatestWindSpeed();
  const actualWind = windData ? windData.wind_speed : 0;
  
  let craneFilter = '';
  const params = [APPLICATION_STATES.PENDING, APPLICATION_STATES.SCHEDULED];
  
  if (craneId) {
    craneFilter = 'AND la.crane_id = ?';
    params.push(craneId);
  }
  
  const applications = prepare(`
    SELECT 
      la.*,
      c.code as crane_code,
      c.name as crane_name,
      c.max_wind_speed as crane_max_wind_speed,
      c.max_load as crane_max_load,
      c.building_range as crane_building_range,
      m.code as material_code,
      m.name as material_name,
      m.priority as material_priority
    FROM lift_applications la
    JOIN cranes c ON la.crane_id = c.id
    JOIN materials m ON la.material_id = m.id
    WHERE la.status IN (?, ?) ${craneFilter}
    ORDER BY la.priority DESC, la.created_at ASC
  `).all(...params);
  
  const groupedByCrane = {};
  applications.forEach(app => {
    if (!groupedByCrane[app.crane_id]) {
      groupedByCrane[app.crane_id] = [];
    }
    groupedByCrane[app.crane_id].push(app);
  });
  
  const scheduleResults = [];
  
  Object.entries(groupedByCrane).forEach(([cId, craneApps]) => {
    const sameCranePending = craneApps.filter(a => a.status === APPLICATION_STATES.PENDING);
    
    craneApps.forEach(app => {
      const evaluation = evaluateApplicationConstraints(app, actualWind, sameCranePending);
      
      scheduleResults.push({
        application_id: app.id,
        application_no: app.application_no,
        crane_id: app.crane_id,
        crane_code: app.crane_code,
        material_code: app.material_code,
        material_name: app.material_name,
        material_priority: app.material_priority,
        application_priority: app.priority,
        building_no: app.building_no,
        floor: app.floor,
        quantity: app.quantity,
        estimated_weight: app.estimated_weight,
        requested_by: app.requested_by,
        status: app.status,
        wind_speed: actualWind,
        crane_max_wind_speed: app.crane_max_wind_speed,
        crane_max_load: app.crane_max_load,
        constraints: evaluation,
        recommended_action: evaluation.can_execute 
          ? (app.status === APPLICATION_STATES.PENDING ? 'SCHEDULE' : 'READY')
          : 'REVIEW'
      });
    });
  });
  
  scheduleResults.sort((a, b) => {
    if (a.constraints.can_execute !== b.constraints.can_execute) {
      return a.constraints.can_execute ? -1 : 1;
    }
    if (b.application_priority !== a.application_priority) {
      return b.application_priority - a.application_priority;
    }
    return 0;
  });
  
  return {
    generated_at: new Date().toISOString(),
    current_wind_speed: actualWind,
    total_pending: applications.length,
    can_execute_count: scheduleResults.filter(r => r.constraints.can_execute).length,
    blocked_count: scheduleResults.filter(r => !r.constraints.can_execute).length,
    schedule: scheduleResults
  };
}

function getScheduleSummary(craneId = null) {
  let craneFilter = '';
  const params = [];
  
  if (craneId) {
    craneFilter = 'AND crane_id = ?';
    params.push(craneId);
  }
  
  const statusCounts = prepare(`
    SELECT status, COUNT(*) as count
    FROM lift_applications
    WHERE 1=1 ${craneFilter}
    GROUP BY status
  `).all(...params);
  
  const priorityDistribution = prepare(`
    SELECT 
      CASE 
        WHEN priority >= 80 THEN 'HIGH'
        WHEN priority >= 40 THEN 'MEDIUM'
        ELSE 'LOW'
      END as priority_level,
      COUNT(*) as count,
      AVG(priority) as avg_priority
    FROM lift_applications
    WHERE status IN ('PENDING', 'SCHEDULED') ${craneFilter}
    GROUP BY priority_level
    ORDER BY 
      CASE priority_level 
        WHEN 'HIGH' THEN 1 
        WHEN 'MEDIUM' THEN 2 
        ELSE 3 
      END
  `).all(...params);
  
  const materialCounts = prepare(`
    SELECT m.code, m.name, m.priority as material_priority, COUNT(la.id) as application_count
    FROM lift_applications la
    JOIN materials m ON la.material_id = m.id
    WHERE la.status IN ('PENDING', 'SCHEDULED') ${craneFilter}
    GROUP BY m.id, m.code, m.name, m.priority
    ORDER BY m.priority DESC, application_count DESC
  `).all(...params);
  
  const buildingCounts = prepare(`
    SELECT building_no, COUNT(*) as application_count
    FROM lift_applications
    WHERE status IN ('PENDING', 'SCHEDULED') ${craneFilter}
    GROUP BY building_no
    ORDER BY application_count DESC
  `).all(...params);
  
  const windData = craneService.getLatestWindSpeed();
  
  return {
    generated_at: new Date().toISOString(),
    current_wind: windData ? {
      wind_speed: windData.wind_speed,
      measured_at: windData.measured_at
    } : null,
    status_counts: statusCounts.reduce((acc, item) => {
      acc[item.status] = item.count;
      return acc;
    }, {}),
    priority_distribution: priorityDistribution,
    materials_waiting: materialCounts,
    buildings_waiting: buildingCounts
  };
}

function getReviewPanel(craneId = null) {
  const schedule = generateSchedule(craneId);
  
  const blocked = schedule.schedule.filter(r => !r.constraints.can_execute);
  const withWarnings = schedule.schedule.filter(
    r => r.constraints.can_execute && r.constraints.warnings.length > 0
  );
  const ready = schedule.schedule.filter(
    r => r.constraints.can_execute && r.constraints.warnings.length === 0
  );
  
  const windViolations = [];
  const loadViolations = [];
  const rangeViolations = [];
  
  blocked.forEach(item => {
    item.constraints.blocks.forEach(block => {
      if (block.message.includes('风速')) windViolations.push({
        application_no: item.application_no,
        crane_code: item.crane_code,
        ...block.detail
      });
      else if (block.message.includes('重量')) loadViolations.push({
        application_no: item.application_no,
        crane_code: item.crane_code,
        ...block.detail
      });
      else if (block.message.includes('楼栋')) rangeViolations.push({
        application_no: item.application_no,
        crane_code: item.crane_code,
        ...block.detail
      });
    });
  });
  
  return {
    generated_at: schedule.generated_at,
    current_wind_speed: schedule.current_wind_speed,
    summary: {
      total: schedule.total_pending,
      ready: ready.length,
      warnings: withWarnings.length,
      blocked: schedule.blocked_count
    },
    ready_list: ready,
    warning_list: withWarnings,
    blocked_list: blocked,
    violation_breakdown: {
      wind: windViolations,
      load: loadViolations,
      building_range: rangeViolations
    }
  };
}

module.exports = {
  checkWindSpeedConstraints,
  checkLoadConstraints,
  checkBuildingRange,
  evaluateApplicationConstraints,
  generateSchedule,
  getScheduleSummary,
  getReviewPanel
};
