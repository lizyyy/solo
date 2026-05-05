const db = require('../database');
const dayjs = require('dayjs');

const POLLINATION_CONFIG = {
  optimalTemp: { min: 20, max: 30 },
  criticalTemp: { min: 12, max: 38 },
  optimalHumidity: { min: 40, max: 70 },
  criticalHumidity: { min: 20, max: 90 }
};

const RISK_TYPES = {
  SUITABLE: 'suitable',
  TEMPERATURE_RISK: 'temperature_risk',
  HUMIDITY_RISK: 'humidity_risk',
  CROSS_POLLINATION: 'cross_pollination',
  BEFORE_FLOWERING: 'before_flowering',
  AFTER_FLOWERING: 'missed_flowering',
  ISOLATION_OPEN: 'isolation_open',
  NO_OPERATOR: 'no_operator',
  MULTIPLE_RISKS: 'multiple_risks'
};

const getSensorReadingsForDate = (seedbedId, date) => {
  return db.prepare(`
    SELECT * FROM sensor_readings 
    WHERE seedbed_id = ? AND reading_date = ?
    ORDER BY reading_time
  `).all(seedbedId, date);
};

const getAverageConditions = (seedbedId, date) => {
  const readings = getSensorReadingsForDate(seedbedId, date);
  if (readings.length === 0) return null;
  
  const temps = readings.map(r => r.temperature).filter(t => t !== null);
  const humids = readings.map(r => r.humidity).filter(h => h !== null);
  
  return {
    avgTemp: temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
    minTemp: temps.length > 0 ? Math.min(...temps) : null,
    maxTemp: temps.length > 0 ? Math.max(...temps) : null,
    avgHumidity: humids.length > 0 ? humids.reduce((a, b) => a + b, 0) / humids.length : null,
    minHumidity: humids.length > 0 ? Math.min(...humids) : null,
    maxHumidity: humids.length > 0 ? Math.max(...humids) : null
  };
};

const analyzeTemperatureRisk = (conditions) => {
  if (!conditions || conditions.avgTemp === null) return 'no_data';
  
  const { avgTemp, minTemp, maxTemp } = conditions;
  const { optimalTemp, criticalTemp } = POLLINATION_CONFIG;
  
  if (maxTemp > criticalTemp.max) return `温度过高风险: 最高${maxTemp.toFixed(1)}°C, 临界值${criticalTemp.max}°C`;
  if (minTemp < criticalTemp.min) return `温度过低风险: 最低${minTemp.toFixed(1)}°C, 临界值${criticalTemp.min}°C`;
  if (avgTemp > optimalTemp.max) return `温度偏高: 平均${avgTemp.toFixed(1)}°C, 最佳上限${optimalTemp.max}°C`;
  if (avgTemp < optimalTemp.min) return `温度偏低: 平均${avgTemp.toFixed(1)}°C, 最佳下限${optimalTemp.min}°C`;
  
  return `温度适宜: 平均${avgTemp.toFixed(1)}°C, 范围${minTemp.toFixed(1)}-${maxTemp.toFixed(1)}°C`;
};

const analyzeHumidityRisk = (conditions) => {
  if (!conditions || conditions.avgHumidity === null) return 'no_data';
  
  const { avgHumidity, minHumidity, maxHumidity } = conditions;
  const { optimalHumidity, criticalHumidity } = POLLINATION_CONFIG;
  
  if (maxHumidity > criticalHumidity.max) return `湿度过高风险: 最高${maxHumidity.toFixed(1)}%, 临界值${criticalHumidity.max}%`;
  if (minHumidity < criticalHumidity.min) return `湿度过低风险: 最低${minHumidity.toFixed(1)}%, 临界值${criticalHumidity.min}%`;
  if (avgHumidity > optimalHumidity.max) return `湿度偏高: 平均${avgHumidity.toFixed(1)}%, 最佳上限${optimalHumidity.max}%`;
  if (avgHumidity < optimalHumidity.min) return `湿度偏低: 平均${avgHumidity.toFixed(1)}%, 最佳下限${optimalHumidity.min}%`;
  
  return `湿度适宜: 平均${avgHumidity.toFixed(1)}%, 范围${minHumidity.toFixed(1)}-${maxHumidity.toFixed(1)}%`;
};

const getFloweringStage = (batch, assessmentDate) => {
  if (!batch.expected_flowering_start || !batch.expected_flowering_end) {
    return 'unknown';
  }
  
  const start = dayjs(batch.expected_flowering_start);
  const end = dayjs(batch.expected_flowering_end);
  const assessment = dayjs(assessmentDate);
  
  const daysToStart = assessment.diff(start, 'day');
  const daysToEnd = end.diff(assessment, 'day');
  
  if (assessment.isBefore(start)) {
    return `未到花期: 距始花期${Math.abs(daysToStart)}天`;
  }
  if (assessment.isAfter(end)) {
    return `花期已过: 距末花期${Math.abs(daysToEnd)}天`;
  }
  if (daysToStart <= 2) {
    return `初花期: 开花第${daysToStart + 1}天`;
  }
  if (daysToEnd <= 2) {
    return `末花期: 距结束${daysToEnd}天`;
  }
  return `盛花期: 开花第${daysToStart + 1}天, 剩余${daysToEnd}天`;
};

const checkIsolationStatus = (seedbedId, assessmentDate) => {
  const schedules = db.prepare(`
    SELECT * FROM isolation_schedules
    WHERE seedbed_id = ? 
    AND date(?) BETWEEN date(start_date) AND date(end_date)
  `).all(seedbedId, assessmentDate);
  
  if (schedules.length === 0) {
    return '无隔离计划';
  }
  
  const todaySchedule = schedules[0];
  if (todaySchedule.is_open) {
    return `隔离棚开放中: ${todaySchedule.reason || '无特殊原因'}`;
  }
  return `隔离棚关闭中: ${todaySchedule.reason || '常规隔离'}`;
};

const checkCrossPollinationRisk = (batch, assessmentDate) => {
  const seedbedId = batch.seedbed_id;
  
  const otherBatches = db.prepare(`
    SELECT pb.*, s.code as seedbed_code, g.name as greenhouse_name
    FROM plant_batches pb
    JOIN seedbeds s ON pb.seedbed_id = s.id
    JOIN greenhouses g ON s.greenhouse_id = g.id
    WHERE pb.seedbed_id = ? AND pb.id != ?
    AND date(?) BETWEEN date(pb.expected_flowering_start) AND date(pb.expected_flowering_end)
  `).all(seedbedId, batch.id, assessmentDate);
  
  if (otherBatches.length === 0) {
    return '无同期开花的其他植物';
  }
  
  const sameSpecies = otherBatches.filter(b => b.plant_name === batch.plant_name);
  
  if (sameSpecies.length > 0) {
    const speciesList = sameSpecies.map(b => `${b.plant_name}(${b.variety || batch.batch_number || '未知品种'})`).join(', ');
    return `高串粉风险: 同棚有${sameSpecies.length}种同期开花的同种植物 - ${speciesList}`;
  }
  
  const otherList = otherBatches.map(b => `${b.plant_name}(${b.variety || '未知'})`).join(', ');
  return `注意: 同棚有${otherBatches.length}种同期开花植物 - ${otherList}`;
};

const checkOperatorAvailable = (assessmentDate, seedbedId) => {
  const seedbed = db.prepare(`
    SELECT s.*, g.name as greenhouse_name
    FROM seedbeds s
    JOIN greenhouses g ON s.greenhouse_id = g.id
    WHERE s.id = ?
  `).get(seedbedId);
  
  if (!seedbed) return '未知苗床';
  
  const shifts = db.prepare(`
    SELECT * FROM employee_shifts
    WHERE shift_date = ?
  `).all(assessmentDate);
  
  if (shifts.length === 0) {
    return '今日无排班记录';
  }
  
  const assignedShifts = shifts.filter(s => {
    if (!s.assigned_areas) return false;
    const areas = s.assigned_areas.split(/[,，]/);
    return areas.some(area => 
      area.includes(seedbed.code) || 
      area.includes(seedbed.greenhouse_name)
    );
  });
  
  if (assignedShifts.length > 0) {
    const operators = assignedShifts.map(s => 
      `${s.employee_name}(${s.shift_type || '正常班'}${s.start_time ? ` ${s.start_time}-${s.end_time}` : ''})`
    ).join(', ');
    return `有操作员: ${operators}`;
  }
  
  const allOperators = shifts.map(s => s.employee_name).join(', ');
  return `无指定操作员, 今日值班: ${allOperators}`;
};

const assessBatch = (batch, assessmentDate) => {
  const conditions = getAverageConditions(batch.seedbed_id, assessmentDate);
  
  const tempRisk = analyzeTemperatureRisk(conditions);
  const humidRisk = analyzeHumidityRisk(conditions);
  const floweringStage = getFloweringStage(batch, assessmentDate);
  const isolationStatus = checkIsolationStatus(batch.seedbed_id, assessmentDate);
  const crossPollinationRisk = checkCrossPollinationRisk(batch, assessmentDate);
  const operatorAvailable = checkOperatorAvailable(assessmentDate, batch.seedbed_id);
  
  const risks = [];
  const riskReasons = [];
  
  if (tempRisk.includes('风险') || tempRisk.includes('过高') || tempRisk.includes('过低')) {
    risks.push(RISK_TYPES.TEMPERATURE_RISK);
    riskReasons.push(tempRisk);
  }
  
  if (humidRisk.includes('风险') || humidRisk.includes('过高') || humidRisk.includes('过低')) {
    risks.push(RISK_TYPES.HUMIDITY_RISK);
    riskReasons.push(humidRisk);
  }
  
  if (floweringStage.includes('未到花期')) {
    risks.push(RISK_TYPES.BEFORE_FLOWERING);
    riskReasons.push(floweringStage);
  }
  
  if (floweringStage.includes('花期已过')) {
    risks.push(RISK_TYPES.AFTER_FLOWERING);
    riskReasons.push(floweringStage);
  }
  
  if (isolationStatus.includes('开放中')) {
    risks.push(RISK_TYPES.ISOLATION_OPEN);
    riskReasons.push(isolationStatus);
  }
  
  if (crossPollinationRisk.includes('高串粉风险')) {
    risks.push(RISK_TYPES.CROSS_POLLINATION);
    riskReasons.push(crossPollinationRisk);
  }
  
  if (operatorAvailable.includes('无指定') || operatorAvailable.includes('无排班')) {
    risks.push(RISK_TYPES.NO_OPERATOR);
    riskReasons.push(operatorAvailable);
  }
  
  let finalRiskType;
  let isSuitable = false;
  
  if (risks.length === 0) {
    finalRiskType = RISK_TYPES.SUITABLE;
    isSuitable = true;
  } else if (risks.length === 1) {
    finalRiskType = risks[0];
  } else {
    finalRiskType = RISK_TYPES.MULTIPLE_RISKS;
  }
  
  const existingAssessment = db.prepare(`
    SELECT * FROM daily_assessments 
    WHERE assessment_date = ? AND plant_batch_id = ?
  `).get(assessmentDate, batch.id);
  
  return {
    plant_batch_id: batch.id,
    assessment_date: assessmentDate,
    is_suitable_pollination: existingAssessment?.manual_override ? existingAssessment.is_suitable_pollination : isSuitable,
    risk_type: finalRiskType,
    risk_reason: riskReasons.join('; ') || '无风险',
    temperature_risk: tempRisk,
    humidity_risk: humidRisk,
    cross_pollination_risk: crossPollinationRisk,
    flowering_stage: floweringStage,
    isolation_status: isolationStatus,
    operator_available: operatorAvailable,
    manual_override: existingAssessment?.manual_override || 0,
    override_reason: existingAssessment?.override_reason || null,
    notes: existingAssessment?.notes || null,
    conditions
  };
};

const runDailyAssessment = (assessmentDate = dayjs().format('YYYY-MM-DD')) => {
  const batches = db.prepare(`
    SELECT pb.*, s.code as seedbed_code, g.name as greenhouse_name
    FROM plant_batches pb
    JOIN seedbeds s ON pb.seedbed_id = s.id
    JOIN greenhouses g ON s.greenhouse_id = g.id
    WHERE date(?) BETWEEN date(pb.expected_flowering_start, '-3 days') AND date(pb.expected_flowering_end, '+3 days')
  `).all(assessmentDate);
  
  const results = [];
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO daily_assessments 
    (assessment_date, plant_batch_id, is_suitable_pollination, risk_type, risk_reason,
     temperature_risk, humidity_risk, cross_pollination_risk, flowering_stage,
     isolation_status, operator_available, manual_override, override_reason, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  
  const updateStmt = db.prepare(`
    UPDATE daily_assessments SET
      is_suitable_pollination = ?, risk_type = ?, risk_reason = ?,
      temperature_risk = ?, humidity_risk = ?, cross_pollination_risk = ?, 
      flowering_stage = ?, isolation_status = ?, operator_available = ?, updated_at = CURRENT_TIMESTAMP
    WHERE assessment_date = ? AND plant_batch_id = ?
  `);
  
  for (const batch of batches) {
    const assessment = assessBatch(batch, assessmentDate);
    
    const existing = db.prepare(`
      SELECT * FROM daily_assessments WHERE assessment_date = ? AND plant_batch_id = ?
    `).get(assessmentDate, batch.id);
    
    if (existing) {
      if (existing.manual_override) {
        updateStmt.run(
          existing.is_suitable_pollination,
          assessment.risk_type,
          assessment.risk_reason,
          assessment.temperature_risk,
          assessment.humidity_risk,
          assessment.cross_pollination_risk,
          assessment.flowering_stage,
          assessment.isolation_status,
          assessment.operator_available,
          assessmentDate,
          batch.id
        );
      } else {
        updateStmt.run(
          assessment.is_suitable_pollination,
          assessment.risk_type,
          assessment.risk_reason,
          assessment.temperature_risk,
          assessment.humidity_risk,
          assessment.cross_pollination_risk,
          assessment.flowering_stage,
          assessment.isolation_status,
          assessment.operator_available,
          assessmentDate,
          batch.id
        );
      }
    } else {
      insertStmt.run(
        assessmentDate,
        batch.id,
        assessment.is_suitable_pollination,
        assessment.risk_type,
        assessment.risk_reason,
        assessment.temperature_risk,
        assessment.humidity_risk,
        assessment.cross_pollination_risk,
        assessment.flowering_stage,
        assessment.isolation_status,
        assessment.operator_available,
        assessment.manual_override,
        assessment.override_reason,
        assessment.notes
      );
    }
    
    results.push({
      ...assessment,
      batch_info: {
        plant_name: batch.plant_name,
        variety: batch.variety,
        batch_number: batch.batch_number,
        seedbed_code: batch.seedbed_code,
        greenhouse_name: batch.greenhouse_name
      }
    });
  }
  
  return {
    date: assessmentDate,
    total_assessed: results.length,
    suitable: results.filter(r => r.is_suitable_pollination).length,
    results
  };
};

const updateAssessmentWithOverride = (assessmentDate, plantBatchId, isSuitable, overrideReason, notes) => {
  const existing = db.prepare(`
    SELECT * FROM daily_assessments WHERE assessment_date = ? AND plant_batch_id = ?
  `).get(assessmentDate, plantBatchId);
  
  if (!existing) {
    throw new Error('评估记录不存在');
  }
  
  db.prepare(`
    UPDATE daily_assessments SET
      is_suitable_pollination = ?,
      manual_override = 1,
      override_reason = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE assessment_date = ? AND plant_batch_id = ?
  `).run(isSuitable ? 1 : 0, overrideReason, notes, assessmentDate, plantBatchId);
  
  return db.prepare(`
    SELECT da.*,
      pb.plant_name, pb.variety, pb.batch_number,
      s.code as seedbed_code, g.name as greenhouse_name
    FROM daily_assessments da
    JOIN plant_batches pb ON da.plant_batch_id = pb.id
    JOIN seedbeds s ON pb.seedbed_id = s.id
    JOIN greenhouses g ON s.greenhouse_id = g.id
    WHERE da.assessment_date = ? AND da.plant_batch_id = ?
  `).get(assessmentDate, plantBatchId);
};

module.exports = {
  runDailyAssessment,
  assessBatch,
  updateAssessmentWithOverride,
  RISK_TYPES,
  POLLINATION_CONFIG
};
