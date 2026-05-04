const { v4: uuidv4 } = require('uuid');
const { getDatabase, saveDatabase } = require('./database');

// 风险类型定义
const RISK_TYPES = {
  pothole: { name: '坑洼', scoreWeight: 3, color: '#ff4d4f' },
  lighting: { name: '照明差', scoreWeight: 2, color: '#faad14' },
  wrong_way: { name: '逆行冲突', scoreWeight: 4, color: '#ff7875' },
  obstacle: { name: '障碍物', scoreWeight: 2, color: '#ffc53d' },
  water: { name: '积水', scoreWeight: 2, color: '#40a9ff' },
  construction: { name: '施工', scoreWeight: 3, color: '#ffa940' },
  other: { name: '其他', scoreWeight: 1, color: '#8c8c8c' }
};

// 严重程度权重
const SEVERITY_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 3
};

// 分析单个批次的风险
async function analyzeBatchRisks(batchId) {
  const db = getDatabase();
  
  // 清除旧的风险聚合数据
  db.run(`DELETE FROM risk_aggregations WHERE batch_id = ?`, [batchId]);
  
  // 获取所有路段
  const segmentsResult = db.exec(`
    SELECT rs.id, rs.route_id, rs.start_latitude, rs.start_longitude, 
           rs.end_latitude, rs.end_longitude, rs.segment_length,
           r.name as route_name
    FROM road_segments rs
    JOIN routes r ON rs.route_id = r.id
    WHERE r.batch_id = ?
  `, [batchId]);
  
  if (segmentsResult.length === 0 || segmentsResult[0].values.length === 0) {
    console.log('没有找到路段数据');
    return [];
  }
  
  const segments = segmentsResult[0].values.map(row => ({
    id: row[0],
    route_id: row[1],
    start_latitude: row[2],
    start_longitude: row[3],
    end_latitude: row[4],
    end_longitude: row[5],
    segment_length: row[6],
    route_name: row[7]
  }));
  
  const aggregations = [];
  
  for (const segment of segments) {
    // 获取该路段的所有路况报告
    const conditionsResult = db.exec(`
      SELECT id, condition_type, severity, speed, speed_change, is_overruled
      FROM road_conditions
      WHERE segment_id = ? AND is_overruled = 0
    `, [segment.id]);
    
    if (conditionsResult.length === 0 || conditionsResult[0].values.length === 0) {
      continue;
    }
    
    const conditions = conditionsResult[0].values.map(row => ({
      id: row[0],
      condition_type: row[1],
      severity: row[2],
      speed: row[3],
      speed_change: row[4],
      is_overruled: row[5]
    }));
    
    // 按风险类型分组聚合
    const typeGroups = {};
    conditions.forEach(cond => {
      if (!typeGroups[cond.condition_type]) {
        typeGroups[cond.condition_type] = [];
      }
      typeGroups[cond.condition_type].push(cond);
    });
    
    // 对每种风险类型创建聚合记录
    for (const [conditionType, typeConditions] of Object.entries(typeGroups)) {
      const aggregation = calculateRiskAggregation(
        segment, conditionType, typeConditions, batchId
      );
      aggregations.push(aggregation);
      
      // 保存到数据库
      saveRiskAggregation(aggregation);
    }
  }
  
  saveDatabase();
  return aggregations;
}

// 计算风险聚合
function calculateRiskAggregation(segment, conditionType, conditions, batchId) {
  const riskType = RISK_TYPES[conditionType] || RISK_TYPES.other;
  
  // 计算风险次数
  const riskCount = conditions.length;
  
  // 计算最大严重程度
  let maxSeverity = 'low';
  const severityOrder = ['low', 'medium', 'high'];
  conditions.forEach(cond => {
    if (severityOrder.indexOf(cond.severity) > severityOrder.indexOf(maxSeverity)) {
      maxSeverity = cond.severity;
    }
  });
  
  // 计算速度统计
  const validSpeeds = conditions.filter(c => c.speed !== null).map(c => c.speed);
  let avgSpeed = null, minSpeed = null, speedVariance = null;
  
  if (validSpeeds.length > 0) {
    avgSpeed = validSpeeds.reduce((sum, s) => sum + s, 0) / validSpeeds.length;
    minSpeed = Math.min(...validSpeeds);
    
    // 计算方差
    if (validSpeeds.length > 1) {
      const sumSquares = validSpeeds.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0);
      speedVariance = sumSquares / (validSpeeds.length - 1);
    }
  }
  
  // 获取关联照片数量
  const db = getDatabase();
  const photoCountResult = db.exec(`
    SELECT COUNT(*) 
    FROM photos 
    WHERE condition_id IN (SELECT id FROM road_conditions WHERE segment_id = ? AND condition_type = ?)
  `, [segment.id, conditionType]);
  
  const photoCount = photoCountResult.length > 0 && photoCountResult[0].values.length > 0 
    ? photoCountResult[0].values[0][0] 
    : 0;
  
  // 计算风险分数
  // 公式：风险次数 × 类型权重 × 最大严重程度权重 + 照片数量 × 0.5
  const riskScore = (
    riskCount * riskType.scoreWeight * SEVERITY_WEIGHTS[maxSeverity] +
    photoCount * 0.5
  );
  
  return {
    id: uuidv4(),
    batch_id: batchId,
    segment_id: segment.id,
    route_id: segment.route_id,
    route_name: segment.route_name,
    condition_type: conditionType,
    condition_type_name: riskType.name,
    risk_count: riskCount,
    max_severity: maxSeverity,
    avg_speed: avgSpeed,
    min_speed: minSpeed,
    speed_variance: speedVariance,
    photo_count: photoCount,
    risk_score: riskScore,
    color: riskType.color,
    segment: {
      start_latitude: segment.start_latitude,
      start_longitude: segment.start_longitude,
      end_latitude: segment.end_latitude,
      end_longitude: segment.end_longitude,
      length: segment.segment_length
    }
  };
}

// 保存风险聚合到数据库
function saveRiskAggregation(aggregation) {
  const db = getDatabase();
  
  db.run(`
    INSERT INTO risk_aggregations (
      id, batch_id, segment_id, condition_type, risk_count,
      max_severity, avg_speed, min_speed, speed_variance,
      photo_count, risk_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    aggregation.id, aggregation.batch_id, aggregation.segment_id,
    aggregation.condition_type, aggregation.risk_count,
    aggregation.max_severity, aggregation.avg_speed, aggregation.min_speed,
    aggregation.speed_variance, aggregation.photo_count, aggregation.risk_score
  ]);
}

// 获取高风险路段
function getHighRiskSegments(batchId, minScore = 5.0, limit = 20) {
  const db = getDatabase();
  
  const result = db.exec(`
    SELECT 
      ra.id, ra.segment_id, ra.condition_type, ra.risk_count,
      ra.max_severity, ra.avg_speed, ra.min_speed, ra.speed_variance,
      ra.photo_count, ra.risk_score,
      rs.start_latitude, rs.start_longitude, rs.end_latitude, rs.end_longitude, rs.segment_length,
      r.name as route_name
    FROM risk_aggregations ra
    JOIN road_segments rs ON ra.segment_id = rs.id
    JOIN routes r ON rs.route_id = r.id
    WHERE ra.batch_id = ? AND ra.risk_score >= ?
    ORDER BY ra.risk_score DESC
    LIMIT ?
  `, [batchId, minScore, limit]);
  
  if (result.length === 0 || result[0].values.length === 0) {
    return [];
  }
  
  return result[0].values.map(row => ({
    id: row[0],
    segment_id: row[1],
    condition_type: row[2],
    condition_type_name: RISK_TYPES[row[2]]?.name || '其他',
    risk_count: row[3],
    max_severity: row[4],
    avg_speed: row[5],
    min_speed: row[6],
    speed_variance: row[7],
    photo_count: row[8],
    risk_score: row[9],
    start_latitude: row[10],
    start_longitude: row[11],
    end_latitude: row[12],
    end_longitude: row[13],
    segment_length: row[14],
    route_name: row[15],
    color: RISK_TYPES[row[2]]?.color || '#8c8c8c'
  }));
}

// 获取路段的详细风险信息
function getSegmentRiskDetails(batchId, segmentId) {
  const db = getDatabase();
  
  // 获取路段基本信息
  const segmentResult = db.exec(`
    SELECT rs.id, rs.route_id, rs.start_latitude, rs.start_longitude,
           rs.end_latitude, rs.end_longitude, rs.segment_length,
           r.name as route_name
    FROM road_segments rs
    JOIN routes r ON rs.route_id = r.id
    WHERE rs.id = ?
  `, [segmentId]);
  
  if (segmentResult.length === 0 || segmentResult[0].values.length === 0) {
    return null;
  }
  
  const segment = {
    id: segmentResult[0].values[0][0],
    route_id: segmentResult[0].values[0][1],
    start_latitude: segmentResult[0].values[0][2],
    start_longitude: segmentResult[0].values[0][3],
    end_latitude: segmentResult[0].values[0][4],
    end_longitude: segmentResult[0].values[0][5],
    segment_length: segmentResult[0].values[0][6],
    route_name: segmentResult[0].values[0][7]
  };
  
  // 获取该路段的所有路况报告（包括已改判的，但标记出来）
  const conditionsResult = db.exec(`
    SELECT rc.id, rc.condition_type, rc.severity, rc.description,
           rc.latitude, rc.longitude, rc.speed, rc.speed_change,
           rc.timestamp, rc.is_overruled, rc.overrule_reason, rc.overruled_by,
           p.id as photo_id, p.filename, p.description as photo_desc
    FROM road_conditions rc
    LEFT JOIN photos p ON rc.id = p.condition_id
    WHERE rc.segment_id = ?
    ORDER BY rc.timestamp ASC
  `, [segmentId]);
  
  const conditions = [];
  if (conditionsResult.length > 0 && conditionsResult[0].values.length > 0) {
    const conditionMap = {};
    
    conditionsResult[0].values.forEach(row => {
      const condId = row[0];
      if (!conditionMap[condId]) {
        conditionMap[condId] = {
          id: row[0],
          condition_type: row[1],
          condition_type_name: RISK_TYPES[row[1]]?.name || '其他',
          severity: row[2],
          description: row[3],
          latitude: row[4],
          longitude: row[5],
          speed: row[6],
          speed_change: row[7],
          timestamp: row[8],
          is_overruled: row[9] === 1,
          overrule_reason: row[10],
          overruled_by: row[11],
          photos: [],
          color: RISK_TYPES[row[1]]?.color || '#8c8c8c'
        };
      }
      
      if (row[12]) {
        conditionMap[condId].photos.push({
          id: row[12],
          filename: row[13],
          description: row[14]
        });
      }
    });
    
    conditions.push(...Object.values(conditionMap));
  }
  
  // 获取风险聚合统计
  const aggregationResult = db.exec(`
    SELECT condition_type, risk_count, max_severity, risk_score, photo_count
    FROM risk_aggregations
    WHERE segment_id = ? AND batch_id = ?
  `, [segmentId, batchId]);
  
  const riskAggregations = [];
  if (aggregationResult.length > 0 && aggregationResult[0].values.length > 0) {
    riskAggregations.push(...aggregationResult[0].values.map(row => ({
      condition_type: row[0],
      condition_type_name: RISK_TYPES[row[0]]?.name || '其他',
      risk_count: row[1],
      max_severity: row[2],
      risk_score: row[3],
      photo_count: row[4],
      color: RISK_TYPES[row[0]]?.color || '#8c8c8c'
    })));
  }
  
  return {
    segment,
    conditions,
    riskAggregations
  };
}

// 人工改判路况
function overruleCondition(conditionId, isOverruled, reason, overruledBy) {
  const db = getDatabase();
  
  const result = db.run(`
    UPDATE road_conditions 
    SET is_overruled = ?,
        overrule_reason = ?,
        overruled_by = ?,
        overruled_at = datetime('now')
    WHERE id = ?
  `, [isOverruled ? 1 : 0, reason, overruledBy, conditionId]);
  
  saveDatabase();
  
  // 返回影响的行数
  return result.changes > 0;
}

// 获取统计摘要
function getBatchStatistics(batchId) {
  const db = getDatabase();
  
  // 总风险数
  const totalRiskResult = db.exec(`
    SELECT COUNT(*) FROM road_conditions WHERE batch_id = ? AND is_overruled = 0
  `, [batchId]);
  
  const totalRisks = totalRiskResult.length > 0 && totalRiskResult[0].values.length > 0 
    ? totalRiskResult[0].values[0][0] 
    : 0;
  
  // 按类型统计
  const typeStatsResult = db.exec(`
    SELECT condition_type, COUNT(*) as count,
           SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_count,
           SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_count,
           SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_count
    FROM road_conditions
    WHERE batch_id = ? AND is_overruled = 0
    GROUP BY condition_type
    ORDER BY count DESC
  `, [batchId]);
  
  const typeStats = [];
  if (typeStatsResult.length > 0 && typeStatsResult[0].values.length > 0) {
    typeStats.push(...typeStatsResult[0].values.map(row => ({
      condition_type: row[0],
      condition_type_name: RISK_TYPES[row[0]]?.name || '其他',
      count: row[1],
      high_count: row[2],
      medium_count: row[3],
      low_count: row[4],
      color: RISK_TYPES[row[0]]?.color || '#8c8c8c'
    })));
  }
  
  // 高风险路段数（风险分数 >= 10）
  const highRiskSegmentsResult = db.exec(`
    SELECT COUNT(DISTINCT segment_id) 
    FROM risk_aggregations 
    WHERE batch_id = ? AND risk_score >= 10
  `, [batchId]);
  
  const highRiskSegments = highRiskSegmentsResult.length > 0 && highRiskSegmentsResult[0].values.length > 0 
    ? highRiskSegmentsResult[0].values[0][0] 
    : 0;
  
  // 照片总数
  const photosResult = db.exec(`
    SELECT COUNT(*) FROM photos WHERE batch_id = ?
  `, [batchId]);
  
  const totalPhotos = photosResult.length > 0 && photosResult[0].values.length > 0 
    ? photosResult[0].values[0][0] 
    : 0;
  
  return {
    totalRisks,
    typeStats,
    highRiskSegments,
    totalPhotos
  };
}

module.exports = {
  analyzeBatchRisks,
  getHighRiskSegments,
  getSegmentRiskDetails,
  overruleCondition,
  getBatchStatistics,
  RISK_TYPES
};
