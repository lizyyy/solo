const dayjs = require('dayjs');
const { getQuery, allQuery, runQuery } = require('./database');
const { THRESHOLDS } = require('./csvParser');

async function getSensorDataInRange(room, startTime, endTime) {
  return allQuery(`
    SELECT * FROM sensor_data
    WHERE room = ? AND timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp
  `, [room, startTime.toISOString(), endTime.toISOString()]);
}

async function getVentilationInRange(room, startTime, endTime) {
  return allQuery(`
    SELECT * FROM ventilation_records
    WHERE room = ? 
      AND (start_time <= ? OR start_time <= ?)
      AND (end_time >= ? OR end_time IS NULL)
    ORDER BY start_time
  `, [room, endTime.toISOString(), endTime.toISOString(), startTime.toISOString()]);
}

function getRiskLevel(value, thresholds) {
  if (value >= thresholds.danger) return 'danger';
  if (value >= thresholds.warning) return 'warning';
  return 'safe';
}

function getOverallRiskLevel(risks) {
  if (risks.includes('danger')) return 'danger';
  if (risks.includes('warning')) return 'warning';
  return 'safe';
}

async function calculatePeakExposure(sensorData) {
  let peaks = {
    co2: null,
    pm25: null,
    tvoc: null
  };
  
  for (const data of sensorData) {
    if (data.co2 !== null && (peaks.co2 === null || data.co2 > peaks.co2)) {
      peaks.co2 = data.co2;
    }
    if (data.pm25 !== null && (peaks.pm25 === null || data.pm25 > peaks.pm25)) {
      peaks.pm25 = data.pm25;
    }
    if (data.tvoc !== null && (peaks.tvoc === null || data.tvoc > peaks.tvoc)) {
      peaks.tvoc = data.tvoc;
    }
  }
  
  return peaks;
}

async function calculateVentilationRecovery(room, courseStartTime, sensorData) {
  const beforeCourseData = sensorData.filter(d => 
    dayjs(d.timestamp).isBefore(courseStartTime)
  );
  
  if (beforeCourseData.length === 0) {
    return { minutes: null, reason: '课前无传感器数据' };
  }
  
  const latestData = beforeCourseData[beforeCourseData.length - 1];
  const risks = [];
  
  if (latestData.co2 !== null && latestData.co2 >= THRESHOLDS.co2.warning) {
    risks.push({ type: 'co2', value: latestData.co2, threshold: THRESHOLDS.co2.warning, recoveryRate: 50 });
  }
  if (latestData.pm25 !== null && latestData.pm25 >= THRESHOLDS.pm25.warning) {
    risks.push({ type: 'pm25', value: latestData.pm25, threshold: THRESHOLDS.pm25.warning, recoveryRate: 10 });
  }
  if (latestData.tvoc !== null && latestData.tvoc >= THRESHOLDS.tvoc.warning) {
    risks.push({ type: 'tvoc', value: latestData.tvoc, threshold: THRESHOLDS.tvoc.warning, recoveryRate: 0.2 });
  }
  
  if (risks.length === 0) {
    return { minutes: 0, reason: '空气质量达标，无需恢复' };
  }
  
  let maxRecoveryMinutes = 0;
  const recoveryReasons = [];
  
  for (const risk of risks) {
    const excess = risk.value - risk.threshold;
    const estimatedMinutes = Math.ceil(excess / risk.recoveryRate * 5);
    if (estimatedMinutes > maxRecoveryMinutes) {
      maxRecoveryMinutes = estimatedMinutes;
    }
    recoveryReasons.push(`${risk.type}: ${risk.value.toFixed(1)} (超${risk.threshold})`);
  }
  
  return {
    minutes: maxRecoveryMinutes,
    reason: recoveryReasons.join('; ')
  };
}

async function assessCourseRisk(room, course) {
  const courseStartTime = dayjs(course.start_time);
  const courseEndTime = dayjs(course.end_time);
  
  const beforeCourseStart = courseStartTime.subtract(2, 'hour');
  
  const sensorData = await getSensorDataInRange(room, beforeCourseStart, courseEndTime);
  
  const ventilationData = await getVentilationInRange(room, beforeCourseStart, courseEndTime);
  
  const peaks = await calculatePeakExposure(sensorData);
  
  const recoveryInfo = await calculateVentilationRecovery(room, courseStartTime, sensorData);
  
  const latestBeforeCourse = sensorData
    .filter(d => dayjs(d.timestamp).isBefore(courseStartTime))
    .sort((a, b) => dayjs(b.timestamp).diff(dayjs(a.timestamp)))
    [0];
  
  const currentCo2 = latestBeforeCourse?.co2 ?? null;
  const currentPm25 = latestBeforeCourse?.pm25 ?? null;
  const currentTvoc = latestBeforeCourse?.tvoc ?? null;
  
  const risks = [];
  const riskReasons = [];
  
  if (currentCo2 !== null) {
    const risk = getRiskLevel(currentCo2, THRESHOLDS.co2);
    if (risk !== 'safe') {
      risks.push(risk);
      riskReasons.push(`CO2浓度: ${currentCo2} ppm (阈值: ${THRESHOLDS.co2.warning}ppm)`);
    }
  }
  
  if (currentPm25 !== null) {
    const risk = getRiskLevel(currentPm25, THRESHOLDS.pm25);
    if (risk !== 'safe') {
      risks.push(risk);
      riskReasons.push(`PM2.5浓度: ${currentPm25} μg/m³ (阈值: ${THRESHOLDS.pm25.warning}μg/m³)`);
    }
  }
  
  if (currentTvoc !== null) {
    const risk = getRiskLevel(currentTvoc, THRESHOLDS.tvoc);
    if (risk !== 'safe') {
      risks.push(risk);
      riskReasons.push(`TVOC浓度: ${currentTvoc} mg/m³ (阈值: ${THRESHOLDS.tvoc.warning}mg/m³)`);
    }
  }
  
  if (recoveryInfo.minutes > 0) {
    const canRecoverInTime = recoveryInfo.minutes <= 15;
    if (!canRecoverInTime) {
      risks.push('warning');
      riskReasons.push(`通风恢复需 ${recoveryInfo.minutes} 分钟，可能影响下一场`);
    }
  }
  
  const overallRisk = getOverallRiskLevel(risks);
  const canProceed = overallRisk === 'safe' || (overallRisk === 'warning' && recoveryInfo.minutes <= 15);
  
  return {
    room,
    course_id: course.id,
    assessment_time: dayjs().toISOString(),
    co2_level: currentCo2,
    pm25_level: currentPm25,
    tvoc_level: currentTvoc,
    peak_co2: peaks.co2,
    peak_pm25: peaks.pm25,
    peak_tvoc: peaks.tvoc,
    ventilation_recovery_minutes: recoveryInfo.minutes,
    risk_level: overallRisk,
    risk_reasons: riskReasons.join('; '),
    can_proceed: canProceed ? 1 : 0,
    manual_override: 0,
    override_reason: null,
    notes: null,
    course_info: course,
    ventilation_records: ventilationData,
    recovery_reason: recoveryInfo.reason
  };
}

async function saveAssessment(assessment) {
  const existing = await getQuery(`
    SELECT id FROM risk_assessments WHERE course_id = ?`, [assessment.course_id]);
  
  if (existing) {
    await runQuery(`
      UPDATE risk_assessments SET
        assessment_time = ?,
        co2_level = ?,
        pm25_level = ?,
        tvoc_level = ?,
        peak_co2 = ?,
        peak_pm25 = ?,
        peak_tvoc = ?,
        ventilation_recovery_minutes = ?,
        risk_level = ?,
        risk_reasons = ?,
        can_proceed = ?
      WHERE course_id = ?
    `, [
      assessment.assessment_time,
      assessment.co2_level,
      assessment.pm25_level,
      assessment.tvoc_level,
      assessment.peak_co2,
      assessment.peak_pm25,
      assessment.peak_tvoc,
      assessment.ventilation_recovery_minutes,
      assessment.risk_level,
      assessment.risk_reasons,
      assessment.can_proceed,
      assessment.course_id
    ]);
    return { id: existing.id, updated: true };
  } else {
    const result = await runQuery(`
      INSERT INTO risk_assessments (
        room, course_id, assessment_time, co2_level, pm25_level, tvoc_level,
        peak_co2, peak_pm25, peak_tvoc, ventilation_recovery_minutes,
        risk_level, risk_reasons, can_proceed, manual_override, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      assessment.room,
      assessment.course_id,
      assessment.assessment_time,
      assessment.co2_level,
      assessment.pm25_level,
      assessment.tvoc_level,
      assessment.peak_co2,
      assessment.peak_pm25,
      assessment.peak_tvoc,
      assessment.ventilation_recovery_minutes,
      assessment.risk_level,
      assessment.risk_reasons,
      assessment.can_proceed,
      0,
      null
    ]);
    return { id: result.lastID, created: true };
  }
}

async function assessAllCoursesForDate(room, date) {
  const startOfDay = dayjs(date).startOf('day');
  const endOfDay = dayjs(date).endOf('day');
  
  const courses = await allQuery(`
    SELECT * FROM course_bookings
    WHERE room = ? AND start_time >= ? AND start_time <= ?
    ORDER BY start_time
  `, [room, startOfDay.toISOString(), endOfDay.toISOString()]);
  
  const assessments = [];
  
  for (const course of courses) {
    const assessment = await assessCourseRisk(room, course);
    await saveAssessment(assessment);
    assessments.push(assessment);
  }
  
  return assessments;
}

async function getDailyTimeline(room, date) {
  const startOfDay = dayjs(date).startOf('day');
  const endOfDay = dayjs(date).endOf('day');
  
  const sensorData = await getSensorDataInRange(room, startOfDay, endOfDay);
  const ventilationData = await getVentilationInRange(room, startOfDay, endOfDay);
  const courses = await allQuery(`
    SELECT * FROM course_bookings
    WHERE room = ? AND start_time >= ? AND start_time <= ?
    ORDER BY start_time
  `, [room, startOfDay.toISOString(), endOfDay.toISOString()]);
  
  const cleaningRecords = await allQuery(`
    SELECT * FROM cleaning_records
    WHERE room = ? AND timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp
  `, [room, startOfDay.toISOString(), endOfDay.toISOString()]);
  
  const assessments = await allQuery(`
    SELECT * FROM risk_assessments
    WHERE room = ? AND assessment_time >= ? AND assessment_time <= ?
    ORDER BY assessment_time
  `, [room, startOfDay.toISOString(), endOfDay.toISOString()]);
  
  return {
    sensorData,
    ventilationData,
    courses,
    cleaningRecords,
    assessments,
    thresholds: THRESHOLDS
  };
}

async function getAvailableRooms() {
  const sensorRooms = await allQuery(`SELECT DISTINCT room FROM sensor_data`);
  const courseRooms = await allQuery(`SELECT DISTINCT room FROM course_bookings`);
  
  const rooms = new Set();
  sensorRooms.forEach(r => rooms.add(r.room));
  courseRooms.forEach(r => rooms.add(r.room));
  
  return Array.from(rooms);
}

async function updateManualOverride(assessmentId, canProceed, overrideReason, notes) {
  return runQuery(`
    UPDATE risk_assessments SET
      manual_override = 1,
      can_proceed = ?,
      override_reason = ?,
      notes = ?
    WHERE id = ?
  `, [canProceed ? 1 : 0, overrideReason, notes, assessmentId]);
}

module.exports = {
  assessCourseRisk,
  assessAllCoursesForDate,
  getDailyTimeline,
  getAvailableRooms,
  updateManualOverride,
  THRESHOLDS
};