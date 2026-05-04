const dayjs = require('dayjs');
const _ = require('lodash');

const { getDateRange, toDateString, formatDuration } = require('../utils/date');
const { getTypeDisplayName, getWorkoutTypeName } = require('../utils/units');
const db = require('../database');

const HEART_RATE_ZONES = [
  { name: 'Zone 1 - 恢复', min: 0, max: 0.6, label: '非常轻松' },
  { name: 'Zone 2 - 有氧', min: 0.6, max: 0.7, label: '轻松' },
  { name: 'Zone 3 - 阈值', min: 0.7, max: 0.8, label: '中等' },
  { name: 'Zone 4 - 无氧', min: 0.8, max: 0.9, label: '困难' },
  { name: 'Zone 5 - 最大', min: 0.9, max: 1.0, label: '极限' },
];

async function aggregateDailySummary(date, options = {}) {
  const dateStr = toDateString(date);
  if (!dateStr) return null;

  const summary = {
    date: dateStr,
    hasData: false,
    dataMissing: [],
  };

  const stepsRecords = await getRecordsByTypeAndDate('HKQuantityTypeIdentifierStepCount', dateStr);
  if (stepsRecords.length > 0) {
    const stepsValues = stepsRecords.map(r => r.value).filter(v => v > 0);
    summary.stepsTotal = _.sum(stepsValues);
    summary.stepsAvg = stepsValues.length ? _.mean(stepsValues) : 0;
    summary.stepsMax = stepsValues.length ? Math.max(...stepsValues) : 0;
    summary.hasData = true;
  } else {
    summary.dataMissing.push('steps');
  }

  const sleepRecords = await getRecordsByTypeAndDate([
    'HKQuantityTypeIdentifierSleepAnalysis',
    'HKCategoryTypeIdentifierSleepAnalysis'
  ], dateStr);
  
  if (sleepRecords.length > 0) {
    const sleepAnalysis = analyzeSleepRecords(sleepRecords);
    summary.sleepTotal = sleepAnalysis.totalMinutes;
    summary.sleepDeep = sleepAnalysis.deepMinutes;
    summary.sleepLight = sleepAnalysis.lightMinutes;
    summary.sleepRem = sleepAnalysis.remMinutes;
    summary.sleepBedtime = sleepAnalysis.bedtime;
    summary.sleepWakeTime = sleepAnalysis.wakeTime;
    summary.hasData = true;
  } else {
    summary.dataMissing.push('sleep');
  }

  const restingHRRecords = await getRecordsByTypeAndDate('HKQuantityTypeIdentifierRestingHeartRate', dateStr);
  if (restingHRRecords.length > 0) {
    const hrValues = restingHRRecords.map(r => r.value).filter(v => v > 0);
    summary.restingHeartRateAvg = hrValues.length ? _.mean(hrValues) : 0;
    summary.restingHeartRateMin = hrValues.length ? Math.min(...hrValues) : 0;
    summary.restingHeartRateMax = hrValues.length ? Math.max(...hrValues) : 0;
    summary.hasData = true;
  } else {
    summary.dataMissing.push('restingHR');
  }

  const hrRecords = await getRecordsByTypeAndDate('HKQuantityTypeIdentifierHeartRate', dateStr);
  if (hrRecords.length > 0) {
    const hrValues = hrRecords.map(r => r.value).filter(v => v > 0);
    summary.heartRateAvg = hrValues.length ? _.round(_.mean(hrValues), 0) : 0;
    summary.heartRateMin = hrValues.length ? Math.min(...hrValues) : 0;
    summary.heartRateMax = hrValues.length ? Math.max(...hrValues) : 0;
    summary.heartRateZones = calculateHeartRateZones(hrRecords);
    summary.hasData = true;
  } else {
    summary.dataMissing.push('heartRate');
  }

  const hrvRecords = await getRecordsByTypeAndDate('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', dateStr);
  if (hrvRecords.length > 0) {
    const hrvValues = hrvRecords.map(r => r.value).filter(v => v > 0);
    summary.heartRateVariabilityAvg = hrvValues.length ? _.mean(hrvValues) : 0;
    summary.heartRateVariabilitySdnn = hrvValues.length ? _.mean(hrvValues) : 0;
    summary.hasData = true;
  } else {
    summary.dataMissing.push('hrv');
  }

  const activeEnergyRecords = await getRecordsByTypeAndDate('HKQuantityTypeIdentifierActiveEnergyBurned', dateStr);
  if (activeEnergyRecords.length > 0) {
    const energyValues = activeEnergyRecords.map(r => r.value).filter(v => v > 0);
    summary.activeEnergy = _.sum(energyValues);
    summary.hasData = true;
  } else {
    summary.dataMissing.push('activeEnergy');
  }

  const basalEnergyRecords = await getRecordsByTypeAndDate('HKQuantityTypeIdentifierBasalEnergyBurned', dateStr);
  if (basalEnergyRecords.length > 0) {
    const energyValues = basalEnergyRecords.map(r => r.value).filter(v => v > 0);
    summary.basalEnergy = _.sum(energyValues);
  }

  const workouts = await getWorkoutsByDate(dateStr);
  if (workouts.length > 0) {
    summary.workoutCount = workouts.length;
    summary.workoutDuration = _.sum(workouts.map(w => w.duration));
    summary.workoutDistance = _.sum(workouts.map(w => w.totalDistance));
    summary.workoutEnergy = _.sum(workouts.map(w => w.totalEnergyBurned));
    summary.hasData = true;
  }

  return summary;
}

async function getRecordsByTypeAndDate(types, date) {
  const typeList = Array.isArray(types) ? types : [types];
  const placeholders = typeList.map(() => '?').join(',');
  
  const results = db.all(`
    SELECT * FROM health_records 
    WHERE type IN (${placeholders}) AND date = ?
    ORDER BY startDate
  `, [...typeList, date]);
  
  return results || [];
}

async function getWorkoutsByDate(date) {
  const results = db.all(`
    SELECT * FROM workouts WHERE date = ?
    ORDER BY startDate
  `, [date]);
  
  return results || [];
}

function analyzeSleepRecords(records) {
  const result = {
    totalMinutes: 0,
    deepMinutes: 0,
    lightMinutes: 0,
    remMinutes: 0,
    awakeMinutes: 0,
    bedtime: null,
    wakeTime: null,
  };

  const sortedRecords = _.sortBy(records, 'startDate');
  
  let minTime = null;
  let maxTime = null;

  for (const record of sortedRecords) {
    let metadata = {};
    try {
      if (record.metadata) {
        metadata = JSON.parse(record.metadata);
      }
    } catch (e) {}

    const sleepStage = metadata.sleepStage || 'light';
    const duration = record.value || 0;

    result.totalMinutes += duration;

    switch (sleepStage) {
      case 'deep':
        result.deepMinutes += duration;
        break;
      case 'rem':
        result.remMinutes += duration;
        break;
      case 'awake':
        result.awakeMinutes += duration;
        break;
      case 'in_bed':
        break;
      default:
        result.lightMinutes += duration;
        break;
    }

    if (record.startDate) {
      const startTime = dayjs(record.startDate);
      const endTime = dayjs(record.endDate);
      
      if (!minTime || startTime.isBefore(minTime)) {
        minTime = startTime;
      }
      if (!maxTime || endTime.isAfter(maxTime)) {
        maxTime = endTime;
      }
    }
  }

  if (minTime) {
    result.bedtime = minTime.format('HH:mm');
  }
  if (maxTime) {
    result.wakeTime = maxTime.format('HH:mm');
  }

  return result;
}

function calculateHeartRateZones(records, maxHR = 190) {
  const zones = HEART_RATE_ZONES.map(zone => ({
    ...zone,
    count: 0,
    totalMinutes: 0,
    avgHR: 0,
    hrValues: [],
  }));

  for (const record of records) {
    const hr = record.value;
    if (!hr || hr <= 0) continue;

    const percentage = hr / maxHR;
    
    for (const zone of zones) {
      if (percentage >= zone.min && percentage < zone.max) {
        zone.count++;
        zone.hrValues.push(hr);
        break;
      }
    }
  }

  return zones.map(zone => ({
    name: zone.name,
    label: zone.label,
    count: zone.count,
    percentage: zone.count ? (zone.count / records.length * 100) : 0,
    avgHR: zone.hrValues.length ? _.round(_.mean(zone.hrValues), 0) : 0,
    minHR: zone.hrValues.length ? Math.min(...zone.hrValues) : 0,
    maxHR: zone.hrValues.length ? Math.max(...zone.hrValues) : 0,
  })).filter(z => z.count > 0);
}

async function fillMissingDates(startDate, endDate) {
  const dates = getDateRange(startDate, endDate);
  const filled = [];

  for (const date of dates) {
    let summary = db.get(`
      SELECT * FROM daily_summaries WHERE date = ?
    `, [date]);

    if (!summary) {
      summary = {
        date,
        hasData: false,
        dataMissing: ['all'],
        stepsTotal: 0,
        stepsAvg: 0,
        stepsMax: 0,
        sleepTotal: 0,
        sleepDeep: 0,
        sleepLight: 0,
        sleepRem: 0,
        restingHeartRateAvg: 0,
        heartRateAvg: 0,
        heartRateVariabilityAvg: 0,
        activeEnergy: 0,
        basalEnergy: 0,
        workoutCount: 0,
        workoutDuration: 0,
        workoutDistance: 0,
        workoutEnergy: 0,
        isMissing: true,
      };
    } else {
      summary.isMissing = false;
    }

    filled.push(summary);
  }

  return filled;
}

async function calculateSleepDebt(summaries, targetHours = 7.5) {
  let totalDebt = 0;
  const debtByDay = [];

  for (const summary of summaries) {
    const sleepHours = summary.sleepTotal ? summary.sleepTotal / 60 : 0;
    const debt = Math.max(0, targetHours - sleepHours);
    
    totalDebt += debt;
    debtByDay.push({
      date: summary.date,
      sleepHours,
      targetHours,
      debt,
      cumulativeDebt: totalDebt,
    });
  }

  return {
    totalDebt,
    averageDebt: summaries.length ? totalDebt / summaries.length : 0,
    debtByDay,
  };
}

async function calculateCalendarHeatmapData(startDate, endDate, metric = 'stepsTotal') {
  const summaries = await fillMissingDates(startDate, endDate);
  
  const data = summaries.map(s => ({
    date: s.date,
    value: s[metric] || 0,
    hasData: s.hasData,
    isMissing: s.isMissing,
  }));

  const values = data.filter(d => d.value > 0).map(d => d.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 10000;
  const avg = values.length ? _.mean(values) : 0;

  return {
    data,
    stats: {
      min,
      max,
      avg: _.round(avg, 0),
      total: _.sumBy(data, 'value'),
    },
    metric,
    startDate,
    endDate,
  };
}

async function saveDailySummary(summary) {
  const existing = db.get(`
    SELECT id FROM daily_summaries WHERE date = ?
  `, [summary.date]);

  const now = new Date().toISOString();

  if (existing) {
    db.run(`
      UPDATE daily_summaries SET
        steps_total = ?, steps_avg = ?, steps_max = ?,
        sleep_total = ?, sleep_deep = ?, sleep_light = ?, sleep_rem = ?,
        sleep_bedtime = ?, sleep_wake_time = ?,
        resting_heart_rate_avg = ?, resting_heart_rate_min = ?, resting_heart_rate_max = ?,
        heart_rate_avg = ?, heart_rate_min = ?, heart_rate_max = ?,
        heart_rate_variability_avg = ?, heart_rate_variability_sdnn = ?,
        active_energy = ?, basal_energy = ?,
        workout_count = ?, workout_duration = ?, workout_distance = ?, workout_energy = ?,
        has_data = ?, data_missing = ?,
        updated_at = ?
      WHERE date = ?
    `, [
      summary.stepsTotal || 0, summary.stepsAvg || 0, summary.stepsMax || 0,
      summary.sleepTotal || 0, summary.sleepDeep || 0, summary.sleepLight || 0, summary.sleepRem || 0,
      summary.sleepBedtime, summary.sleepWakeTime,
      summary.restingHeartRateAvg || 0, summary.restingHeartRateMin || 0, summary.restingHeartRateMax || 0,
      summary.heartRateAvg || 0, summary.heartRateMin || 0, summary.heartRateMax || 0,
      summary.heartRateVariabilityAvg || 0, summary.heartRateVariabilitySdnn || 0,
      summary.activeEnergy || 0, summary.basalEnergy || 0,
      summary.workoutCount || 0, summary.workoutDuration || 0, summary.workoutDistance || 0, summary.workoutEnergy || 0,
      summary.hasData ? 1 : 0, JSON.stringify(summary.dataMissing || []),
      now,
      summary.date
    ]);
    return existing.id;
  } else {
    const id = `summary_${summary.date}_${Date.now()}`;
    db.run(`
      INSERT INTO daily_summaries (
        id, date,
        steps_total, steps_avg, steps_max,
        sleep_total, sleep_deep, sleep_light, sleep_rem,
        sleep_bedtime, sleep_wake_time,
        resting_heart_rate_avg, resting_heart_rate_min, resting_heart_rate_max,
        heart_rate_avg, heart_rate_min, heart_rate_max,
        heart_rate_variability_avg, heart_rate_variability_sdnn,
        active_energy, basal_energy,
        workout_count, workout_duration, workout_distance, workout_energy,
        has_data, data_missing,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, summary.date,
      summary.stepsTotal || 0, summary.stepsAvg || 0, summary.stepsMax || 0,
      summary.sleepTotal || 0, summary.sleepDeep || 0, summary.sleepLight || 0, summary.sleepRem || 0,
      summary.sleepBedtime, summary.sleepWakeTime,
      summary.restingHeartRateAvg || 0, summary.restingHeartRateMin || 0, summary.restingHeartRateMax || 0,
      summary.heartRateAvg || 0, summary.heartRateMin || 0, summary.heartRateMax || 0,
      summary.heartRateVariabilityAvg || 0, summary.heartRateVariabilitySdnn || 0,
      summary.activeEnergy || 0, summary.basalEnergy || 0,
      summary.workoutCount || 0, summary.workoutDuration || 0, summary.workoutDistance || 0, summary.workoutEnergy || 0,
      summary.hasData ? 1 : 0, JSON.stringify(summary.dataMissing || []),
      now, now
    ]);
    return id;
  }
}

module.exports = {
  aggregateDailySummary,
  fillMissingDates,
  calculateSleepDebt,
  calculateHeartRateZones,
  calculateCalendarHeatmapData,
  saveDailySummary,
  analyzeSleepRecords,
  HEART_RATE_ZONES,
};
