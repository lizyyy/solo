const WaterQualityModel = require('../models/waterQuality');
const AlertModel = require('../models/alert');
const DeathLossModel = require('../models/deathLoss');
const BatchModel = require('../models/batch');
const TankModel = require('../models/tank');
const OperationLogModel = require('../models/operationLog');

function analyzeDeathCause(deathLossId) {
  const deathLoss = DeathLossModel.getById(deathLossId);
  if (!deathLoss) {
    return { success: false, error: '死耗记录不存在' };
  }
  
  const batch = BatchModel.getById(deathLoss.batch_id);
  if (!batch) {
    return { success: false, error: '批次信息不存在' };
  }
  
  const discoveredAt = new Date(deathLoss.discovered_at);
  const entryDate = new Date(batch.entry_date);
  const analysisWindowStart = new Date(Math.max(
    entryDate.getTime(),
    discoveredAt.getTime() - 24 * 60 * 60 * 1000
  ));
  
  const waterHistory = WaterQualityModel.getByTimeRange(
    deathLoss.tank_id,
    analysisWindowStart.toISOString(),
    deathLoss.discovered_at
  );
  
  const tank = TankModel.getById(deathLoss.tank_id);
  const activeAlerts = AlertModel.getByTankId(deathLoss.tank_id)
    .filter(a => {
      const alertTime = new Date(a.created_at);
      return alertTime >= analysisWindowStart && alertTime <= discoveredAt;
    });
  
  const operationLogs = OperationLogModel.getByTarget('batch', deathLoss.batch_id)
    .concat(OperationLogModel.getByTarget('tank', deathLoss.tank_id))
    .filter(log => {
      const logTime = new Date(log.created_at);
      return logTime >= analysisWindowStart && logTime <= discoveredAt;
    });
  
  const factors = [];
  
  if (waterHistory.length > 0) {
    const tempStats = analyzeParameter(waterHistory, 'temperature', tank);
    const salinityStats = analyzeParameter(waterHistory, 'salinity', tank);
    const oxygenStats = analyzeParameter(waterHistory, 'oxygen', tank);
    
    if (tempStats.outOfRangeCount > 0) {
      factors.push({
        type: 'temperature',
        severity: tempStats.severity,
        description: `温度异常${tempStats.outOfRangeCount}次，范围: ${tempStats.min.toFixed(1)} - ${tempStats.max.toFixed(1)}°C`,
        evidence: tempStats.violations
      });
    }
    
    if (salinityStats.outOfRangeCount > 0) {
      factors.push({
        type: 'salinity',
        severity: salinityStats.severity,
        description: `盐度异常${salinityStats.outOfRangeCount}次，范围: ${salinityStats.min.toFixed(1)} - ${salinityStats.max.toFixed(1)}‰`,
        evidence: salinityStats.violations
      });
    }
    
    if (oxygenStats.outOfRangeCount > 0) {
      factors.push({
        type: 'oxygen',
        severity: oxygenStats.severity,
        description: `溶氧异常${oxygenStats.outOfRangeCount}次，范围: ${oxygenStats.min.toFixed(1)} - ${oxygenStats.max.toFixed(1)}mg/L`,
        evidence: oxygenStats.violations
      });
    }
  }
  
  const relevantAlerts = activeAlerts.filter(a => 
    a.status === 'active' || a.status === 'acknowledged'
  );
  
  if (relevantAlerts.length > 0) {
    factors.push({
      type: 'alerts',
      severity: 'high',
      description: `存在${relevantAlerts.length}条未解决的报警`,
      evidence: relevantAlerts.map(a => ({
        type: a.alert_type,
        message: a.message,
        time: a.created_at
      }))
    });
  }
  
  const handlingLogs = operationLogs.filter(log => 
    log.operation_type.includes('UPDATE') || 
    log.operation_type.includes('BIND')
  );
  
  if (handlingLogs.length > 0) {
    factors.push({
      type: 'handling',
      severity: 'medium',
      description: `发现${handlingLogs.length}次操作记录可能与死耗相关`,
      evidence: handlingLogs.map(log => ({
        operation: log.operation_type,
        time: log.created_at,
        operator: log.operator
      }))
    });
  }
  
  const analysis = {
    deathLossId,
    batchNumber: batch.batch_number,
    species: batch.species,
    tankName: deathLoss.tank_name,
    discoveredAt: deathLoss.discovered_at,
    quantity: deathLoss.quantity,
    analysisPeriod: {
      start: analysisWindowStart.toISOString(),
      end: deathLoss.discovered_at
    },
    waterQualitySamples: waterHistory.length,
    factors,
    primaryCause: null,
    confidence: 0,
    recommendations: []
  };
  
  if (factors.length > 0) {
    const sortedFactors = [...factors].sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
    
    analysis.primaryCause = sortedFactors[0].type;
    analysis.confidence = Math.min(0.9, 0.3 + sortedFactors.length * 0.2);
    
    analysis.recommendations = generateRecommendations(factors);
  } else {
    analysis.primaryCause = DeathLossModel.DEATH_CAUSE.UNKNOWN;
    analysis.confidence = 0.1;
    analysis.recommendations = ['建议检查水质监控设备', '建议延长分析时间窗口'];
  }
  
  DeathLossModel.updateStatus(deathLossId, DeathLossModel.ATTRIBUTION_STATUS.ANALYZING);
  
  return {
    success: true,
    analysis
  };
}

function analyzeParameter(records, field, tank) {
  const values = records.map(r => r[field]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  
  let minThreshold, maxThreshold;
  if (field === 'temperature') {
    minThreshold = tank.temperature_min;
    maxThreshold = tank.temperature_max;
  } else if (field === 'salinity') {
    minThreshold = tank.salinity_min;
    maxThreshold = tank.salinity_max;
  } else {
    minThreshold = tank.oxygen_min;
    maxThreshold = tank.oxygen_max;
  }
  
  const violations = [];
  let outOfRangeCount = 0;
  
  for (const record of records) {
    const value = record[field];
    if (value < minThreshold || value > maxThreshold) {
      outOfRangeCount++;
      violations.push({
        time: record.recorded_at,
        value,
        deviation: value < minThreshold 
          ? `低于阈值 ${(minThreshold - value).toFixed(2)}` 
          : `高于阈值 ${(value - maxThreshold).toFixed(2)}`
      });
    }
  }
  
  const range = maxThreshold - minThreshold;
  const maxDeviation = Math.max(
    Math.abs(min - minThreshold) / range,
    Math.abs(max - maxThreshold) / range
  );
  
  let severity = 'low';
  if (outOfRangeCount > records.length * 0.5) {
    severity = maxDeviation > 0.3 ? 'high' : 'medium';
  } else if (outOfRangeCount > 0) {
    severity = maxDeviation > 0.5 ? 'high' : 'low';
  }
  
  return {
    min, max, avg,
    outOfRangeCount,
    violations,
    severity
  };
}

function generateRecommendations(factors) {
  const recommendations = [];
  const factorTypes = factors.map(f => f.type);
  
  if (factorTypes.includes('temperature')) {
    recommendations.push('检查温控设备，调整温度至正常范围');
    recommendations.push('增加温度监测频率');
  }
  
  if (factorTypes.includes('salinity')) {
    recommendations.push('检查盐度调节系统');
    recommendations.push('检查水源质量');
  }
  
  if (factorTypes.includes('oxygen')) {
    recommendations.push('检查增氧设备运行状态');
    recommendations.push('清理增氧管道，确保通气正常');
  }
  
  if (factorTypes.includes('alerts')) {
    recommendations.push('优先处理未解决的报警');
    recommendations.push('检查报警响应流程是否及时');
  }
  
  if (factorTypes.includes('handling')) {
    recommendations.push('审查近期操作记录');
    recommendations.push('加强操作培训');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('建议进行全面的水质检测');
    recommendations.push('考虑海鲜本身的健康状况');
  }
  
  return recommendations;
}

function getTrendReport(tankId, days = 7) {
  const tank = TankModel.getById(tankId);
  if (!tank) {
    return { success: false, error: '暂养池不存在' };
  }
  
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);
  
  const waterHistory = WaterQualityModel.getByTimeRange(
    tankId,
    startTime.toISOString(),
    endTime.toISOString()
  );
  
  const batches = BatchModel.getByTankId(tankId);
  const activeBatches = batches.filter(b => b.status === 'active');
  
  const alerts = AlertModel.getByTankId(tankId).filter(a => {
    const alertTime = new Date(a.created_at);
    return alertTime >= startTime && alertTime <= endTime;
  });
  
  const deathLosses = DeathLossModel.getByTankId(tankId).filter(dl => {
    const lossTime = new Date(dl.discovered_at);
    return lossTime >= startTime && lossTime <= endTime;
  });
  
  const tempStats = calculateStats(waterHistory, 'temperature', tank);
  const salinityStats = calculateStats(waterHistory, 'salinity', tank);
  const oxygenStats = calculateStats(waterHistory, 'oxygen', tank);
  
  return {
    success: true,
    report: {
      tankId,
      tankName: tank.name,
      period: { days, start: startTime.toISOString(), end: endTime.toISOString() },
      currentStatus: tank.status,
      activeBatches: activeBatches.map(b => ({
        id: b.id,
        batchNumber: b.batch_number,
        species: b.species,
        quantity: b.quantity,
        entryDate: b.entry_date
      })),
      waterQuality: {
        temperature: tempStats,
        salinity: salinityStats,
        oxygen: oxygenStats,
        sampleCount: waterHistory.length
      },
      alerts: {
        total: alerts.length,
        active: alerts.filter(a => a.status === 'active').length,
        acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
        resolved: alerts.filter(a => a.status === 'resolved').length
      },
      deathLosses: {
        total: deathLosses.reduce((sum, dl) => sum + dl.quantity, 0),
        records: deathLosses.length,
        pending: deathLosses.filter(dl => dl.attribution_status === 'pending').length
      },
      recommendations: generateReportRecommendations(
        tank, tempStats, salinityStats, oxygenStats, alerts
      )
    }
  };
}

function calculateStats(records, field, tank) {
  if (records.length === 0) {
    return { count: 0, status: 'unknown' };
  }
  
  const values = records.map(r => r[field]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  
  let minThreshold, maxThreshold;
  if (field === 'temperature') {
    minThreshold = tank.temperature_min;
    maxThreshold = tank.temperature_max;
  } else if (field === 'salinity') {
    minThreshold = tank.salinity_min;
    maxThreshold = tank.salinity_max;
  } else {
    minThreshold = tank.oxygen_min;
    maxThreshold = tank.oxygen_max;
  }
  
  const outOfRange = values.filter(v => v < minThreshold || v > maxThreshold).length;
  const violationRate = outOfRange / values.length;
  
  let status = 'normal';
  if (violationRate > 0.3) status = 'critical';
  else if (violationRate > 0.1) status = 'warning';
  
  return {
    count: values.length,
    min: parseFloat(min.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    avg: parseFloat(avg.toFixed(2)),
    threshold: { min: minThreshold, max: maxThreshold },
    outOfRange,
    violationRate: parseFloat((violationRate * 100).toFixed(1)),
    status
  };
}

function generateReportRecommendations(tank, tempStats, salinityStats, oxygenStats, alerts) {
  const recommendations = [];
  
  if (tempStats.status === 'critical') {
    recommendations.push('温度异常严重，建议立即检查温控系统');
  } else if (tempStats.status === 'warning') {
    recommendations.push('温度存在波动，建议关注');
  }
  
  if (salinityStats.status === 'critical') {
    recommendations.push('盐度异常严重，建议检查水循环系统');
  } else if (salinityStats.status === 'warning') {
    recommendations.push('盐度存在波动，建议关注');
  }
  
  if (oxygenStats.status === 'critical') {
    recommendations.push('溶氧异常严重，建议立即检查增氧设备');
  } else if (oxygenStats.status === 'warning') {
    recommendations.push('溶氧存在波动，建议关注');
  }
  
  const activeAlerts = alerts.filter(a => a.status === 'active');
  if (activeAlerts.length > 0) {
    recommendations.push(`存在${activeAlerts.length}条未处理报警，建议优先处理`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('水质状态良好，继续保持当前管理水平');
  }
  
  return recommendations;
}

module.exports = {
  analyzeDeathCause,
  getTrendReport
};
