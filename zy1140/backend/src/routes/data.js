const express = require('express');
const _ = require('lodash');

const db = require('../database');
const { fillMissingDates, calculateCalendarHeatmapData, calculateSleepDebt } = require('../services/dataProcessor');
const { getDateRange, toDateString } = require('../utils/date');
const { getTypeDisplayName, getWorkoutTypeName } = require('../utils/units');

const router = express.Router();

router.get('/summary', async (req, res) => {
  const { startDate, endDate, metric = 'all' } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: '请提供 startDate 和 endDate' });
  }

  try {
    const summaries = await fillMissingDates(startDate, endDate);

    const stats = calculateRangeStats(summaries, metric);
    
    const sleepDebt = await calculateSleepDebt(summaries, 7.5);

    const minDate = db.get(`SELECT MIN(date) as min FROM daily_summaries WHERE has_data = 1`);
    const maxDate = db.get(`SELECT MAX(date) as max FROM daily_summaries WHERE has_data = 1`);
    const totalDays = db.get(`SELECT COUNT(DISTINCT date) as count FROM daily_summaries WHERE has_data = 1`);
    const totalRecords = db.get(`SELECT COUNT(*) as count FROM health_records`);
    const totalWorkouts = db.get(`SELECT COUNT(*) as count FROM workouts`);

    res.json({
      range: { startDate, endDate },
      stats,
      sleepDebt,
      summaries,
      overview: {
        minDate: minDate?.min,
        maxDate: maxDate?.max,
        totalDaysWithData: totalDays?.count || 0,
        totalHealthRecords: totalRecords?.count || 0,
        totalWorkouts: totalWorkouts?.count || 0,
      },
    });

  } catch (error) {
    console.error('Error getting summary:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/daily/:date', async (req, res) => {
  const { date } = req.params;

  try {
    const summary = db.get(`
      SELECT * FROM daily_summaries WHERE date = ?
    `, [date]);

    if (!summary) {
      return res.status(404).json({ error: '未找到该日期的数据' });
    }

    const note = db.get(`
      SELECT * FROM daily_notes WHERE date = ?
    `, [date]);

    const workouts = db.all(`
      SELECT * FROM workouts WHERE date = ? ORDER BY start_date
    `, [date]);

    const recentAnomalies = db.all(`
      SELECT * FROM anomalies 
      WHERE date = ? AND is_dismissed = 0
      ORDER BY CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        ELSE 4 
      END
    `, [date]);

    const hrRecords = db.all(`
      SELECT * FROM health_records 
      WHERE type = 'HKQuantityTypeIdentifierHeartRate' AND date = ?
      ORDER BY start_date
    `, [date]);

    const hrByHour = _.groupBy(hrRecords, r => {
      if (r.startDate) {
        const d = new Date(r.startDate);
        return d.getHours();
      }
      return 0;
    });

    const hrHourlyStats = Object.entries(hrByHour).map(([hour, records]) => {
      const values = records.map(r => r.value).filter(v => v > 0);
      return {
        hour: parseInt(hour),
        avg: values.length ? _.round(_.mean(values), 0) : 0,
        min: values.length ? Math.min(...values) : 0,
        max: values.length ? Math.max(...values) : 0,
        count: values.length,
      };
    }).sort((a, b) => a.hour - b.hour);

    res.json({
      summary,
      note,
      workouts: workouts.map(w => ({
        ...w,
        typeDisplayName: getWorkoutTypeName(w.workout_activity_type),
      })),
      anomalies: recentAnomalies,
      heartRate: {
        hourly: hrHourlyStats,
        rawRecords: hrRecords.slice(0, 100),
      },
    });

  } catch (error) {
    console.error('Error getting daily data:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/workouts', async (req, res) => {
  const { startDate, endDate, type, limit = 50, offset = 0 } = req.query;

  try {
    let query = `SELECT * FROM workouts WHERE 1=1`;
    const params = [];

    if (startDate) {
      query += ` AND date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND date <= ?`;
      params.push(endDate);
    }
    if (type) {
      query += ` AND workout_activity_type = ?`;
      params.push(type);
    }

    query += ` ORDER BY start_date DESC`;
    
    const totalQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const total = db.get(totalQuery, params);

    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const workouts = db.all(query, params);

    const workoutStats = db.all(`
      SELECT 
        workout_activity_type as type,
        COUNT(*) as count,
        SUM(duration) as total_duration,
        SUM(total_distance) as total_distance,
        SUM(total_energy_burned) as total_energy,
        AVG(duration) as avg_duration,
        AVG(total_distance) as avg_distance
      FROM workouts
      ${startDate || endDate ? 'WHERE 1=1' : ''}
      ${startDate ? ' AND date >= ?' : ''}
      ${endDate ? ' AND date <= ?' : ''}
      GROUP BY workout_activity_type
      ORDER BY count DESC
    `, [startDate, endDate].filter(Boolean));

    res.json({
      workouts: workouts.map(w => ({
        ...w,
        typeDisplayName: getWorkoutTypeName(w.workout_activity_type),
      })),
      stats: workoutStats.map(s => ({
        ...s,
        typeDisplayName: getWorkoutTypeName(s.type),
      })),
      pagination: {
        total: total?.count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });

  } catch (error) {
    console.error('Error getting workouts:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/workouts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const workout = db.get(`SELECT * FROM workouts WHERE id = ?`, [id]);

    if (!workout) {
      return res.status(404).json({ error: '未找到该运动记录' });
    }

    const routePoints = db.all(`
      SELECT * FROM workout_routes WHERE workout_id = ? ORDER BY point_index
    `, [id]);

    res.json({
      workout: {
        ...workout,
        typeDisplayName: getWorkoutTypeName(workout.workout_activity_type),
      },
      route: routePoints.length > 0 ? {
        points: routePoints,
        count: routePoints.length,
        stats: calculateRouteStats(routePoints),
      } : null,
    });

  } catch (error) {
    console.error('Error getting workout:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/calendar-heatmap', async (req, res) => {
  const { startDate, endDate, metric = 'stepsTotal' } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: '请提供 startDate 和 endDate' });
  }

  try {
    const heatmapData = await calculateCalendarHeatmapData(startDate, endDate, metric);
    res.json(heatmapData);

  } catch (error) {
    console.error('Error getting heatmap:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/metrics', async (req, res) => {
  const { type, startDate, endDate, aggregate = 'daily' } = req.query;

  if (!type) {
    return res.status(400).json({ error: '请提供指标类型 type' });
  }

  try {
    let query = `
      SELECT date, value, unit, start_date, end_date, source_name, device
      FROM health_records 
      WHERE type = ?
    `;
    const params = [type];

    if (startDate) {
      query += ` AND date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY start_date`;

    const records = db.all(query, params);

    let aggregatedData;
    if (aggregate === 'daily') {
      const byDate = _.groupBy(records, 'date');
      aggregatedData = Object.entries(byDate).map(([date, dayRecords]) => {
        const values = dayRecords.map(r => r.value).filter(v => v !== null && !isNaN(v));
        return {
          date,
          count: values.length,
          sum: _.sum(values),
          avg: values.length ? _.round(_.mean(values), 2) : 0,
          min: values.length ? Math.min(...values) : 0,
          max: values.length ? Math.max(...values) : 0,
          unit: dayRecords[0]?.unit,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));
    } else {
      aggregatedData = records;
    }

    res.json({
      type,
      typeDisplayName: getTypeDisplayName(type),
      aggregated: aggregate === 'daily' ? aggregatedData : null,
      rawRecords: aggregate === 'none' ? records : records.slice(0, 100),
      totalRecords: records.length,
    });

  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/available-types', async (req, res) => {
  try {
    const types = db.all(`
      SELECT DISTINCT type, COUNT(*) as count
      FROM health_records
      GROUP BY type
      ORDER BY count DESC
    `);

    const workouts = db.all(`
      SELECT DISTINCT workout_activity_type as type, COUNT(*) as count
      FROM workouts
      GROUP BY workout_activity_type
      ORDER BY count DESC
    `);

    res.json({
      healthRecordTypes: types.map(t => ({
        ...t,
        displayName: getTypeDisplayName(t.type),
      })),
      workoutTypes: workouts.map(w => ({
        ...w,
        displayName: getWorkoutTypeName(w.type),
      })),
    });

  } catch (error) {
    console.error('Error getting types:', error);
    res.status(500).json({ error: error.message });
  }
});

function calculateRangeStats(summaries, metric) {
  const validSummaries = summaries.filter(s => s.has_data === 1 || s.hasData);

  if (!validSummaries.length) {
    return {
      totalDays: summaries.length,
      daysWithData: 0,
      metrics: {},
    };
  }

  const metrics = {
    steps: {
      total: _.sumBy(validSummaries, s => s.steps_total || s.stepsTotal || 0),
      avg: _.round(_.meanBy(validSummaries, s => s.steps_total || s.stepsTotal || 0), 0),
      max: Math.max(...validSummaries.map(s => s.steps_total || s.stepsTotal || 0)),
      min: Math.min(...validSummaries.filter(s => (s.steps_total || s.stepsTotal) > 0).map(s => s.steps_total || s.stepsTotal || Infinity)),
    },
    sleep: {
      totalMinutes: _.sumBy(validSummaries, s => s.sleep_total || s.sleepTotal || 0),
      avgHours: _.round(_.meanBy(validSummaries, s => (s.sleep_total || s.sleepTotal || 0) / 60), 1),
      avgDeepHours: _.round(_.meanBy(validSummaries, s => (s.sleep_deep || s.sleepDeep || 0) / 60), 1),
      avgRemHours: _.round(_.meanBy(validSummaries, s => (s.sleep_rem || s.sleepRem || 0) / 60), 1),
    },
    heartRate: {
      avgResting: _.round(_.meanBy(validSummaries.filter(s => (s.resting_heart_rate_avg || s.restingHeartRateAvg) > 0), s => s.resting_heart_rate_avg || s.restingHeartRateAvg || 0), 0),
      avgOverall: _.round(_.meanBy(validSummaries.filter(s => (s.heart_rate_avg || s.heartRateAvg) > 0), s => s.heart_rate_avg || s.heartRateAvg || 0), 0),
      avgHRV: _.round(_.meanBy(validSummaries.filter(s => (s.heart_rate_variability_avg || s.heartRateVariabilityAvg) > 0), s => s.heart_rate_variability_avg || s.heartRateVariabilityAvg || 0), 1),
    },
    activity: {
      totalWorkouts: _.sumBy(validSummaries, s => s.workout_count || s.workoutCount || 0),
      totalWorkoutMinutes: _.sumBy(validSummaries, s => s.workout_duration || s.workoutDuration || 0),
      totalWorkoutDistance: _.round(_.sumBy(validSummaries, s => s.workout_distance || s.workoutDistance || 0), 2),
      totalActiveEnergy: _.round(_.sumBy(validSummaries, s => s.active_energy || s.activeEnergy || 0), 0),
      totalBasalEnergy: _.round(_.sumBy(validSummaries, s => s.basal_energy || s.basalEnergy || 0), 0),
    },
  };

  return {
    totalDays: summaries.length,
    daysWithData: validSummaries.length,
    daysMissing: summaries.length - validSummaries.length,
    metrics,
  };
}

function calculateRouteStats(points) {
  if (!points.length) return null;

  const validHR = points.filter(p => p.heart_rate > 0).map(p => p.heart_rate);
  const validCadence = points.filter(p => p.cadence > 0).map(p => p.cadence);
  const validElevation = points.filter(p => p.elevation !== null).map(p => p.elevation);

  let totalAscent = 0;
  let totalDescent = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].elevation !== null && points[i-1].elevation !== null) {
      const diff = points[i].elevation - points[i-1].elevation;
      if (diff > 0) totalAscent += diff;
      else if (diff < 0) totalDescent += Math.abs(diff);
    }
  }

  return {
    totalPoints: points.length,
    totalDistance: points[points.length - 1]?.distance || 0,
    heartRate: {
      avg: validHR.length ? _.round(_.mean(validHR), 0) : 0,
      min: validHR.length ? Math.min(...validHR) : 0,
      max: validHR.length ? Math.max(...validHR) : 0,
    },
    cadence: {
      avg: validCadence.length ? _.round(_.mean(validCadence), 0) : 0,
      min: validCadence.length ? Math.min(...validCadence) : 0,
      max: validCadence.length ? Math.max(...validCadence) : 0,
    },
    elevation: {
      avg: validElevation.length ? _.round(_.mean(validElevation), 1) : 0,
      min: validElevation.length ? Math.min(...validElevation) : 0,
      max: validElevation.length ? Math.max(...validElevation) : 0,
      totalAscent: _.round(totalAscent, 1),
      totalDescent: _.round(totalDescent, 1),
    },
  };
}

module.exports = router;
