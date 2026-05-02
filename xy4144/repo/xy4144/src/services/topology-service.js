const { v4: uuidv4 } = require('uuid');
const { query, run, transaction } = require('../storage/database');

/**
 * 线路拓扑服务
 * 管理线路、车站、区间的拓扑关系
 */

/**
 * 获取所有线路
 */
function getAllLines() {
  return query('SELECT * FROM lines ORDER BY name');
}

/**
 * 根据 ID 获取线路
 */
function getLineById(id) {
  const lines = query('SELECT * FROM lines WHERE id = ?', [id]);
  return lines.length > 0 ? lines[0] : null;
}

/**
 * 创建线路
 */
function createLine(data) {
  const id = data.id || uuidv4();
  const now = new Date().toISOString();
  
  run(
    'INSERT INTO lines (id, name, color, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, data.name, data.color || null, data.description || null, now, now]
  );
  
  return getLineById(id);
}

/**
 * 更新线路
 */
function updateLine(id, data) {
  const now = new Date().toISOString();
  const existing = getLineById(id);
  
  if (!existing) {
    throw new Error(`线路不存在: ${id}`);
  }
  
  const updates = [];
  const params = [];
  
  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.color !== undefined) {
    updates.push('color = ?');
    params.push(data.color);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }
  
  updates.push('updated_at = ?');
  params.push(now, id);
  
  run(`UPDATE lines SET ${updates.join(', ')} WHERE id = ?`, params);
  
  return getLineById(id);
}

/**
 * 删除线路（级联删除相关车站和区间）
 */
function deleteLine(id) {
  return transaction(() => {
    run('DELETE FROM sections WHERE line_id = ?', [id]);
    run('DELETE FROM stations WHERE line_id = ?', [id]);
    run('DELETE FROM lines WHERE id = ?', [id]);
    return true;
  });
}

/**
 * 获取线路的所有车站（按顺序）
 */
function getStationsByLine(lineId) {
  return query(
    'SELECT * FROM stations WHERE line_id = ? ORDER BY sequence',
    [lineId]
  );
}

/**
 * 根据 ID 获取车站
 */
function getStationById(id) {
  const stations = query('SELECT * FROM stations WHERE id = ?', [id]);
  return stations.length > 0 ? stations[0] : null;
}

/**
 * 创建车站
 */
function createStation(data) {
  const id = data.id || uuidv4();
  const now = new Date().toISOString();
  
  run(
    `INSERT INTO stations (
      id, line_id, name, sequence, is_terminal,
      latitude, longitude, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.line_id,
      data.name,
      data.sequence,
      data.is_terminal || false,
      data.latitude || null,
      data.longitude || null,
      now,
      now
    ]
  );
  
  return getStationById(id);
}

/**
 * 更新车站
 */
function updateStation(id, data) {
  const now = new Date().toISOString();
  const existing = getStationById(id);
  
  if (!existing) {
    throw new Error(`车站不存在: ${id}`);
  }
  
  const updates = [];
  const params = [];
  
  const fields = ['name', 'sequence', 'is_terminal', 'latitude', 'longitude'];
  fields.forEach(field => {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(data[field]);
    }
  });
  
  updates.push('updated_at = ?');
  params.push(now, id);
  
  run(`UPDATE stations SET ${updates.join(', ')} WHERE id = ?`, params);
  
  return getStationById(id);
}

/**
 * 删除车站
 */
function deleteStation(id) {
  run('DELETE FROM stations WHERE id = ?', [id]);
  return true;
}

/**
 * 获取线路的所有区间
 */
function getSectionsByLine(lineId) {
  return query(
    `SELECT s.*, 
      ss.name as start_station_name, 
      es.name as end_station_name
     FROM sections s
     JOIN stations ss ON s.start_station_id = ss.id
     JOIN stations es ON s.end_station_id = es.id
     WHERE s.line_id = ?
     ORDER BY ss.sequence`,
    [lineId]
  );
}

/**
 * 根据 ID 获取区间
 */
function getSectionById(id) {
  const sections = query(
    `SELECT s.*, 
      ss.name as start_station_name, 
      es.name as end_station_name
     FROM sections s
     JOIN stations ss ON s.start_station_id = ss.id
     JOIN stations es ON s.end_station_id = es.id
     WHERE s.id = ?`,
    [id]
  );
  return sections.length > 0 ? sections[0] : null;
}

/**
 * 创建区间
 */
function createSection(data) {
  const id = data.id || uuidv4();
  const now = new Date().toISOString();
  
  run(
    `INSERT INTO sections (
      id, line_id, start_station_id, end_station_id,
      name, length_km, is_up_direction, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.line_id,
      data.start_station_id,
      data.end_station_id,
      data.name,
      data.length_km || null,
      data.is_up_direction || null,
      now,
      now
    ]
  );
  
  return getSectionById(id);
}

/**
 * 更新区间
 */
function updateSection(id, data) {
  const now = new Date().toISOString();
  const existing = getSectionById(id);
  
  if (!existing) {
    throw new Error(`区间不存在: ${id}`);
  }
  
  const updates = [];
  const params = [];
  
  const fields = ['start_station_id', 'end_station_id', 'name', 'length_km', 'is_up_direction'];
  fields.forEach(field => {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(data[field]);
    }
  });
  
  updates.push('updated_at = ?');
  params.push(now, id);
  
  run(`UPDATE sections SET ${updates.join(', ')} WHERE id = ?`, params);
  
  return getSectionById(id);
}

/**
 * 删除区间
 */
function deleteSection(id) {
  run('DELETE FROM sections WHERE id = ?', [id]);
  return true;
}

/**
 * 检查区间是否连通（连续的区间集合）
 * @param {Array} sectionIds - 区间 ID 数组
 * @returns {Object} { is_connected: boolean, connected_sections: Array, disconnected_sections: Array }
 */
function checkSectionConnectivity(sectionIds) {
  if (!sectionIds || sectionIds.length === 0) {
    return {
      is_connected: true,
      connected_sections: [],
      disconnected_sections: [],
      message: '无区间需要检查'
    };
  }
  
  if (sectionIds.length === 1) {
    return {
      is_connected: true,
      connected_sections: sectionIds,
      disconnected_sections: [],
      message: '单个区间始终连通'
    };
  }
  
  // 获取所有区间的详细信息
  const placeholders = sectionIds.map(() => '?').join(',');
  const sections = query(
    `SELECT s.*, 
      ss.sequence as start_sequence, 
      es.sequence as end_sequence
     FROM sections s
     JOIN stations ss ON s.start_station_id = ss.id
     JOIN stations es ON s.end_station_id = es.id
     WHERE s.id IN (${placeholders})`,
    sectionIds
  );
  
  if (sections.length !== sectionIds.length) {
    const foundIds = sections.map(s => s.id);
    const missing = sectionIds.filter(id => !foundIds.includes(id));
    return {
      is_connected: false,
      connected_sections: foundIds,
      disconnected_sections: missing,
      message: `以下区间不存在: ${missing.join(', ')}`
    };
  }
  
  // 按线路分组检查
  const lineGroups = {};
  sections.forEach(section => {
    if (!lineGroups[section.line_id]) {
      lineGroups[section.line_id] = [];
    }
    lineGroups[section.line_id].push(section);
  });
  
  // 如果涉及多条线路，检查是否连通
  const lineIds = Object.keys(lineGroups);
  if (lineIds.length > 1) {
    return {
      is_connected: false,
      connected_sections: [],
      disconnected_sections: sectionIds,
      message: `区间涉及多条线路 (${lineIds.join(', ')})，无法连通`
    };
  }
  
  // 单条线路，检查区间顺序
  const lineSections = lineGroups[lineIds[0]];
  
  // 按起始站顺序排序
  const sortedSections = [...lineSections].sort((a, b) => a.start_sequence - b.start_sequence);
  
  // 检查是否连续
  const connected = [sortedSections[0].id];
  const disconnected = [];
  
  for (let i = 1; i < sortedSections.length; i++) {
    const prev = sortedSections[i - 1];
    const curr = sortedSections[i];
    
    // 检查前一个区间的终点是否是当前区间的起点
    if (prev.end_sequence === curr.start_sequence) {
      connected.push(curr.id);
    } else {
      disconnected.push(curr.id);
    }
  }
  
  return {
    is_connected: disconnected.length === 0,
    connected_sections: connected,
    disconnected_sections: disconnected,
    message: disconnected.length === 0 
      ? '所有区间连通' 
      : `存在 ${disconnected.length} 个不连通的区间`
  };
}

/**
 * 获取区间之间的路径（如果连通）
 */
function getSectionPath(startSectionId, endSectionId) {
  const start = getSectionById(startSectionId);
  const end = getSectionById(endSectionId);
  
  if (!start || !end) {
    return null;
  }
  
  if (start.line_id !== end.line_id) {
    return null;
  }
  
  // 获取该线路所有区间
  const allSections = getSectionsByLine(start.line_id);
  const sectionMap = {};
  allSections.forEach(s => {
    sectionMap[s.id] = s;
  });
  
  // 构建邻接表
  const adjacency = {};
  allSections.forEach(s => {
    adjacency[s.id] = [];
    allSections.forEach(other => {
      if (s.id !== other.id) {
        // 检查是否相邻（终点=起点 或 起点=终点）
        if (s.end_station_id === other.start_station_id ||
            s.start_station_id === other.end_station_id) {
          adjacency[s.id].push(other.id);
        }
      }
    });
  });
  
  // BFS 找最短路径
  const visited = new Set();
  const queue = [[startSectionId]];
  
  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    
    if (current === endSectionId) {
      return path;
    }
    
    if (visited.has(current)) {
      continue;
    }
    
    visited.add(current);
    
    for (const neighbor of adjacency[current] || []) {
      if (!visited.has(neighbor)) {
        queue.push([...path, neighbor]);
      }
    }
  }
  
  return null;
}

/**
 * 批量创建线路拓扑（线路+车站+区间）
 */
function createTopologyBatch(data) {
  return transaction(() => {
    const result = {
      line: null,
      stations: [],
      sections: []
    };
    
    // 创建线路
    result.line = createLine(data.line);
    
    // 创建车站
    if (data.stations && data.stations.length > 0) {
      data.stations.forEach((station, index) => {
        const created = createStation({
          ...station,
          line_id: result.line.id,
          sequence: station.sequence !== undefined ? station.sequence : index
        });
        result.stations.push(created);
      });
    }
    
    // 创建区间
    if (data.sections && data.sections.length > 0) {
      data.sections.forEach(section => {
        const created = createSection({
          ...section,
          line_id: result.line.id
        });
        result.sections.push(created);
      });
    }
    
    return result;
  });
}

module.exports = {
  // 线路
  getAllLines,
  getLineById,
  createLine,
  updateLine,
  deleteLine,
  
  // 车站
  getStationsByLine,
  getStationById,
  createStation,
  updateStation,
  deleteStation,
  
  // 区间
  getSectionsByLine,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
  
  // 拓扑检查
  checkSectionConnectivity,
  getSectionPath,
  createTopologyBatch
};
