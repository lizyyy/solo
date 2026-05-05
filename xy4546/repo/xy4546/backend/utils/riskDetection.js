const db = require('../database');
const moment = require('moment');

const RISK_TYPES = {
  FREQUENT_STOP: 'frequent_stop',
  OVERLOAD_FALSE_ALARM: 'overload_false_alarm',
  LONG_UNRESET: 'long_unreset',
  MAINTENANCE_TIMEOUT: 'maintenance_timeout'
};

const RISK_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

async function detectFrequentStops(escalatorCode, options = {}) {
  const {
    timeWindowHours = 24,
    stopThreshold = 5,
    currentDropThreshold = 0.5
  } = options;

  const now = moment();
  const timeWindowStart = now.subtract(timeWindowHours, 'hours').format('YYYY-MM-DD HH:mm:ss');

  const currentLogs = await db.all(`
    SELECT * FROM current_logs 
    WHERE escalator_code = ? AND log_time >= ?
    ORDER BY log_time ASC
  `, [escalatorCode, timeWindowStart]);

  if (currentLogs.length < 2) {
    return null;
  }

  let stopCount = 0;
  const stopEvents = [];

  for (let i = 1; i < currentLogs.length; i++) {
    const prevLog = currentLogs[i - 1];
    const currentLog = currentLogs[i];

    const prevCurrent = prevLog.average_current || 0;
    const currentCurrent = currentLog.average_current || 0;

    if (prevCurrent > 1 && currentCurrent < currentDropThreshold) {
      stopCount++;
      stopEvents.push({
        time: currentLog.log_time,
        prevCurrent: prevCurrent,
        currentCurrent: currentCurrent
      });
    }
  }

  if (stopCount >= stopThreshold) {
    let riskLevel = RISK_LEVELS.MEDIUM;
    if (stopCount >= 10) {
      riskLevel = RISK_LEVELS.CRITICAL;
    } else if (stopCount >= 7) {
      riskLevel = RISK_LEVELS.HIGH;
    }

    return {
      riskType: RISK_TYPES.FREQUENT_STOP,
      escalatorCode,
      riskLevel,
      detectedTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      description: `在 ${timeWindowHours} 小时内检测到 ${stopCount} 次停梯事件，超过阈值 ${stopThreshold} 次`,
      relatedRecords: JSON.stringify({
        stopCount,
        stopThreshold,
        timeWindowHours,
        stopEvents: stopEvents.slice(-10)
      })
    };
  }

  return null;
}

async function detectOverloadFalseAlarms(escalatorCode, options = {}) {
  const {
    timeWindowHours = 24,
    alarmThreshold = 3,
    currentDropRatio = 0.3
  } = options;

  const now = moment();
  const timeWindowStart = now.subtract(timeWindowHours, 'hours').format('YYYY-MM-DD HH:mm:ss');

  const currentLogs = await db.all(`
    SELECT * FROM current_logs 
    WHERE escalator_code = ? AND log_time >= ? AND is_overload = 1
    ORDER BY log_time ASC
  `, [escalatorCode, timeWindowStart]);

  if (currentLogs.length === 0) {
    return null;
  }

  const repairRecords = await db.all(`
    SELECT * FROM repair_records 
    WHERE escalator_code = ? AND report_time >= ?
    ORDER BY report_time ASC
  `, [escalatorCode, timeWindowStart]);

  let falseAlarmCount = 0;
  const falseAlarmEvents = [];

  for (const log of currentLogs) {
    const logTime = moment(log.log_time);
    const logTimePlus10Min = logTime.clone().add(10, 'minutes');
    const logTimeMinus10Min = logTime.clone().subtract(10, 'minutes');

    const relatedRepairs = repairRecords.filter(repair => {
      const repairTime = moment(repair.report_time);
      return repairTime.isBetween(logTimeMinus10Min, logTimePlus10Min);
    });

    const isFalseAlarm = relatedRepairs.length === 0 || 
      relatedRepairs.some(r => r.is_false_alarm === 1);

    if (isFalseAlarm) {
      falseAlarmCount++;
      falseAlarmEvents.push({
        time: log.log_time,
        current: log.average_current,
        isFalseAlarm: true
      });
    }
  }

  if (falseAlarmCount >= alarmThreshold) {
    let riskLevel = RISK_LEVELS.MEDIUM;
    if (falseAlarmCount >= 8) {
      riskLevel = RISK_LEVELS.CRITICAL;
    } else if (falseAlarmCount >= 5) {
      riskLevel = RISK_LEVELS.HIGH;
    }

    return {
      riskType: RISK_TYPES.OVERLOAD_FALSE_ALARM,
      escalatorCode,
      riskLevel,
      detectedTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      description: `在 ${timeWindowHours} 小时内检测到 ${falseAlarmCount} 次疑似超载误报`,
      relatedRecords: JSON.stringify({
        falseAlarmCount,
        alarmThreshold,
        timeWindowHours,
        falseAlarmEvents: falseAlarmEvents.slice(-10)
      })
    };
  }

  return null;
}

async function detectLongUnreset(escalatorCode, options = {}) {
  const {
    unresetThresholdHours = 24
  } = options;

  const now = moment();
  const thresholdTime = now.subtract(unresetThresholdHours, 'hours').format('YYYY-MM-DD HH:mm:ss');

  const pendingRepairs = await db.all(`
    SELECT * FROM repair_records 
    WHERE escalator_code = ? 
    AND handle_status IN ('pending', 'processing')
    AND report_time <= ?
    ORDER BY report_time ASC
  `, [escalatorCode, thresholdTime]);

  const unresolvedMaintenance = await db.all(`
    SELECT * FROM maintenance_records 
    WHERE escalator_code = ? 
    AND is_resolved = 0
    AND call_time <= ?
    ORDER BY call_time ASC
  `, [escalatorCode, thresholdTime]);

  const allUnresolved = [
    ...pendingRepairs.map(r => ({ ...r, type: 'repair' })),
    ...unresolvedMaintenance.map(m => ({ ...m, type: 'maintenance' }))
  ];

  if (allUnresolved.length === 0) {
    return null;
  }

  const oldestUnresolved = allUnresolved.reduce((oldest, current) => {
    const currentTime = current.type === 'repair' ? current.report_time : current.call_time;
    const oldestTime = oldest.type === 'repair' ? oldest.report_time : oldest.call_time;
    return moment(currentTime).isBefore(moment(oldestTime)) ? current : oldest;
  });

  const oldestTime = oldestUnresolved.type === 'repair' 
    ? oldestUnresolved.report_time 
    : oldestUnresolved.call_time;
  
  const unresetDurationHours = now.diff(moment(oldestTime), 'hours');

  let riskLevel = RISK_LEVELS.MEDIUM;
  if (unresetDurationHours >= 72) {
    riskLevel = RISK_LEVELS.CRITICAL;
  } else if (unresetDurationHours >= 48) {
    riskLevel = RISK_LEVELS.HIGH;
  }

  return {
    riskType: RISK_TYPES.LONG_UNRESET,
    escalatorCode,
    riskLevel,
    detectedTime: moment().format('YYYY-MM-DD HH:mm:ss'),
    description: `存在 ${allUnresolved.length} 项未复位记录，最早的已超过 ${unresetDurationHours.toFixed(1)} 小时`,
    relatedRecords: JSON.stringify({
      unresetCount: allUnresolved.length,
      unresetThresholdHours,
      oldestUnresolved: {
        type: oldestUnresolved.type,
        time: oldestTime,
        description: oldestUnresolved.fault_description || oldestUnresolved.maintenance_content
      },
      allUnresolved: allUnresolved.map(u => ({
        type: u.type,
        time: u.type === 'repair' ? u.report_time : u.call_time,
        description: u.fault_description || u.maintenance_content,
        status: u.handle_status || (u.is_resolved ? 'resolved' : 'unresolved')
      }))
    })
  };
}

async function detectMaintenanceTimeout(escalatorCode, options = {}) {
  const {
    arrivalTimeoutMinutes = 30,
    resolutionTimeoutHours = 4
  } = options;

  const pendingMaintenance = await db.all(`
    SELECT * FROM maintenance_records 
    WHERE escalator_code = ? 
    AND (arrival_time IS NULL OR arrival_time = '' OR is_resolved = 0)
    ORDER BY call_time DESC
  `, [escalatorCode]);

  if (pendingMaintenance.length === 0) {
    return null;
  }

  let timeoutCount = 0;
  const timeoutEvents = [];
  const now = moment();

  for (const record of pendingMaintenance) {
    const callTime = moment(record.call_time);
    
    if (!record.arrival_time || record.arrival_time === '') {
      const arrivalDelayMinutes = now.diff(callTime, 'minutes');
      if (arrivalDelayMinutes > arrivalTimeoutMinutes) {
        timeoutCount++;
        timeoutEvents.push({
          type: 'arrival_timeout',
          callTime: record.call_time,
          delayMinutes: arrivalDelayMinutes,
          description: record.fault_description
        });
      }
    } else if (record.is_resolved === 0) {
      const arrivalTime = moment(record.arrival_time);
      const resolutionDelayHours = now.diff(arrivalTime, 'hours');
      if (resolutionDelayHours > resolutionTimeoutHours) {
        timeoutCount++;
        timeoutEvents.push({
          type: 'resolution_timeout',
          callTime: record.call_time,
          arrivalTime: record.arrival_time,
          delayHours: resolutionDelayHours,
          description: record.fault_description
        });
      }
    }
  }

  if (timeoutCount > 0) {
    let riskLevel = RISK_LEVELS.MEDIUM;
    if (timeoutCount >= 5) {
      riskLevel = RISK_LEVELS.CRITICAL;
    } else if (timeoutCount >= 3) {
      riskLevel = RISK_LEVELS.HIGH;
    }

    return {
      riskType: RISK_TYPES.MAINTENANCE_TIMEOUT,
      escalatorCode,
      riskLevel,
      detectedTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      description: `检测到 ${timeoutCount} 项维保超时`,
      relatedRecords: JSON.stringify({
        timeoutCount,
        arrivalTimeoutMinutes,
        resolutionTimeoutHours,
        timeoutEvents: timeoutEvents.slice(-10)
      })
    };
  }

  return null;
}

async function detectAllRisksForEscalator(escalatorCode, options = {}) {
  const risks = [];

  const frequentStopRisk = await detectFrequentStops(escalatorCode, options);
  if (frequentStopRisk) risks.push(frequentStopRisk);

  const overloadFalseAlarmRisk = await detectOverloadFalseAlarms(escalatorCode, options);
  if (overloadFalseAlarmRisk) risks.push(overloadFalseAlarmRisk);

  const longUnresetRisk = await detectLongUnreset(escalatorCode, options);
  if (longUnresetRisk) risks.push(longUnresetRisk);

  const maintenanceTimeoutRisk = await detectMaintenanceTimeout(escalatorCode, options);
  if (maintenanceTimeoutRisk) risks.push(maintenanceTimeoutRisk);

  return risks;
}

async function detectAllRisks(options = {}) {
  const escalators = await db.all('SELECT escalator_code, station_name FROM escalators');
  
  const allRisks = [];
  
  for (const escalator of escalators) {
    const risks = await detectAllRisksForEscalator(escalator.escalator_code, options);
    
    for (const risk of risks) {
      const existingRisk = await db.get(`
        SELECT * FROM risks 
        WHERE escalator_code = ? AND risk_type = ? AND status = 'pending'
        ORDER BY detected_time DESC
        LIMIT 1
      `, [risk.escalatorCode, risk.riskType]);

      if (existingRisk) {
        await db.run(`
          UPDATE risks SET 
            updated_at = ?,
            is_reopened = 1,
            reopened_count = reopened_count + 1,
            last_reopened_time = ?,
            description = ?,
            related_records = ?,
            risk_level = ?
          WHERE id = ?
        `, [
          moment().format('YYYY-MM-DD HH:mm:ss'),
          moment().format('YYYY-MM-DD HH:mm:ss'),
          risk.description,
          risk.relatedRecords,
          risk.riskLevel,
          existingRisk.id
        ]);

        await db.run(`
          INSERT INTO risk_status_logs (risk_id, old_status, new_status, remarks)
          VALUES (?, ?, ?, ?)
        `, [existingRisk.id, 'pending', 'reopened', '重启后风险仍然存在']);

        allRisks.push({ ...risk, id: existingRisk.id, isReopened: true });
      } else {
        const result = await db.run(`
          INSERT INTO risks (
            escalator_code, risk_type, risk_level, detected_time,
            description, related_records, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          risk.escalatorCode,
          risk.riskType,
          risk.riskLevel,
          risk.detectedTime,
          risk.description,
          risk.relatedRecords,
          'pending'
        ]);

        allRisks.push({ ...risk, id: result.lastID, isReopened: false });
      }
    }
  }

  return allRisks;
}

module.exports = {
  RISK_TYPES,
  RISK_LEVELS,
  detectFrequentStops,
  detectOverloadFalseAlarms,
  detectLongUnreset,
  detectMaintenanceTimeout,
  detectAllRisksForEscalator,
  detectAllRisks
};
