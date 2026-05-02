const { v4: uuidv4 } = require('uuid');
const { query, run, transaction } = require('../storage/database');

/**
 * 资源管理服务
 * 管理施工队、接触网分区、行车调度命令等资源
 */

// ==================== 施工队管理 ====================

/**
 * 获取所有施工队
 */
function getAllTeams(activeOnly = true) {
  if (activeOnly) {
    return query('SELECT * FROM construction_teams WHERE is_active = 1 ORDER BY name');
  }
  return query('SELECT * FROM construction_teams ORDER BY name');
}

/**
 * 根据 ID 获取施工队
 */
function getTeamById(id) {
  const teams = query('SELECT * FROM construction_teams WHERE id = ?', [id]);
  return teams.length > 0 ? teams[0] : null;
}

/**
 * 创建施工队
 */
function createTeam(data) {
  const id = data.id || uuidv4();
  const now = new Date().toISOString();
  
  run(
    `INSERT INTO construction_teams (
      id, name, leader_name, leader_phone, team_size,
      specialization, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.leader_name || null,
      data.leader_phone || null,
      data.team_size || null,
      data.specialization || null,
      data.is_active !== false ? 1 : 0,
      now,
      now
    ]
  );
  
  return getTeamById(id);
}

/**
 * 更新施工队
 */
function updateTeam(id, data) {
  const existing = getTeamById(id);
  if (!existing) {
    throw new Error(`施工队不存在: ${id}`);
  }
  
  const now = new Date().toISOString();
  const updates = [];
  const params = [];
  
  const fields = ['name', 'leader_name', 'leader_phone', 'team_size', 'specialization', 'is_active'];
  fields.forEach(field => {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (field === 'is_active') {
        params.push(data[field] ? 1 : 0);
      } else {
        params.push(data[field]);
      }
    }
  });
  
  updates.push('updated_at = ?');
  params.push(now, id);
  
  run(`UPDATE construction_teams SET ${updates.join(', ')} WHERE id = ?`, params);
  
  return getTeamById(id);
}

/**
 * 删除施工队
 */
function deleteTeam(id) {
  // 检查是否有关联计划
  const plans = query(
    'SELECT COUNT(*) as count FROM blockade_plans WHERE construction_team_id = ?',
    [id]
  );
  
  if (plans[0]?.count > 0) {
    throw new Error('该施工队有关联的计划，无法删除');
  }
  
  run('DELETE FROM construction_teams WHERE id = ?', [id]);
  return true;
}

// ==================== 接触网分区管理 ====================

/**
 * 获取所有接触网分区
 */
function getAllCatenaryZones(lineId = null) {
  if (lineId) {
    return query(
      'SELECT * FROM catenary_zones WHERE line_id = ? ORDER BY name',
      [lineId]
    );
  }
  return query('SELECT * FROM catenary_zones ORDER BY line_id, name');
}

/**
 * 根据 ID 获取接触网分区
 */
function getCatenaryZoneById(id) {
  const zones = query('SELECT * FROM catenary_zones WHERE id = ?', [id]);
  return zones.length > 0 ? zones[0] : null;
}

/**
 * 创建接触网分区
 */
function createCatenaryZone(data) {
  const id = data.id || uuidv4();
  const now = new Date().toISOString();
  
  run(
    `INSERT INTO catenary_zones (
      id, line_id, name, start_section_id, end_section_id,
      power_supply, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.line_id,
      data.name,
      data.start_section_id,
      data.end_section_id,
      data.power_supply || null,
      now,
      now
    ]
  );
  
  return getCatenaryZoneById(id);
}

/**
 * 更新接触网分区
 */
function updateCatenaryZone(id, data) {
  const existing = getCatenaryZoneById(id);
  if (!existing) {
    throw new Error(`接触网分区不存在: ${id}`);
  }
  
  const now = new Date().toISOString();
  const updates = [];
  const params = [];
  
  const fields = ['line_id', 'name', 'start_section_id', 'end_section_id', 'power_supply'];
  fields.forEach(field => {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(data[field]);
    }
  });
  
  updates.push('updated_at = ?');
  params.push(now, id);
  
  run(`UPDATE catenary_zones SET ${updates.join(', ')} WHERE id = ?`, params);
  
  return getCatenaryZoneById(id);
}

/**
 * 删除接触网分区
 */
function deleteCatenaryZone(id) {
  run('DELETE FROM catenary_zones WHERE id = ?', [id]);
  return true;
}

// ==================== 行车调度命令管理 ====================

/**
 * 获取所有行车调度命令
 */
function getAllDispatchCommands(activeOnly = true) {
  if (activeOnly) {
    return query('SELECT * FROM dispatch_commands WHERE is_active = 1 ORDER BY code');
  }
  return query('SELECT * FROM dispatch_commands ORDER BY code');
}

/**
 * 根据 ID 获取行车调度命令
 */
function getDispatchCommandById(id) {
  const commands = query('SELECT * FROM dispatch_commands WHERE id = ?', [id]);
  return commands.length > 0 ? commands[0] : null;
}

/**
 * 根据代码获取行车调度命令
 */
function getDispatchCommandByCode(code) {
  const commands = query('SELECT * FROM dispatch_commands WHERE code = ?', [code]);
  return commands.length > 0 ? commands[0] : null;
}

/**
 * 创建行车调度命令
 */
function createDispatchCommand(data) {
  const id = data.id || uuidv4();
  const now = new Date().toISOString();
  
  run(
    `INSERT INTO dispatch_commands (
      id, code, name, description, command_type,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.code,
      data.name,
      data.description || null,
      data.command_type || null,
      data.is_active !== false ? 1 : 0,
      now,
      now
    ]
  );
  
  return getDispatchCommandById(id);
}

/**
 * 更新行车调度命令
 */
function updateDispatchCommand(id, data) {
  const existing = getDispatchCommandById(id);
  if (!existing) {
    throw new Error(`行车调度命令不存在: ${id}`);
  }
  
  const now = new Date().toISOString();
  const updates = [];
  const params = [];
  
  const fields = ['code', 'name', 'description', 'command_type', 'is_active'];
  fields.forEach(field => {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (field === 'is_active') {
        params.push(data[field] ? 1 : 0);
      } else {
        params.push(data[field]);
      }
    }
  });
  
  updates.push('updated_at = ?');
  params.push(now, id);
  
  run(`UPDATE dispatch_commands SET ${updates.join(', ')} WHERE id = ?`, params);
  
  return getDispatchCommandById(id);
}

/**
 * 删除行车调度命令
 */
function deleteDispatchCommand(id) {
  // 检查是否有关联计划
  const plans = query(
    'SELECT COUNT(*) as count FROM blockade_plans WHERE dispatch_command_id = ?',
    [id]
  );
  
  if (plans[0]?.count > 0) {
    throw new Error('该调度命令有关联的计划，无法删除');
  }
  
  run('DELETE FROM dispatch_commands WHERE id = ?', [id]);
  return true;
}

// ==================== 资源占用查询 ====================

/**
 * 查询资源在指定时间段的占用情况
 */
function getResourceOccupations(resourceType, resourceId, startTime, endTime) {
  const occupations = query(
    `SELECT ro.*, 
      bp.plan_number, bp.status, bp.work_type,
      bp.applicant_name, bp.approver_name
     FROM resource_occupations ro
     JOIN blockade_plans bp ON ro.plan_id = bp.id
     WHERE ro.resource_type = ? 
       AND ro.resource_id = ?
       AND ro.start_time < ?
       AND ro.end_time > ?
       AND bp.status IN ('submitted', 'approved', 'emergency_approved', 'executing')
     ORDER BY ro.start_time`,
    [resourceType, resourceId, endTime, startTime]
  );
  
  return occupations;
}

/**
 * 查询区间在指定时间段的占用情况
 */
function getSectionOccupations(sectionId, startTime, endTime) {
  return getResourceOccupations('section', sectionId, startTime, endTime);
}

/**
 * 查询施工队在指定时间段的占用情况
 */
function getTeamOccupations(teamId, startTime, endTime) {
  return getResourceOccupations('team', teamId, startTime, endTime);
}

/**
 * 查询接触网分区在指定时间段的占用情况
 */
function getCatenaryOccupations(zoneId, startTime, endTime) {
  return getResourceOccupations('catenary', zoneId, startTime, endTime);
}

// ==================== 批量创建 ====================

/**
 * 批量创建资源
 */
function createResourcesBatch(data) {
  return transaction(() => {
    const result = {
      teams: [],
      catenary_zones: [],
      dispatch_commands: []
    };
    
    if (data.teams && data.teams.length > 0) {
      for (const team of data.teams) {
        result.teams.push(createTeam(team));
      }
    }
    
    if (data.catenary_zones && data.catenary_zones.length > 0) {
      for (const zone of data.catenary_zones) {
        result.catenary_zones.push(createCatenaryZone(zone));
      }
    }
    
    if (data.dispatch_commands && data.dispatch_commands.length > 0) {
      for (const cmd of data.dispatch_commands) {
        result.dispatch_commands.push(createDispatchCommand(cmd));
      }
    }
    
    return result;
  });
}

module.exports = {
  // 施工队
  getAllTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  
  // 接触网分区
  getAllCatenaryZones,
  getCatenaryZoneById,
  createCatenaryZone,
  updateCatenaryZone,
  deleteCatenaryZone,
  
  // 行车调度命令
  getAllDispatchCommands,
  getDispatchCommandById,
  getDispatchCommandByCode,
  createDispatchCommand,
  updateDispatchCommand,
  deleteDispatchCommand,
  
  // 资源占用
  getResourceOccupations,
  getSectionOccupations,
  getTeamOccupations,
  getCatenaryOccupations,
  
  // 批量操作
  createResourcesBatch
};
