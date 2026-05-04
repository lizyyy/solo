const dayjs = require('dayjs');
const _ = require('lodash');

const db = require('../database');
const { getDateRange, toDateString } = require('../utils/date');

const ANOMALY_TYPES = {
  SLEEP_DEFICIT: 'sleep_deficit',
  RESTING_HR_HIGH: 'resting_hr_high',
  RESTING_HR_LOW: 'resting_hr_low',
  HRV_LOW: 'hrv_low',
  WORKOUT_SPIKE: 'workout_spike',
  DATA_MISSING: 'data_missing',
  STEPS_LOW: 'steps_low',
  SLEEP_DEBT_ACCUMULATED: 'sleep_debt_accumulated',
  RECOVERY_INSUFFICIENT: 'recovery_insufficient',
};

const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

async function detectAnomalies(startDate, endDate, options = {}) {
  const dates = getDateRange(startDate, endDate);
  const anomalies = [];
  const thresholds = await getThresholds();

  const summaries = await getDailySummaries(dates);
  const summaryMap = _.keyBy(summaries, 'date');

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const summary = summaryMap[date];
    
    if (!summary || !summary.hasData) {
      anomalies.push(createAnomaly(
        date,
        ANOMALY_TYPES.DATA_MISSING,
        SEVERITY_LEVELS.MEDIUM,
        '数据缺失',
        `当天没有健康数据记录，可能是未佩戴设备或数据未同步`,
        null,
        null
      ));
      continue;
    }

    const sleepResult = checkSleep(summary, thresholds, dates, i, summaryMap);
    if (sleepResult) anomalies.push(...sleepResult);

    const hrResult = checkHeartRate(summary, thresholds);
    if (hrResult) anomalies.push(...hrResult);

    const hrvResult = checkHRV(summary, thresholds);
    if (hrvResult) anomalies.push(...hrvResult);

    const activityResult = checkActivity(summary, thresholds, dates, i, summaryMap);
    if (activityResult) anomalies.push(...activityResult);
  }

  const debtResult = checkSleepDebt(summaries, thresholds);
  if (debtResult) anomalies.push(...debtResult);

  const recoveryResult = checkRecoveryPattern(summaries, thresholds);
  if (recoveryResult) anomalies.push(...recoveryResult);

  await saveAnomalies(anomalies);

  return {
    anomalies: sortAnomalies(anomalies),
    summary: {
      total: anomalies.length,
      byType: _.countBy(anomalies, 'type'),
      bySeverity: _.countBy(anomalies, 'severity'),
      dateRange: { startDate, endDate },
    },
  };
}

async function getThresholds() {
  const results = db.all(`SELECT * FROM thresholds`);
  const thresholds = {};
  
  for (const t of results) {
    if (!thresholds[t.category]) {
      thresholds[t.category] = {};
    }
    thresholds[t.category][t.key] = {
      value: t.value,
      label: t.label,
      description: t.description,
      unit: t.unit,
    };
  }

  return {
    sleep: {
      targetHours: thresholds.sleep?.target_hours?.value || 7.5,
      minAcceptable: thresholds.sleep?.min_acceptable?.value || 6,
      consecutiveBadDays: thresholds.sleep?.consecutive_bad_days?.value || 3,
    },
    heartRate: {
      restingHigh: thresholds.heart_rate?.resting_high?.value || 80,
      restingLow: thresholds.heart_rate?.resting_low?.value || 40,
      variabilityLow: thresholds.heart_rate?.variability_low?.value || 20,
    },
    activity: {
      stepsLow: thresholds.activity?.steps_low?.value || 1000,
      workoutSuddenIncrease: thresholds.activity?.workout_sudden_increase?.value || 2.0,
    },
    recovery: {
      sleepDebtThreshold: thresholds.recovery?.sleep_debt_threshold?.value || 5,
    },
  };
}

async function getDailySummaries(dates) {
  if (!dates.length) return [];
  
  const placeholders = dates.map(() => '?').join(',');
  return db.all(`
    SELECT * FROM daily_summaries 
    WHERE date IN (${placeholders})
    ORDER BY date
  `, dates);
}

function checkSleep(summary, thresholds, dates, currentIndex, summaryMap) {
  const anomalies = [];
  const sleepHours = summary.sleepTotal ? summary.sleepTotal / 60 : 0;

  if (sleepHours > 0 && sleepHours < thresholds.sleep.minAcceptable) {
    anomalies.push(createAnomaly(
      summary.date,
      ANOMALY_TYPES.SLEEP_DEFICIT,
      sleepHours < 4 ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.MEDIUM,
      '睡眠不足',
      `当天睡眠 ${sleepHours.toFixed(1)} 小时，低于最低阈值 ${thresholds.sleep.minAcceptable} 小时`,
      thresholds.sleep.minAcceptable,
      sleepHours
    ));
  }

  if (currentIndex >= thresholds.sleep.consecutiveBadDays - 1) {
    let consecutiveBad = 0;
    const badDates = [];
    
    for (let j = currentIndex; j >= 0 && consecutiveBad < thresholds.sleep.consecutiveBadDays; j--) {
      const prevDate = dates[j];
      const prevSummary = summaryMap[prevDate];
      
      if (prevSummary) {
        const prevSleepHours = prevSummary.sleepTotal ? prevSummary.sleepTotal / 60 : 0;
        if (prevSleepHours > 0 && prevSleepHours < thresholds.sleep.minAcceptable) {
          consecutiveBad++;
          badDates.push(prevDate);
        } else if (prevSleepHours > 0) {
          break;
        }
      }
    }

    if (consecutiveBad >= thresholds.sleep.consecutiveBadDays) {
      anomalies.push(createAnomaly(
        summary.date,
        ANOMALY_TYPES.SLEEP_DEFICIT,
        SEVERITY_LEVELS.HIGH,
        '连续睡眠不足',
        `已连续 ${consecutiveBad} 天睡眠不足。涉及日期: ${badDates.join(', ')}`,
        thresholds.sleep.consecutiveBadDays,
        consecutiveBad,
        { relatedDates: badDates }
      ));
    }
  }

  return anomalies;
}

function checkHeartRate(summary, thresholds) {
  const anomalies = [];
  
  if (summary.restingHeartRateAvg > 0) {
    if (summary.restingHeartRateAvg > thresholds.heartRate.restingHigh) {
      anomalies.push(createAnomaly(
        summary.date,
        ANOMALY_TYPES.RESTING_HR_HIGH,
        summary.restingHeartRateAvg > thresholds.heartRate.restingHigh + 10 ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.MEDIUM,
        '静息心率偏高',
        `静息心率 ${summary.restingHeartRateAvg.toFixed(0)} bpm，高于阈值 ${thresholds.heartRate.restingHigh} bpm`,
        thresholds.heartRate.restingHigh,
        summary.restingHeartRateAvg
      ));
    }

    if (summary.restingHeartRateAvg < thresholds.heartRate.restingLow) {
      anomalies.push(createAnomaly(
        summary.date,
        ANOMALY_TYPES.RESTING_HR_LOW,
        SEVERITY_LEVELS.LOW,
        '静息心率偏低',
        `静息心率 ${summary.restingHeartRateAvg.toFixed(0)} bpm，低于阈值 ${thresholds.heartRate.restingLow} bpm`,
        thresholds.heartRate.restingLow,
        summary.restingHeartRateAvg
      ));
    }
  }

  return anomalies;
}

function checkHRV(summary, thresholds) {
  const anomalies = [];
  
  if (summary.heartRateVariabilityAvg > 0 && 
      summary.heartRateVariabilityAvg < thresholds.heartRate.variabilityLow) {
    anomalies.push(createAnomaly(
      summary.date,
      ANOMALY_TYPES.HRV_LOW,
      summary.heartRateVariabilityAvg < thresholds.heartRate.variabilityLow / 2 ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.MEDIUM,
      '心率变异性偏低',
      `HRV ${summary.heartRateVariabilityAvg.toFixed(1)} ms，低于阈值 ${thresholds.heartRate.variabilityLow} ms，可能表示身体压力较大或恢复不足`,
      thresholds.heartRate.variabilityLow,
      summary.heartRateVariabilityAvg
    ));
  }

  return anomalies;
}

function checkActivity(summary, thresholds, dates, currentIndex, summaryMap) {
  const anomalies = [];

  if (summary.stepsTotal > 0 && summary.stepsTotal < thresholds.activity.stepsLow) {
    anomalies.push(createAnomaly(
      summary.date,
      ANOMALY_TYPES.STEPS_LOW,
      SEVERITY_LEVELS.LOW,
      '活动量过低',
      `当日步数 ${Math.round(summary.stepsTotal)}，低于阈值 ${thresholds.activity.stepsLow}，可能数据缺失或当日活动极少`,
      thresholds.activity.stepsLow,
      summary.stepsTotal
    ));
  }

  if (summary.workoutCount > 0 && currentIndex >= 7) {
    const recentWorkouts = [];
    for (let j = currentIndex - 7; j < currentIndex; j++) {
      const prevDate = dates[j];
      const prevSummary = summaryMap[prevDate];
      if (prevSummary && prevSummary.workoutDuration > 0) {
        recentWorkouts.push(prevSummary.workoutDuration);
      }
    }

    if (recentWorkouts.length > 0) {
      const avgDuration = _.mean(recentWorkouts);
      if (summary.workoutDuration > avgDuration * thresholds.activity.workoutSuddenIncrease) {
        anomalies.push(createAnomaly(
          summary.date,
          ANOMALY_TYPES.WORKOUT_SPIKE,
          SEVERITY_LEVELS.MEDIUM,
          '运动量突增',
          `当日运动时长 ${summary.workoutDuration.toFixed(0)} 分钟，较前7天平均值 ${avgDuration.toFixed(0)} 分钟增加超过 ${(thresholds.activity.workoutSuddenIncrease * 100 - 100).toFixed(0)}%，请注意恢复`,
          avgDuration * thresholds.activity.workoutSuddenIncrease,
          summary.workoutDuration
        ));
      }
    }
  }

  return anomalies;
}

function checkSleepDebt(summaries, thresholds) {
  const anomalies = [];
  
  if (!summaries.length) return anomalies;

  let cumulativeDebt = 0;
  const debtByDate = [];

  for (const summary of summaries) {
    if (summary.sleepTotal > 0) {
      const sleepHours = summary.sleepTotal / 60;
      const debt = Math.max(0, thresholds.sleep.targetHours - sleepHours);
      cumulativeDebt += debt;
      
      debtByDate.push({
        date: summary.date,
        sleepHours,
        debt,
        cumulativeDebt,
      });
    }
  }

  if (cumulativeDebt > thresholds.recovery.sleepDebtThreshold) {
    const latestSummary = summaries[summaries.length - 1];
    
    anomalies.push(createAnomaly(
      latestSummary.date,
      ANOMALY_TYPES.SLEEP_DEBT_ACCUMULATED,
      cumulativeDebt > thresholds.recovery.sleepDebtThreshold * 2 ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.MEDIUM,
      '睡眠债累积',
      `当前周期累计睡眠债 ${cumulativeDebt.toFixed(1)} 小时，超过阈值 ${thresholds.recovery.sleepDebtThreshold} 小时。建议尽早补充睡眠`,
      thresholds.recovery.sleepDebtThreshold,
      cumulativeDebt
    ));
  }

  return anomalies;
}

function checkRecoveryPattern(summaries, thresholds) {
  const anomalies = [];
  
  if (summaries.length < 3) return anomalies;

  for (let i = 2; i < summaries.length; i++) {
    const s1 = summaries[i - 2];
    const s2 = summaries[i - 1];
    const s3 = summaries[i];

    if (s1.workoutDuration > 60 && s2.workoutDuration > 60) {
      if (s3.sleepTotal > 0 && s3.sleepTotal / 60 < thresholds.sleep.minAcceptable) {
        if (s3.heartRateVariabilityAvg > 0 && s3.heartRateVariabilityAvg < thresholds.heartRate.variabilityLow) {
          anomalies.push(createAnomaly(
            s3.date,
            ANOMALY_TYPES.RECOVERY_INSUFFICIENT,
            SEVERITY_LEVELS.HIGH,
            '恢复不足警告',
            `连续两天运动后，当日睡眠不足（${(s3.sleepTotal/60).toFixed(1)}小时）且 HRV 偏低（${s3.heartRateVariabilityAvg.toFixed(1)}ms），身体可能处于过度疲劳状态`,
            null,
            null,
            { relatedDates: [s1.date, s2.date, s3.date] }
          ));
        }
      }
    }
  }

  return anomalies;
}

function createAnomaly(date, type, severity, title, description, thresholdValue, actualValue, extra = {}) {
  return {
    id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    date,
    type,
    severity,
    title,
    description,
    thresholdValue,
    actualValue,
    relatedMetrics: extra.relatedMetrics || [],
    relatedDates: extra.relatedDates || [],
    isDismissed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function saveAnomalies(anomalies) {
  const now = new Date().toISOString();
  
  for (const anomaly of anomalies) {
    db.run(`
      INSERT OR IGNORE INTO anomalies (
        id, date, type, severity, title, description,
        related_metrics, related_dates, threshold_value, actual_value,
        is_dismissed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      anomaly.id,
      anomaly.date,
      anomaly.type,
      anomaly.severity,
      anomaly.title,
      anomaly.description,
      JSON.stringify(anomaly.relatedMetrics),
      JSON.stringify(anomaly.relatedDates),
      anomaly.thresholdValue,
      anomaly.actualValue,
      anomaly.isDismissed ? 1 : 0,
      now,
      now,
    ]);
  }
}

function sortAnomalies(anomalies) {
  const severityOrder = {
    [SEVERITY_LEVELS.CRITICAL]: 0,
    [SEVERITY_LEVELS.HIGH]: 1,
    [SEVERITY_LEVELS.MEDIUM]: 2,
    [SEVERITY_LEVELS.LOW]: 3,
  };

  return _.orderBy(anomalies, [
    a => severityOrder[a.severity],
    a => dayjs(a.date).valueOf(),
  ], ['asc', 'desc']);
}

async function dismissAnomaly(anomalyId) {
  const now = new Date().toISOString();
  db.run(`
    UPDATE anomalies 
    SET is_dismissed = 1, updated_at = ?
    WHERE id = ?
  `, [now, anomalyId]);
  
  return db.get(`SELECT * FROM anomalies WHERE id = ?`, [anomalyId]);
}

async function getAnomalies(startDate, endDate, includeDismissed = false) {
  let query = `SELECT * FROM anomalies WHERE date >= ? AND date <= ?`;
  const params = [startDate, endDate];

  if (!includeDismissed) {
    query += ` AND is_dismissed = 0`;
  }

  query += ` ORDER BY 
    CASE severity 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      WHEN 'low' THEN 4 
      ELSE 5 
    END,
    date DESC`;

  return db.all(query, params);
}

module.exports = {
  detectAnomalies,
  dismissAnomaly,
  getAnomalies,
  ANOMALY_TYPES,
  SEVERITY_LEVELS,
};
