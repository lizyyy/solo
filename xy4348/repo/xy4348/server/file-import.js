const { XMLParser } = require('fast-xml-parser');
const Papa = require('papaparse');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, saveDatabase } = require('./database');

// 解析GPX文件
function parseGPX(content) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: 'text'
  });
  
  const result = parser.parse(content);
  const gpx = result.gpx;
  
  const waypoints = [];
  let totalDistance = 0;
  let startTimestamp = null;
  let endTimestamp = null;
  
  // 处理trk（轨迹）
  if (gpx.trk) {
    const tracks = Array.isArray(gpx.trk) ? gpx.trk : [gpx.trk];
    
    tracks.forEach((track, trackIndex) => {
      if (track.trkseg) {
        const segments = Array.isArray(track.trkseg) ? track.trkseg : [track.trkseg];
        
        segments.forEach((segment, segmentIndex) => {
          if (segment.trkpt) {
            const points = Array.isArray(segment.trkpt) ? segment.trkpt : [segment.trkpt];
            
            points.forEach((point, pointIndex) => {
              const sequence = waypoints.length;
              const lat = parseFloat(point.lat);
              const lon = parseFloat(point.lon);
              const elevation = point.ele ? parseFloat(point.ele) : null;
              const timestamp = point.time ? new Date(point.time).toISOString() : null;
              
              // 计算与前一个点的距离
              let distanceFromStart = 0;
              if (sequence > 0) {
                const prevPoint = waypoints[sequence - 1];
                const distance = calculateDistance(
                  prevPoint.latitude, prevPoint.longitude,
                  lat, lon
                );
                distanceFromStart = prevPoint.distance_from_start + distance;
                totalDistance += distance;
              }
              
              // 计算速度（如果有时间和距离）
              let speed = null;
              if (sequence > 0 && timestamp && prevPoint.timestamp) {
                const timeDiff = (new Date(timestamp) - new Date(prevPoint.timestamp)) / 1000; // 秒
                const dist = distanceFromStart - prevPoint.distance_from_start;
                if (timeDiff > 0) {
                  speed = (dist / timeDiff) * 3.6; // 转换为km/h
                }
              }
              
              // 记录时间范围
              if (timestamp) {
                if (!startTimestamp || new Date(timestamp) < new Date(startTimestamp)) {
                  startTimestamp = timestamp;
                }
                if (!endTimestamp || new Date(timestamp) > new Date(endTimestamp)) {
                  endTimestamp = timestamp;
                }
              }
              
              waypoints.push({
                id: uuidv4(),
                latitude: lat,
                longitude: lon,
                elevation,
                speed,
                timestamp,
                sequence,
                distance_from_start: distanceFromStart
              });
            });
          }
        });
      }
    });
  }
  
  // 计算总时长
  let totalDuration = null;
  if (startTimestamp && endTimestamp) {
    totalDuration = (new Date(endTimestamp) - new Date(startTimestamp)) / 1000;
  }
  
  return {
    waypoints,
    totalDistance,
    totalDuration,
    startTimestamp,
    endTimestamp,
    gpxData: JSON.stringify(gpx)
  };
}

// 计算两点之间的距离（Haversine公式）
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径，单位米
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // 返回米
}

// 解析CSV路况文件
function parseRoadConditionCSV(content) {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8'
  });
  
  if (result.errors.length > 0) {
    console.warn('CSV解析警告:', result.errors);
  }
  
  const conditions = [];
  
  result.data.forEach((row, index) => {
    // 尝试从CSV中提取常见字段
    const condition = {
      id: uuidv4(),
      condition_type: detectConditionType(row),
      severity: detectSeverity(row),
      description: row.description || row.描述 || row.notes || '',
      latitude: parseFloat(row.latitude || row.lat || row.纬度) || null,
      longitude: parseFloat(row.longitude || row.lon || row.lng || row.经度) || null,
      speed: parseFloat(row.speed || row.速度) || null,
      speed_change: parseFloat(row.speed_change || row.速度变化) || null,
      timestamp: row.timestamp || row.time || row.时间 || null,
      photo_ids: row.photos || row.照片 || row.photo_ids || null
    };
    
    // 如果有时间戳，转换为ISO格式
    if (condition.timestamp) {
      try {
        condition.timestamp = new Date(condition.timestamp).toISOString();
      } catch (e) {
        // 保持原始格式
      }
    }
    
    conditions.push(condition);
  });
  
  return conditions;
}

// 检测路况类型
function detectConditionType(row) {
  const typeField = row.condition_type || row.type || row.类型 || row.路况类型 || '';
  const description = row.description || row.描述 || row.notes || '';
  
  // 从字段中检测
  if (typeField) {
    const lowerType = typeField.toLowerCase();
    if (lowerType.includes('坑洼') || lowerType.includes('pothole') || lowerType.includes('坑')) {
      return 'pothole';
    }
    if (lowerType.includes('照明') || lowerType.includes('light') || lowerType.includes('暗')) {
      return 'lighting';
    }
    if (lowerType.includes('逆行') || lowerType.includes('wrong_way') || lowerType.includes('冲突')) {
      return 'wrong_way';
    }
    if (lowerType.includes('障碍') || lowerType.includes('obstacle') || lowerType.includes('block')) {
      return 'obstacle';
    }
    if (lowerType.includes('积水') || lowerType.includes('water') || lowerType.includes('flood')) {
      return 'water';
    }
    if (lowerType.includes('施工') || lowerType.includes('construction') || lowerType.includes('修路')) {
      return 'construction';
    }
  }
  
  // 从描述中检测
  const lowerDesc = description.toLowerCase();
  if (lowerDesc.includes('坑洼') || lowerDesc.includes('pothole')) {
    return 'pothole';
  }
  if (lowerDesc.includes('照明') || lowerDesc.includes('太暗') || lowerDesc.includes('没灯')) {
    return 'lighting';
  }
  if (lowerDesc.includes('逆行') || lowerDesc.includes('对面') || lowerDesc.includes('冲突')) {
    return 'wrong_way';
  }
  
  return 'other';
}

// 检测严重程度
function detectSeverity(row) {
  const severityField = row.severity || row.严重程度 || row.优先级 || '';
  
  if (severityField) {
    const lower = severityField.toLowerCase();
    if (lower.includes('高') || lower.includes('high') || lower.includes('严重') || lower.includes('critical')) {
      return 'high';
    }
    if (lower.includes('低') || lower.includes('low') || lower.includes('轻微')) {
      return 'low';
    }
  }
  
  return 'medium';
}

// 解析照片索引CSV
function parsePhotoIndexCSV(content) {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8'
  });
  
  if (result.errors.length > 0) {
    console.warn('照片索引CSV解析警告:', result.errors);
  }
  
  const photos = [];
  
  result.data.forEach((row, index) => {
    const photo = {
      id: uuidv4(),
      filename: row.filename || row.文件名 || row.photo || '',
      original_path: row.path || row.路径 || '',
      latitude: parseFloat(row.latitude || row.lat || row.纬度) || null,
      longitude: parseFloat(row.longitude || row.lon || row.lng || row.经度) || null,
      timestamp: row.timestamp || row.time || row.拍摄时间 || row.时间 || null,
      description: row.description || row.描述 || row.notes || '',
      tags: row.tags || row.标签 || ''
    };
    
    if (photo.timestamp) {
      try {
        photo.timestamp = new Date(photo.timestamp).toISOString();
      } catch (e) {
        // 保持原始格式
      }
    }
    
    photos.push(photo);
  });
  
  return photos;
}

// 存储GPX路线到数据库
async function saveGPXToDatabase(batchId, routeName, gpxData) {
  const db = getDatabase();
  
  // 创建路线记录
  const routeId = uuidv4();
  db.run(`
    INSERT INTO routes (id, batch_id, name, gpx_data, total_distance, total_duration)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [routeId, batchId, routeName, gpxData.gpxData, gpxData.totalDistance, gpxData.totalDuration]);
  
  // 批量插入路点
  const waypoints = gpxData.waypoints;
  for (const wp of waypoints) {
    db.run(`
      INSERT INTO waypoints (id, route_id, latitude, longitude, elevation, speed, timestamp, sequence, distance_from_start)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [wp.id, routeId, wp.latitude, wp.longitude, wp.elevation, wp.speed, wp.timestamp, wp.sequence, wp.distance_from_start]);
  }
  
  // 创建路段（每5个路点创建一个路段，用于聚合分析）
  await createRoadSegments(routeId, waypoints);
  
  saveDatabase();
  return { routeId, waypointCount: waypoints.length };
}

// 创建路段
async function createRoadSegments(routeId, waypoints) {
  const db = getDatabase();
  const segmentSize = 5; // 每5个路点创建一个路段
  
  for (let i = 0; i < waypoints.length - 1; i += segmentSize) {
    const startIndex = i;
    const endIndex = Math.min(i + segmentSize, waypoints.length - 1);
    
    if (startIndex === endIndex) continue;
    
    const startWp = waypoints[startIndex];
    const endWp = waypoints[endIndex];
    
    // 计算路段长度
    let segmentLength = 0;
    for (let j = startIndex; j < endIndex; j++) {
      segmentLength += calculateDistance(
        waypoints[j].latitude, waypoints[j].longitude,
        waypoints[j + 1].latitude, waypoints[j + 1].longitude
      );
    }
    
    const segmentId = uuidv4();
    db.run(`
      INSERT INTO road_segments (id, route_id, start_latitude, start_longitude, end_latitude, end_longitude, segment_length, start_waypoint_id, end_waypoint_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      segmentId, routeId,
      startWp.latitude, startWp.longitude,
      endWp.latitude, endWp.longitude,
      segmentLength,
      startWp.id, endWp.id
    ]);
  }
}

// 存储路况报告到数据库
async function saveRoadConditionsToDatabase(batchId, conditions, routeId = null) {
  const db = getDatabase();
  
  for (const condition of conditions) {
    // 尝试匹配最近的路点和路段
    let matchedWaypointId = null;
    let matchedSegmentId = null;
    
    if (condition.latitude && condition.longitude && routeId) {
      const match = findNearestWaypointAndSegment(routeId, condition.latitude, condition.longitude);
      if (match) {
        matchedWaypointId = match.waypointId;
        matchedSegmentId = match.segmentId;
      }
    }
    
    db.run(`
      INSERT INTO road_conditions (
        id, batch_id, route_id, segment_id, waypoint_id,
        condition_type, severity, description,
        latitude, longitude, speed, speed_change, timestamp, photo_ids
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      condition.id, batchId, routeId, matchedSegmentId, matchedWaypointId,
      condition.condition_type, condition.severity, condition.description,
      condition.latitude, condition.longitude, condition.speed, condition.speed_change,
      condition.timestamp, condition.photo_ids
    ]);
  }
  
  saveDatabase();
  return { conditionCount: conditions.length };
}

// 存储照片到数据库
async function savePhotosToDatabase(batchId, photos, conditionIdMap = {}) {
  const db = getDatabase();
  
  for (const photo of photos) {
    // 尝试匹配路况报告
    let matchedConditionId = null;
    
    // 检查是否有通过photo_ids关联的路况
    if (photo.filename) {
      for (const [conditionId, photoIds] of Object.entries(conditionIdMap)) {
        if (photoIds.includes(photo.filename)) {
          matchedConditionId = conditionId;
          break;
        }
      }
    }
    
    // 如果没有匹配，尝试通过坐标匹配
    if (!matchedConditionId && photo.latitude && photo.longitude) {
      matchedConditionId = findNearestCondition(batchId, photo.latitude, photo.longitude);
    }
    
    db.run(`
      INSERT INTO photos (
        id, batch_id, condition_id, filename, original_path,
        latitude, longitude, timestamp, description, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      photo.id, batchId, matchedConditionId, photo.filename, photo.original_path,
      photo.latitude, photo.longitude, photo.timestamp, photo.description, photo.tags
    ]);
  }
  
  saveDatabase();
  return { photoCount: photos.length };
}

// 查找最近的路点和路段
function findNearestWaypointAndSegment(routeId, lat, lon) {
  const db = getDatabase();
  
  // 查找最近的路点
  const waypoints = db.exec(`
    SELECT id, latitude, longitude FROM waypoints WHERE route_id = ?
  `, [routeId]);
  
  if (waypoints.length === 0 || waypoints[0].values.length === 0) {
    return null;
  }
  
  let minDistance = Infinity;
  let nearestWaypoint = null;
  
  for (const row of waypoints[0].values) {
    const wpId = row[0];
    const wpLat = row[1];
    const wpLon = row[2];
    const dist = calculateDistance(lat, lon, wpLat, wpLon);
    
    if (dist < minDistance) {
      minDistance = dist;
      nearestWaypoint = wpId;
    }
  }
  
  // 查找包含该路点的路段
  let segmentId = null;
  if (nearestWaypoint) {
    const segments = db.exec(`
      SELECT id FROM road_segments 
      WHERE route_id = ? AND (start_waypoint_id = ? OR end_waypoint_id = ?)
    `, [routeId, nearestWaypoint, nearestWaypoint]);
    
    if (segments.length > 0 && segments[0].values.length > 0) {
      segmentId = segments[0].values[0][0];
    }
  }
  
  return {
    waypointId: nearestWaypoint,
    segmentId
  };
}

// 查找最近的路况报告
function findNearestCondition(batchId, lat, lon) {
  const db = getDatabase();
  
  const conditions = db.exec(`
    SELECT id, latitude, longitude FROM road_conditions 
    WHERE batch_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
  `, [batchId]);
  
  if (conditions.length === 0 || conditions[0].values.length === 0) {
    return null;
  }
  
  let minDistance = Infinity;
  let nearestCondition = null;
  
  for (const row of conditions[0].values) {
    const condId = row[0];
    const condLat = row[1];
    const condLon = row[2];
    const dist = calculateDistance(lat, lon, condLat, condLon);
    
    if (dist < minDistance && dist < 50) { // 50米范围内
      minDistance = dist;
      nearestCondition = condId;
    }
  }
  
  return nearestCondition;
}

module.exports = {
  parseGPX,
  parseRoadConditionCSV,
  parsePhotoIndexCSV,
  saveGPXToDatabase,
  saveRoadConditionsToDatabase,
  savePhotosToDatabase,
  calculateDistance
};
