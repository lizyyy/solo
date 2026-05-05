const express = require('express');
const router = express.Router();
const db = require('../database');

const CONFIG = {
  TEMPERATURE_LOW: 20,
  TEMPERATURE_HIGH: 26,
  HUMIDITY_LOW: 40,
  HUMIDITY_HIGH: 70,
  SHORT_DOOR_OPEN_MINUTES: 10,
  ABNORMAL_DURATION_MINUTES: 30,
  RISK_SCORES: {
    temperature_high: 15,
    temperature_low: 15,
    humidity_high: 10,
    humidity_low: 10,
    condensation_alarm: 25,
    inspection_issue: 20,
    complaint: 30,
    sustained_abnormal: 20,
    multiple_alarms: 25
  }
};

router.post('/recalculate', (req, res) => {
  try {
    const allCabins = getAllCabins();
    
    allCabins.then(cabins => {
      const results = cabins.map(cabin => analyzeCabin(cabin.cabin_number));
      
      Promise.all(results)
        .then(analysisResults => {
          const successCount = analysisResults.filter(r => r.success).length;
          res.json({
            success: true,
            message: `成功分析 ${successCount} 个舱房`,
            total: cabins.length,
            analyzed: successCount
          });
        })
        .catch(error => {
          console.error('批量分析失败:', error);
          res.status(500).json({ error: '分析失败: ' + error.message });
        });
    });
  } catch (error) {
    console.error('重算分析失败:', error);
    res.status(500).json({ error: '重算分析失败: ' + error.message });
  }
});

function getAllCabins() {
  return new Promise((resolve, reject) => {
    const query = 'SELECT DISTINCT cabin_number FROM cabins ORDER BY cabin_number';
    db.all(query, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function analyzeCabin(cabinNumber) {
  return new Promise(async (resolve, reject) => {
    try {
      const [sensorData, alarms, inspections, complaints] = await Promise.all([
        getSensorData(cabinNumber),
        getAlarms(cabinNumber),
        getInspections(cabinNumber),
        getComplaints(cabinNumber)
      ]);
      
      const analysis = performAnalysis(cabinNumber, sensorData, alarms, inspections, complaints);
      await saveAnalysis(cabinNumber, analysis);
      
      resolve({ success: true, cabinNumber, analysis });
    } catch (error) {
      console.error(`分析舱房 ${cabinNumber} 失败:`, error);
      resolve({ success: false, cabinNumber, error: error.message });
    }
  });
}

function getSensorData(cabinNumber) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM sensor_data 
      WHERE cabin_number = ? 
      ORDER BY timestamp DESC 
      LIMIT 100
    `;
    db.all(query, [cabinNumber], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getAlarms(cabinNumber) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM alarm_data 
      WHERE cabin_number = ? 
      ORDER BY alarm_time DESC 
      LIMIT 50
    `;
    db.all(query, [cabinNumber], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getInspections(cabinNumber) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM inspection_data 
      WHERE cabin_number = ? 
      ORDER BY inspection_date DESC 
      LIMIT 20
    `;
    db.all(query, [cabinNumber], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getComplaints(cabinNumber) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM complaints 
      WHERE cabin_number = ? 
      ORDER BY complaint_time DESC 
      LIMIT 20
    `;
    db.all(query, [cabinNumber], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function performAnalysis(cabinNumber, sensorData, alarms, inspections, complaints) {
  let riskScore = 0;
  const evidence = [];
  const reasons = [];
  
  const sensorAnalysis = analyzeSensorData(sensorData);
  if (sensorAnalysis.abnormal) {
    riskScore += sensorAnalysis.score;
    evidence.push(...sensorAnalysis.evidence);
    reasons.push(...sensorAnalysis.reasons);
  }
  
  const alarmAnalysis = analyzeAlarms(alarms);
  if (alarmAnalysis.hasCritical) {
    riskScore += alarmAnalysis.score;
    evidence.push(...alarmAnalysis.evidence);
    reasons.push(...alarmAnalysis.reasons);
  }
  
  const inspectionAnalysis = analyzeInspections(inspections);
  if (inspectionAnalysis.hasIssues) {
    riskScore += inspectionAnalysis.score;
    evidence.push(...inspectionAnalysis.evidence);
    reasons.push(...inspectionAnalysis.reasons);
  }
  
  const complaintAnalysis = analyzeComplaints(complaints);
  if (complaintAnalysis.hasActive) {
    riskScore += complaintAnalysis.score;
    evidence.push(...complaintAnalysis.evidence);
    reasons.push(...complaintAnalysis.reasons);
  }
  
  const isFalseAlarm = checkFalseAlarm(sensorData, alarms);
  
  let riskLevel = '正常';
  let maintenanceStatus = '无需维修';
  let maintenancePriority = '低';
  
  if (isFalseAlarm) {
    riskLevel = '误报';
    maintenanceStatus = '误报排除';
  } else if (riskScore >= 50) {
    riskLevel = '高风险';
    maintenanceStatus = '需优先检修';
    maintenancePriority = '高';
  } else if (riskScore >= 30) {
    riskLevel = '中风险';
    maintenanceStatus = '需检修';
    maintenancePriority = '中';
  } else if (riskScore >= 15) {
    riskLevel = '低风险';
    maintenanceStatus = '建议检查';
    maintenancePriority = '低';
  }
  
  return {
    riskLevel,
    riskScore,
    isFalseAlarm: isFalseAlarm ? 1 : 0,
    analysisReason: reasons.join('; '),
    evidence: JSON.stringify(evidence),
    maintenanceStatus,
    maintenancePriority,
    analyzedAt: new Date().toISOString()
  };
}

function analyzeSensorData(sensorData) {
  if (!sensorData || sensorData.length === 0) {
    return { abnormal: false, score: 0, evidence: [], reasons: [] };
  }
  
  const score = 0;
  const evidence = [];
  const reasons = [];
  
  const recentData = sensorData.slice(0, 10);
  const tempValues = recentData.map(d => d.temperature).filter(t => t !== null);
  const humValues = recentData.map(d => d.humidity).filter(h => h !== null);
  
  if (tempValues.length > 0) {
    const avgTemp = tempValues.reduce((a, b) => a + b, 0) / tempValues.length;
    const minTemp = Math.min(...tempValues);
    const maxTemp = Math.max(...tempValues);
    
    if (maxTemp > CONFIG.TEMPERATURE_HIGH) {
      evidence.push({
        type: 'temperature_high',
        value: maxTemp,
        threshold: CONFIG.TEMPERATURE_HIGH,
        description: `温度过高: ${maxTemp.toFixed(1)}°C`
      });
      reasons.push(`温度超过阈值 ${CONFIG.TEMPERATURE_HIGH}°C`);
    }
    
    if (minTemp < CONFIG.TEMPERATURE_LOW) {
      evidence.push({
        type: 'temperature_low',
        value: minTemp,
        threshold: CONFIG.TEMPERATURE_LOW,
        description: `温度过低: ${minTemp.toFixed(1)}°C`
      });
      reasons.push(`温度低于阈值 ${CONFIG.TEMPERATURE_LOW}°C`);
    }
  }
  
  if (humValues.length > 0) {
    const avgHum = humValues.reduce((a, b) => a + b, 0) / humValues.length;
    const minHum = Math.min(...humValues);
    const maxHum = Math.max(...humValues);
    
    if (maxHum > CONFIG.HUMIDITY_HIGH) {
      evidence.push({
        type: 'humidity_high',
        value: maxHum,
        threshold: CONFIG.HUMIDITY_HIGH,
        description: `湿度过高: ${maxHum.toFixed(1)}%`
      });
      reasons.push(`湿度超过阈值 ${CONFIG.HUMIDITY_HIGH}%`);
    }
    
    if (minHum < CONFIG.HUMIDITY_LOW) {
      evidence.push({
        type: 'humidity_low',
        value: minHum,
        threshold: CONFIG.HUMIDITY_LOW,
        description: `湿度过低: ${minHum.toFixed(1)}%`
      });
      reasons.push(`湿度低于阈值 ${CONFIG.HUMIDITY_LOW}%`);
    }
  }
  
  const sustainedAbnormal = detectSustainedAbnormal(sensorData);
  if (sustainedAbnormal) {
    evidence.push(sustainedAbnormal);
    reasons.push('持续异常状态');
  }
  
  const totalScore = evidence.length * 10 + (sustainedAbnormal ? 20 : 0);
  
  return {
    abnormal: evidence.length > 0,
    score: totalScore,
    evidence,
    reasons
  };
}

function detectSustainedAbnormal(sensorData) {
  if (sensorData.length < 5) return null;
  
  let consecutiveAbnormal = 0;
  let firstAbnormalTime = null;
  
  for (let i = 0; i < sensorData.length; i++) {
    const data = sensorData[i];
    const isAbnormal = (
      (data.temperature !== null && (data.temperature < CONFIG.TEMPERATURE_LOW || data.temperature > CONFIG.TEMPERATURE_HIGH)) ||
      (data.humidity !== null && (data.humidity < CONFIG.HUMIDITY_LOW || data.humidity > CONFIG.HUMIDITY_HIGH))
    );
    
    if (isAbnormal) {
      consecutiveAbnormal++;
      if (consecutiveAbnormal === 1) {
        firstAbnormalTime = data.timestamp;
      }
    } else {
      consecutiveAbnormal = 0;
      firstAbnormalTime = null;
    }
    
    if (consecutiveAbnormal >= 5) {
      return {
        type: 'sustained_abnormal',
        value: consecutiveAbnormal,
        threshold: 5,
        description: `持续异常: 连续 ${consecutiveAbnormal} 个读数异常`,
        firstAbnormalTime
      };
    }
  }
  
  return null;
}

function analyzeAlarms(alarms) {
  if (!alarms || alarms.length === 0) {
    return { hasCritical: false, score: 0, evidence: [], reasons: [] };
  }
  
  const evidence = [];
  const reasons = [];
  let score = 0;
  
  const condensationAlarms = alarms.filter(a => 
    a.alarm_type && a.alarm_type.toLowerCase().includes('冷凝')
  );
  
  if (condensationAlarms.length > 0) {
    const unacknowledged = condensationAlarms.filter(a => a.status !== '已确认');
    if (unacknowledged.length > 0) {
      evidence.push({
        type: 'condensation_alarm',
        count: unacknowledged.length,
        description: `冷凝水报警: ${unacknowledged.length} 条未确认`
      });
      reasons.push('存在未确认的冷凝水报警');
      score += CONFIG.RISK_SCORES.condensation_alarm * unacknowledged.length;
    }
  }
  
  const recentAlarms = alarms.slice(0, 5);
  if (recentAlarms.length >= 3) {
    evidence.push({
      type: 'multiple_alarms',
      count: recentAlarms.length,
      description: `近期频繁报警: ${recentAlarms.length} 条`
    });
    reasons.push('近期频繁报警');
    score += CONFIG.RISK_SCORES.multiple_alarms;
  }
  
  return {
    hasCritical: evidence.length > 0,
    score,
    evidence,
    reasons
  };
}

function analyzeInspections(inspections) {
  if (!inspections || inspections.length === 0) {
    return { hasIssues: false, score: 0, evidence: [], reasons: [] };
  }
  
  const evidence = [];
  const reasons = [];
  let score = 0;
  
  const latestInspection = inspections[0];
  
  if (latestInspection.fan_coil_status && 
      (latestInspection.fan_coil_status.toLowerCase().includes('异常') || 
       latestInspection.fan_coil_status.toLowerCase().includes('故障'))) {
    evidence.push({
      type: 'fan_coil_issue',
      status: latestInspection.fan_coil_status,
      description: `风机盘管状态: ${latestInspection.fan_coil_status}`
    });
    reasons.push('风机盘管状态异常');
    score += CONFIG.RISK_SCORES.inspection_issue;
  }
  
  if (latestInspection.filter_status && 
      (latestInspection.filter_status.toLowerCase().includes('脏') || 
       latestInspection.filter_status.toLowerCase().includes('需要更换'))) {
    evidence.push({
      type: 'filter_issue',
      status: latestInspection.filter_status,
      description: `滤网状态: ${latestInspection.filter_status}`
    });
    reasons.push('滤网状态异常');
    score += CONFIG.RISK_SCORES.inspection_issue / 2;
  }
  
  if (latestInspection.condensate_pipe_status && 
      (latestInspection.condensate_pipe_status.toLowerCase().includes('堵塞') || 
       latestInspection.condensate_pipe_status.toLowerCase().includes('漏水'))) {
    evidence.push({
      type: 'condensate_issue',
      status: latestInspection.condensate_pipe_status,
      description: `冷凝水管状态: ${latestInspection.condensate_pipe_status}`
    });
    reasons.push('冷凝水管状态异常');
    score += CONFIG.RISK_SCORES.inspection_issue;
  }
  
  return {
    hasIssues: evidence.length > 0,
    score,
    evidence,
    reasons
  };
}

function analyzeComplaints(complaints) {
  if (!complaints || complaints.length === 0) {
    return { hasActive: false, score: 0, evidence: [], reasons: [] };
  }
  
  const evidence = [];
  const reasons = [];
  let score = 0;
  
  const activeComplaints = complaints.filter(c => c.status !== '已解决');
  
  if (activeComplaints.length > 0) {
    activeComplaints.forEach(complaint => {
      evidence.push({
        type: 'complaint',
        complaintType: complaint.type,
        status: complaint.status,
        priority: complaint.priority,
        description: `客诉: ${complaint.type} - ${complaint.status}`
      });
      
      if (complaint.priority === '高') {
        score += CONFIG.RISK_SCORES.complaint * 1.5;
      } else {
        score += CONFIG.RISK_SCORES.complaint;
      }
    });
    
    reasons.push(`存在 ${activeComplaints.length} 条未解决客诉`);
  }
  
  return {
    hasActive: evidence.length > 0,
    score,
    evidence,
    reasons
  };
}

function checkFalseAlarm(sensorData, alarms) {
  if (!sensorData || sensorData.length < 3 || !alarms || alarms.length === 0) {
    return false;
  }
  
  const recentAlarms = alarms.slice(0, 3);
  
  for (const alarm of recentAlarms) {
    const alarmTime = new Date(alarm.alarm_time);
    
    const beforeData = sensorData.filter(d => {
      const dataTime = new Date(d.timestamp);
      const diffMinutes = (alarmTime - dataTime) / (1000 * 60);
      return diffMinutes > 0 && diffMinutes <= CONFIG.SHORT_DOOR_OPEN_MINUTES;
    });
    
    const afterData = sensorData.filter(d => {
      const dataTime = new Date(d.timestamp);
      const diffMinutes = (dataTime - alarmTime) / (1000 * 60);
      return diffMinutes > 0 && diffMinutes <= CONFIG.SHORT_DOOR_OPEN_MINUTES;
    });
    
    if (beforeData.length >= 2 && afterData.length >= 2) {
      const beforeTempStable = checkTemperatureStable(beforeData);
      const afterTempStable = checkTemperatureStable(afterData);
      const hasTempDrop = checkTemperatureDrop(beforeData, afterData);
      
      if (beforeTempStable && afterTempStable && hasTempDrop) {
        return true;
      }
    }
  }
  
  return false;
}

function checkTemperatureStable(data) {
  if (data.length < 2) return false;
  
  const temps = data.map(d => d.temperature).filter(t => t !== null);
  if (temps.length < 2) return false;
  
  const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
  const variance = temps.reduce((sum, t) => sum + Math.pow(t - avgTemp, 2), 0) / temps.length;
  
  return variance < 0.5;
}

function checkTemperatureDrop(beforeData, afterData) {
  const beforeTemps = beforeData.map(d => d.temperature).filter(t => t !== null);
  const afterTemps = afterData.map(d => d.temperature).filter(t => t !== null);
  
  if (beforeTemps.length === 0 || afterTemps.length === 0) return false;
  
  const avgBefore = beforeTemps.reduce((a, b) => a + b, 0) / beforeTemps.length;
  const avgAfter = afterTemps.reduce((a, b) => a + b, 0) / afterTemps.length;
  
  const tempDiff = avgBefore - avgAfter;
  
  return tempDiff > 2;
}

function saveAnalysis(cabinNumber, analysis) {
  return new Promise((resolve, reject) => {
    const checkQuery = `SELECT id, manual_override FROM cabin_analysis WHERE cabin_number = ?`;
    
    db.get(checkQuery, [cabinNumber], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row && row.manual_override === 1) {
        resolve();
        return;
      }
      
      if (row) {
        const updateQuery = `
          UPDATE cabin_analysis 
          SET 
            risk_level = ?,
            risk_score = ?,
            is_false_alarm = ?,
            analysis_reason = ?,
            evidence = ?,
            maintenance_status = ?,
            maintenance_priority = ?,
            analyzed_at = ?,
            updated_at = DATETIME('now')
          WHERE cabin_number = ?
        `;
        
        db.run(updateQuery, [
          analysis.riskLevel,
          analysis.riskScore,
          analysis.isFalseAlarm,
          analysis.analysisReason,
          analysis.evidence,
          analysis.maintenanceStatus,
          analysis.maintenancePriority,
          analysis.analyzedAt,
          cabinNumber
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      } else {
        const insertQuery = `
          INSERT INTO cabin_analysis (
            cabin_number, risk_level, risk_score, is_false_alarm,
            analysis_reason, evidence, maintenance_status, maintenance_priority,
            analyzed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(insertQuery, [
          cabinNumber,
          analysis.riskLevel,
          analysis.riskScore,
          analysis.isFalseAlarm,
          analysis.analysisReason,
          analysis.evidence,
          analysis.maintenanceStatus,
          analysis.maintenancePriority,
          analysis.analyzedAt
        ], function(err) {
          if (err) reject(err);
          else resolve();
        });
      }
    });
  });
}

router.get('/', (req, res) => {
  const { deck, risk_level, maintenance_status, cabin_number, limit = 100, offset = 0 } = req.query;
  
  let query = `
    SELECT ca.*, c.deck, c.type as cabin_type
    FROM cabin_analysis ca
    LEFT JOIN cabins c ON ca.cabin_number = c.cabin_number
    WHERE 1=1
  `;
  const params = [];
  
  if (deck) {
    query += ' AND c.deck = ?';
    params.push(deck);
  }
  
  if (risk_level) {
    query += ' AND ca.risk_level = ?';
    params.push(risk_level);
  }
  
  if (maintenance_status) {
    query += ' AND ca.maintenance_status = ?';
    params.push(maintenance_status);
  }
  
  if (cabin_number) {
    query += ' AND ca.cabin_number LIKE ?';
    params.push(`%${cabin_number}%`);
  }
  
  query += ' ORDER BY ca.risk_score DESC, c.deck, ca.cabin_number LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM cabin_analysis ca
      LEFT JOIN cabins c ON ca.cabin_number = c.cabin_number
      WHERE 1=1
      ${deck ? ' AND c.deck = ?' : ''}
      ${risk_level ? ' AND ca.risk_level = ?' : ''}
      ${maintenance_status ? ' AND ca.maintenance_status = ?' : ''}
      ${cabin_number ? ' AND ca.cabin_number LIKE ?' : ''}
    `;
    
    const countParams = [];
    if (deck) countParams.push(deck);
    if (risk_level) countParams.push(risk_level);
    if (maintenance_status) countParams.push(maintenance_status);
    if (cabin_number) countParams.push(`%${cabin_number}%`);
    
    db.get(countQuery, countParams, (countErr, countRow) => {
      if (countErr) {
        res.status(500).json({ error: countErr.message });
        return;
      }
      
      res.json({
        data: rows,
        total: countRow.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    });
  });
});

router.get('/:cabinNumber', (req, res) => {
  const { cabinNumber } = req.params;
  
  const query = `
    SELECT ca.*, c.deck, c.type as cabin_type
    FROM cabin_analysis ca
    LEFT JOIN cabins c ON ca.cabin_number = c.cabin_number
    WHERE ca.cabin_number = ?
  `;
  
  db.get(query, [cabinNumber], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: '舱房分析数据不存在' });
      return;
    }
    
    if (row.evidence) {
      try {
        row.evidence = JSON.parse(row.evidence);
      } catch (e) {
        row.evidence = [];
      }
    }
    
    res.json(row);
  });
});

router.put('/:cabinNumber/override', (req, res) => {
  const { cabinNumber } = req.params;
  const { 
    risk_level, 
    maintenance_status, 
    maintenance_priority, 
    is_false_alarm,
    override_reason,
    override_by,
    notes 
  } = req.body;
  
  const updates = [];
  const values = [];
  
  if (risk_level !== undefined) {
    updates.push('risk_level = ?');
    values.push(risk_level);
  }
  
  if (maintenance_status !== undefined) {
    updates.push('maintenance_status = ?');
    values.push(maintenance_status);
  }
  
  if (maintenance_priority !== undefined) {
    updates.push('maintenance_priority = ?');
    values.push(maintenance_priority);
  }
  
  if (is_false_alarm !== undefined) {
    updates.push('is_false_alarm = ?');
    values.push(is_false_alarm ? 1 : 0);
  }
  
  if (override_reason !== undefined) {
    updates.push('override_reason = ?');
    values.push(override_reason);
  }
  
  if (override_by !== undefined) {
    updates.push('override_by = ?');
    values.push(override_by);
  }
  
  if (notes !== undefined) {
    updates.push('notes = ?');
    values.push(notes);
  }
  
  updates.push('manual_override = 1');
  updates.push('updated_at = DATETIME(\'now\')');
  
  const query = `UPDATE cabin_analysis SET ${updates.join(', ')} WHERE cabin_number = ?`;
  values.push(cabinNumber);
  
  db.run(query, values, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      const insertQuery = `
        INSERT INTO cabin_analysis (
          cabin_number, risk_level, maintenance_status, maintenance_priority,
          is_false_alarm, manual_override, override_reason, override_by, notes
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      `;
      
      db.run(insertQuery, [
        cabinNumber,
        risk_level || '正常',
        maintenance_status || '无需维修',
        maintenance_priority || '低',
        is_false_alarm ? 1 : 0,
        override_reason || '',
        override_by || '',
        notes || ''
      ], function(insertErr) {
        if (insertErr) {
          res.status(500).json({ error: insertErr.message });
          return;
        }
        res.json({ success: true, message: '人工改判已保存' });
      });
    } else {
      res.json({ success: true, message: '人工改判已保存' });
    }
  });
});

router.get('/summary/stats', (req, res) => {
  const query = `
    SELECT 
      risk_level,
      COUNT(*) as count
    FROM cabin_analysis
    GROUP BY risk_level
    ORDER BY 
      CASE risk_level
        WHEN '高风险' THEN 1
        WHEN '中风险' THEN 2
        WHEN '低风险' THEN 3
        WHEN '误报' THEN 4
        ELSE 5
      END
  `;
  
  db.all(query, (err, riskRows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const maintenanceQuery = `
      SELECT 
        maintenance_status,
        COUNT(*) as count
      FROM cabin_analysis
      GROUP BY maintenance_status
    `;
    
    db.all(maintenanceQuery, (maintErr, maintRows) => {
      if (maintErr) {
        res.status(500).json({ error: maintErr.message });
        return;
      }
      
      const deckQuery = `
        SELECT 
          c.deck,
          COUNT(*) as total_cabins,
          SUM(CASE WHEN ca.risk_level = '高风险' THEN 1 ELSE 0 END) as high_risk,
          SUM(CASE WHEN ca.risk_level = '中风险' THEN 1 ELSE 0 END) as medium_risk,
          SUM(CASE WHEN ca.risk_level = '低风险' THEN 1 ELSE 0 END) as low_risk
        FROM cabin_analysis ca
        LEFT JOIN cabins c ON ca.cabin_number = c.cabin_number
        GROUP BY c.deck
        ORDER BY c.deck
      `;
      
      db.all(deckQuery, (deckErr, deckRows) => {
        if (deckErr) {
          res.status(500).json({ error: deckErr.message });
          return;
        }
        
        res.json({
          risk_distribution: riskRows,
          maintenance_distribution: maintRows,
          deck_summary: deckRows
        });
      });
    });
  });
});

module.exports = router;
