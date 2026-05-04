const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { format } = require('date-fns');
const { getDatabase } = require('./database');
const { getHighRiskSegments, getBatchStatistics, RISK_TYPES } = require('./risk-analysis');

const EXPORT_DIR = path.join(__dirname, '../exports');

// 确保导出目录存在
function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

// 导出Markdown整改建议
async function exportMarkdownReport(batchId, options = {}) {
  ensureExportDir();
  
  const db = getDatabase();
  
  // 获取批次信息
  const batchResult = db.exec(`
    SELECT id, name, description, created_at 
    FROM inspection_batches 
    WHERE id = ?
  `, [batchId]);
  
  if (batchResult.length === 0 || batchResult[0].values.length === 0) {
    throw new Error('批次不存在');
  }
  
  const batch = {
    id: batchResult[0].values[0][0],
    name: batchResult[0].values[0][1],
    description: batchResult[0].values[0][2],
    created_at: batchResult[0].values[0][3]
  };
  
  // 获取统计信息
  const stats = getBatchStatistics(batchId);
  
  // 获取高风险路段
  const highRiskSegments = getHighRiskSegments(batchId, 5.0, 100);
  
  // 按风险类型分组
  const riskByType = {};
  highRiskSegments.forEach(segment => {
    if (!riskByType[segment.condition_type]) {
      riskByType[segment.condition_type] = [];
    }
    riskByType[segment.condition_type].push(segment);
  });
  
  // 生成Markdown内容
  let markdown = `# 路况勘察整改建议报告\n\n`;
  
  // 基本信息
  markdown += `## 报告基本信息\n\n`;
  markdown += `- **报告编号**: ${batch.id}\n`;
  markdown += `- **勘察批次**: ${batch.name}\n`;
  markdown += `- **生成时间**: ${format(new Date(), 'yyyy年MM月dd日 HH:mm:ss')}\n`;
  markdown += `- **勘察时间**: ${format(new Date(batch.created_at), 'yyyy年MM月dd日 HH:mm:ss')}\n`;
  if (batch.description) {
    markdown += `- **描述**: ${batch.description}\n`;
  }
  markdown += `\n---\n\n`;
  
  // 统计摘要
  markdown += `## 风险统计摘要\n\n`;
  markdown += `| 指标 | 数值 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 总风险报告数 | ${stats.totalRisks} |\n`;
  markdown += `| 高风险路段数 | ${stats.highRiskSegments} |\n`;
  markdown += `| 照片证据数 | ${stats.totalPhotos} |\n\n`;
  
  // 按类型统计
  if (stats.typeStats.length > 0) {
    markdown += `### 按风险类型统计\n\n`;
    markdown += `| 风险类型 | 总数 | 高风险 | 中风险 | 低风险 |\n`;
    markdown += `|----------|------|--------|--------|--------|\n`;
    stats.typeStats.forEach(stat => {
      markdown += `| ${stat.condition_type_name} | ${stat.count} | ${stat.high_count} | ${stat.medium_count} | ${stat.low_count} |\n`;
    });
    markdown += `\n`;
  }
  
  markdown += `---\n\n`;
  
  // 高风险路段详情
  markdown += `## 高风险路段详情\n\n`;
  
  if (highRiskSegments.length === 0) {
    markdown += `本次勘察未发现高风险路段。\n\n`;
  } else {
    // 按风险分数排序
    const sortedSegments = [...highRiskSegments].sort((a, b) => b.risk_score - a.risk_score);
    
    // Top 10 高风险路段
    markdown += `### TOP 10 高风险路段\n\n`;
    const topSegments = sortedSegments.slice(0, 10);
    
    topSegments.forEach((segment, index) => {
      const severityText = { high: '高', medium: '中', low: '低' }[segment.max_severity] || '未知';
      
      markdown += `#### ${index + 1}. ${segment.condition_type_name} - 风险分数: ${segment.risk_score.toFixed(1)}\n\n`;
      markdown += `- **路线**: ${segment.route_name}\n`;
      markdown += `- **风险类型**: ${segment.condition_type_name}\n`;
      markdown += `- **风险次数**: ${segment.risk_count} 次\n`;
      markdown += `- **最大严重程度**: ${severityText}\n`;
      markdown += `- **路段长度**: ${(segment.segment_length || 0).toFixed(1)} 米\n`;
      
      if (segment.avg_speed !== null) {
        markdown += `- **平均速度**: ${segment.avg_speed.toFixed(1)} km/h\n`;
      }
      if (segment.min_speed !== null) {
        markdown += `- **最低速度**: ${segment.min_speed.toFixed(1)} km/h\n`;
      }
      
      markdown += `- **照片证据**: ${segment.photo_count} 张\n`;
      markdown += `- **位置**: 起点 (${segment.start_latitude}, ${segment.start_longitude}) - 终点 (${segment.end_latitude}, ${segment.end_longitude})\n\n`;
      
      // 整改建议
      markdown += `**整改建议**:\n\n`;
      markdown += getRecommendation(segment.condition_type, segment.risk_count, segment.max_severity);
      markdown += `\n`;
    });
  }
  
  markdown += `---\n\n`;
  
  // 按风险类型的整改建议
  if (Object.keys(riskByType).length > 0) {
    markdown += `## 按风险类型汇总分析\n\n`;
    
    for (const [conditionType, segments] of Object.entries(riskByType)) {
      const typeInfo = RISK_TYPES[conditionType] || RISK_TYPES.other;
      const totalCount = segments.reduce((sum, s) => sum + s.risk_count, 0);
      const avgScore = segments.reduce((sum, s) => sum + s.risk_score, 0) / segments.length;
      
      markdown += `### ${typeInfo.name}\n\n`;
      markdown += `- **涉及路段数**: ${segments.length} 段\n`;
      markdown += `- **总风险次数**: ${totalCount} 次\n`;
      markdown += `- **平均风险分数**: ${avgScore.toFixed(1)}\n\n`;
      
      markdown += `**整体整改建议**:\n\n`;
      markdown += getOverallRecommendation(conditionType, segments);
      markdown += `\n`;
    }
  }
  
  markdown += `---\n\n`;
  
  // 附录
  markdown += `## 附录\n\n`;
  markdown += `### 风险类型说明\n\n`;
  markdown += `| 风险类型 | 权重系数 | 说明 |\n`;
  markdown += `|----------|----------|------|\n`;
  Object.entries(RISK_TYPES).forEach(([key, value]) => {
    markdown += `| ${value.name} | ${value.scoreWeight} | ${getTypeDescription(key)} |\n`;
  });
  
  markdown += `\n### 风险分数计算方法\n\n`;
  markdown += `风险分数 = 风险次数 × 类型权重 × 严重程度权重 + 照片数量 × 0.5\n\n`;
  markdown += `其中严重程度权重：低=1，中=2，高=3\n`;
  
  // 保存文件
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const safeBatchName = batch.name.replace(/[\\/:*?"<>|]/g, '_');
  const filename = `整改建议_${safeBatchName}_${timestamp}.md`;
  const filepath = path.join(EXPORT_DIR, filename);
  
  fs.writeFileSync(filepath, markdown, 'utf-8');
  
  return {
    success: true,
    filename,
    filepath,
    content: markdown
  };
}

// 导出JSON审计包
async function exportJsonAudit(batchId, options = {}) {
  ensureExportDir();
  
  const db = getDatabase();
  
  // 获取批次信息
  const batchResult = db.exec(`
    SELECT id, name, description, created_at 
    FROM inspection_batches 
    WHERE id = ?
  `, [batchId]);
  
  if (batchResult.length === 0 || batchResult[0].values.length === 0) {
    throw new Error('批次不存在');
  }
  
  const batch = {
    id: batchResult[0].values[0][0],
    name: batchResult[0].values[0][1],
    description: batchResult[0].values[0][2],
    created_at: batchResult[0].values[0][3]
  };
  
  // 获取所有路线
  const routesResult = db.exec(`
    SELECT id, batch_id, name, total_distance, total_duration, created_at
    FROM routes WHERE batch_id = ?
  `, [batchId]);
  
  const routes = [];
  if (routesResult.length > 0 && routesResult[0].values.length > 0) {
    routes.push(...routesResult[0].values.map(row => ({
      id: row[0],
      batch_id: row[1],
      name: row[2],
      total_distance: row[3],
      total_duration: row[4],
      created_at: row[5]
    })));
  }
  
  // 获取所有路段
  const segmentsResult = db.exec(`
    SELECT rs.id, rs.route_id, rs.start_latitude, rs.start_longitude,
           rs.end_latitude, rs.end_longitude, rs.segment_length,
           r.name as route_name
    FROM road_segments rs
    JOIN routes r ON rs.route_id = r.id
    WHERE r.batch_id = ?
  `, [batchId]);
  
  const segments = [];
  if (segmentsResult.length > 0 && segmentsResult[0].values.length > 0) {
    segments.push(...segmentsResult[0].values.map(row => ({
      id: row[0],
      route_id: row[1],
      start_latitude: row[2],
      start_longitude: row[3],
      end_latitude: row[4],
      end_longitude: row[5],
      segment_length: row[6],
      route_name: row[7]
    })));
  }
  
  // 获取所有路况报告（包括已改判的）
  const conditionsResult = db.exec(`
    SELECT rc.id, rc.batch_id, rc.route_id, rc.segment_id, rc.waypoint_id,
           rc.condition_type, rc.severity, rc.description,
           rc.latitude, rc.longitude, rc.speed, rc.speed_change,
           rc.timestamp, rc.photo_ids, rc.is_overruled,
           rc.overrule_reason, rc.overruled_by, rc.overruled_at, rc.created_at
    FROM road_conditions rc
    WHERE rc.batch_id = ?
  `, [batchId]);
  
  const conditions = [];
  if (conditionsResult.length > 0 && conditionsResult[0].values.length > 0) {
    conditions.push(...conditionsResult[0].values.map(row => ({
      id: row[0],
      batch_id: row[1],
      route_id: row[2],
      segment_id: row[3],
      waypoint_id: row[4],
      condition_type: row[5],
      condition_type_name: RISK_TYPES[row[5]]?.name || '其他',
      severity: row[6],
      description: row[7],
      latitude: row[8],
      longitude: row[9],
      speed: row[10],
      speed_change: row[11],
      timestamp: row[12],
      photo_ids: row[13],
      is_overruled: row[14] === 1,
      overrule_reason: row[15],
      overruled_by: row[16],
      overruled_at: row[17],
      created_at: row[18]
    })));
  }
  
  // 获取所有照片
  const photosResult = db.exec(`
    SELECT p.id, p.batch_id, p.condition_id, p.filename, p.original_path,
           p.latitude, p.longitude, p.timestamp, p.description, p.tags, p.created_at
    FROM photos p
    WHERE p.batch_id = ?
  `, [batchId]);
  
  const photos = [];
  if (photosResult.length > 0 && photosResult[0].values.length > 0) {
    photos.push(...photosResult[0].values.map(row => ({
      id: row[0],
      batch_id: row[1],
      condition_id: row[2],
      filename: row[3],
      original_path: row[4],
      latitude: row[5],
      longitude: row[6],
      timestamp: row[7],
      description: row[8],
      tags: row[9],
      created_at: row[10]
    })));
  }
  
  // 获取风险聚合
  const aggregationsResult = db.exec(`
    SELECT ra.id, ra.batch_id, ra.segment_id, ra.condition_type,
           ra.risk_count, ra.max_severity, ra.avg_speed, ra.min_speed,
           ra.speed_variance, ra.photo_count, ra.risk_score,
           rs.start_latitude, rs.start_longitude, rs.end_latitude, rs.end_longitude, rs.segment_length,
           r.name as route_name
    FROM risk_aggregations ra
    JOIN road_segments rs ON ra.segment_id = rs.id
    JOIN routes r ON rs.route_id = r.id
    WHERE ra.batch_id = ?
  `, [batchId]);
  
  const riskAggregations = [];
  if (aggregationsResult.length > 0 && aggregationsResult[0].values.length > 0) {
    riskAggregations.push(...aggregationsResult[0].values.map(row => ({
      id: row[0],
      batch_id: row[1],
      segment_id: row[2],
      condition_type: row[3],
      condition_type_name: RISK_TYPES[row[3]]?.name || '其他',
      risk_count: row[4],
      max_severity: row[5],
      avg_speed: row[6],
      min_speed: row[7],
      speed_variance: row[8],
      photo_count: row[9],
      risk_score: row[10],
      start_latitude: row[11],
      start_longitude: row[12],
      end_latitude: row[13],
      end_longitude: row[14],
      segment_length: row[15],
      route_name: row[16],
      color: RISK_TYPES[row[3]]?.color || '#8c8c8c'
    })));
  }
  
  // 构建完整的审计包
  const auditPackage = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    batch: batch,
    summary: {
      total_routes: routes.length,
      total_segments: segments.length,
      total_conditions: conditions.length,
      total_photos: photos.length,
      total_risk_aggregations: riskAggregations.length
    },
    data: {
      routes,
      segments,
      conditions,
      photos,
      risk_aggregations: riskAggregations
    },
    metadata: {
      risk_types: RISK_TYPES,
      export_info: {
        type: 'json_audit',
        timestamp: new Date().toISOString()
      }
    }
  };
  
  // 保存文件
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const safeBatchName = batch.name.replace(/[\\/:*?"<>|]/g, '_');
  const filename = `审计包_${safeBatchName}_${timestamp}.json`;
  const filepath = path.join(EXPORT_DIR, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(auditPackage, null, 2), 'utf-8');
  
  return {
    success: true,
    filename,
    filepath,
    content: auditPackage
  };
}

// 获取单条整改建议
function getRecommendation(conditionType, riskCount, maxSeverity) {
  const severityMultiplier = { high: 3, medium: 2, low: 1 }[maxSeverity] || 1;
  const urgency = riskCount * severityMultiplier;
  
  let recommendation = '';
  
  switch (conditionType) {
    case 'pothole':
      if (urgency >= 6) {
        recommendation += `1. **紧急修复**: 该路段坑洼频发，建议立即安排道路修补，防止车辆损坏和事故发生。\n`;
        recommendation += `2. **设置警示**: 在坑洼区域前设置明显警示标志，提醒骑行者减速绕行。\n`;
        recommendation += `3. **定期检查**: 增加该路段的巡检频率，及时发现和处理新出现的坑洼。\n`;
      } else {
        recommendation += `1. **计划修复**: 将该路段纳入道路维护计划，安排修补坑洼。\n`;
        recommendation += `2. **监测预警**: 持续关注该路段坑洼发展情况，必要时提升处理优先级。\n`;
      }
      break;
      
    case 'lighting':
      if (urgency >= 6) {
        recommendation += `1. **紧急增亮**: 立即评估并增加该路段的照明设施，提高夜间可见度。\n`;
        recommendation += `2. **检查维护**: 全面检查现有照明设备，修复故障灯具。\n`;
        recommendation += `3. **反光标识**: 增设反光标识和警示标志，提高夜间辨识度。\n`;
      } else {
        recommendation += `1. **照明评估**: 对该路段照明情况进行专业评估，确定改进方案。\n`;
        recommendation += `2. **逐步改善**: 根据评估结果，分阶段改善照明条件。\n`;
      }
      break;
      
    case 'wrong_way':
      if (urgency >= 6) {
        recommendation += `1. **隔离设施**: 考虑设置物理隔离设施，防止逆行车辆进入。\n`;
        recommendation += `2. **加强执法**: 协调交管部门增加该路段的执法力度。\n`;
        recommendation += `3. **警示标识**: 增设禁止逆行的明显标识和警示灯。\n`;
      } else {
        recommendation += `1. **标识优化**: 优化交通标识，明确行驶方向。\n`;
        recommendation += `2. **宣传提醒**: 通过骑行社渠道提醒会员注意该路段的逆行风险。\n`;
      }
      break;
      
    case 'obstacle':
      recommendation += `1. **清除障碍**: 立即清除或移走路段上的障碍物。\n`;
      recommendation += `2. **源头治理**: 分析障碍物来源，从源头上解决问题。\n`;
      recommendation += `3. **警示提示**: 在障碍物无法立即清除时，设置明显警示。\n`;
      break;
      
    case 'water':
      if (urgency >= 6) {
        recommendation += `1. **排水改善**: 评估并改善该路段的排水系统，防止积水。\n`;
        recommendation += `2. **警示标识**: 增设积水警示标识，提醒雨天注意。\n`;
      } else {
        recommendation += `1. **排水检查**: 检查排水设施是否堵塞，及时清理。\n`;
        recommendation += `2. **预警提醒**: 雨天出行前提醒会员注意该路段可能积水。\n`;
      }
      break;
      
    case 'construction':
      recommendation += `1. **关注进度**: 持续关注施工进度，及时更新路线信息。\n`;
      recommendation += `2. **绕行建议**: 为骑行者提供可行的绕行路线。\n`;
      recommendation += `3. **安全提醒**: 提醒会员经过施工路段时注意安全，减速慢行。\n`;
      break;
      
    default:
      recommendation += `1. **现场核查**: 建议对该路段进行现场核查，确认风险性质。\n`;
      recommendation += `2. **分类处理**: 根据核查结果，按相应风险类型进行处理。\n`;
  }
  
  return recommendation;
}

// 获取整体整改建议
function getOverallRecommendation(conditionType, segments) {
  let recommendation = '';
  
  switch (conditionType) {
    case 'pothole':
      recommendation += `本次勘察发现 **${segments.length}** 段道路存在坑洼问题，总风险次数 **${segments.reduce((sum, s) => sum + s.risk_count, 0)}** 次。\n\n`;
      recommendation += `- **短期措施**: 对高风险路段立即进行紧急修补，设置警示标志。\n`;
      recommendation += `- **中期措施**: 制定全面的道路修补计划，按优先级分阶段实施。\n`;
      recommendation += `- **长期措施**: 建议相关部门对路面状况进行整体评估，考虑道路翻修或重建。\n`;
      recommendation += `- **骑行建议**: 提醒骑行者经过这些路段时减速慢行，注意避让坑洼。\n`;
      break;
      
    case 'lighting':
      recommendation += `本次勘察发现 **${segments.length}** 段道路存在照明不足问题。\n\n`;
      recommendation += `- **短期措施**: 对严重照明不足的路段增设临时照明设备。\n`;
      recommendation += `- **中期措施**: 协调相关部门对照明系统进行全面检修和升级。\n`;
      recommendation += `- **长期措施**: 建议在道路规划中充分考虑照明需求，确保夜间骑行安全。\n`;
      recommendation += `- **骑行建议**: 建议夜间骑行配备高质量车灯，结伴出行，尽量避开照明差的路段。\n`;
      break;
      
    case 'wrong_way':
      recommendation += `本次勘察发现 **${segments.length}** 段道路存在逆行冲突风险。\n\n`;
      recommendation += `- **短期措施**: 在高风险路段增设醒目的禁止逆行标识。\n`;
      recommendation += `- **中期措施**: 协调交管部门加强执法，同时考虑设置物理隔离设施。\n`;
      recommendation += `- **长期措施**: 建议优化交通组织设计，从根本上减少逆行发生的可能。\n`;
      recommendation += `- **骑行建议**: 提醒骑行者注意观察路况，提前预判可能的逆行车辆，保持安全距离。\n`;
      break;
      
    default:
      recommendation += `本次勘察发现 **${segments.length}** 段道路存在相关问题。建议结合具体路段情况，制定针对性的整改措施。\n`;
  }
  
  return recommendation;
}

// 获取风险类型描述
function getTypeDescription(conditionType) {
  const descriptions = {
    pothole: '路面存在坑洼、凹陷等损坏，可能导致车辆颠簸或失控',
    lighting: '路段照明不足，夜间视线差，增加事故风险',
    wrong_way: '存在逆向行驶车辆，容易发生正面碰撞',
    obstacle: '路面存在障碍物，影响正常通行',
    water: '路段存在积水，影响骑行安全',
    construction: '路段正在施工，通行条件受限',
    other: '其他未分类的路况问题'
  };
  return descriptions[conditionType] || '其他路况问题';
}

module.exports = {
  exportMarkdownReport,
  exportJsonAudit,
  EXPORT_DIR
};
