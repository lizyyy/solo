const express = require('express');
const Papa = require('papaparse');
const _ = require('lodash');

const db = require('../database');
const { fillMissingDates, calculateSleepDebt } = require('../services/dataProcessor');
const { getDateRange } = require('../utils/date');

const router = express.Router();

router.get('/generate', async (req, res) => {
  const { startDate, endDate, format = 'json', include = 'all' } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: '请提供 startDate 和 endDate' });
  }

  try {
    const reportData = await generateReportData(startDate, endDate, include);

    switch (format.toLowerCase()) {
      case 'json':
        res.json({
          success: true,
          format: 'json',
          dateRange: { startDate, endDate },
          generatedAt: new Date().toISOString(),
          data: reportData,
        });
        break;

      case 'csv':
        const csvContent = generateCSV(reportData);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=health-report-${startDate}-to-${endDate}.csv`);
        res.send('\uFEFF' + csvContent);
        break;

      case 'markdown':
      case 'md':
        const mdContent = generateMarkdown(reportData, startDate, endDate);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=health-report-${startDate}-to-${endDate}.md`);
        res.send(mdContent);
        break;

      case 'html':
        const htmlContent = generateHTML(reportData, startDate, endDate);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=health-report-${startDate}-to-${endDate}.html`);
        res.send(htmlContent);
        break;

      default:
        res.status(400).json({ error: '不支持的导出格式: ' + format });
    }

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: error.message });
  }
});

async function generateReportData(startDate, endDate, include) {
  const dates = getDateRange(startDate, endDate);
  const summaries = await fillMissingDates(startDate, endDate);
  const sleepDebt = await calculateSleepDebt(summaries, 7.5);

  const anomalies = db.all(`
    SELECT * FROM anomalies 
    WHERE date >= ? AND date <= ? AND is_dismissed = 0
    ORDER BY CASE severity 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      ELSE 4 
    END, date DESC
  `, [startDate, endDate]);

  const notes = db.all(`
    SELECT * FROM daily_notes 
    WHERE date >= ? AND date <= ?
    ORDER BY date
  `, [startDate, endDate]);

  const workouts = db.all(`
    SELECT * FROM workouts 
    WHERE date >= ? AND date <= ?
    ORDER BY start_date DESC
  `, [startDate, endDate]);

  const thresholds = db.all(`
    SELECT * FROM thresholds 
    ORDER BY category, key
  `);

  const stats = calculateRangeStats(summaries);

  return {
    overview: {
      dateRange: { startDate, endDate },
      totalDays: dates.length,
      daysWithData: summaries.filter(s => s.has_data === 1 || s.hasData).length,
      daysMissing: dates.length - summaries.filter(s => s.has_data === 1 || s.hasData).length,
      generatedAt: new Date().toISOString(),
    },
    stats,
    sleepDebt,
    anomalies,
    notes,
    workouts,
    thresholds,
    dailySummaries: summaries,
  };
}

function calculateRangeStats(summaries) {
  const validSummaries = summaries.filter(s => s.has_data === 1 || s.hasData);

  if (!validSummaries.length) {
    return {
      steps: { total: 0, avg: 0, max: 0, min: 0 },
      sleep: { totalMinutes: 0, avgHours: 0 },
      heartRate: { avgResting: 0, avgHRV: 0 },
      activity: { totalWorkouts: 0, totalWorkoutMinutes: 0, totalActiveEnergy: 0 },
    };
  }

  return {
    steps: {
      total: _.round(_.sumBy(validSummaries, s => s.steps_total || s.stepsTotal || 0), 0),
      avg: _.round(_.meanBy(validSummaries, s => s.steps_total || s.stepsTotal || 0), 0),
      max: Math.max(...validSummaries.map(s => s.steps_total || s.stepsTotal || 0)),
      min: Math.min(...validSummaries.filter(s => (s.steps_total || s.stepsTotal) > 0).map(s => s.steps_total || s.stepsTotal || Infinity)),
    },
    sleep: {
      totalMinutes: _.round(_.sumBy(validSummaries, s => s.sleep_total || s.sleepTotal || 0), 0),
      avgHours: _.round(_.meanBy(validSummaries, s => (s.sleep_total || s.sleepTotal || 0) / 60), 1),
      avgDeepHours: _.round(_.meanBy(validSummaries.filter(s => (s.sleep_deep || s.sleepDeep) > 0), s => (s.sleep_deep || s.sleepDeep || 0) / 60), 1),
      avgRemHours: _.round(_.meanBy(validSummaries.filter(s => (s.sleep_rem || s.sleepRem) > 0), s => (s.sleep_rem || s.sleepRem || 0) / 60), 1),
    },
    heartRate: {
      avgResting: _.round(_.meanBy(validSummaries.filter(s => (s.resting_heart_rate_avg || s.restingHeartRateAvg) > 0), s => s.resting_heart_rate_avg || s.restingHeartRateAvg || 0), 0),
      avgOverall: _.round(_.meanBy(validSummaries.filter(s => (s.heart_rate_avg || s.heartRateAvg) > 0), s => s.heart_rate_avg || s.heartRateAvg || 0), 0),
      avgHRV: _.round(_.meanBy(validSummaries.filter(s => (s.heart_rate_variability_avg || s.heartRateVariabilityAvg) > 0), s => s.heart_rate_variability_avg || s.heartRateVariabilityAvg || 0), 1),
    },
    activity: {
      totalWorkouts: _.sumBy(validSummaries, s => s.workout_count || s.workoutCount || 0),
      totalWorkoutMinutes: _.round(_.sumBy(validSummaries, s => s.workout_duration || s.workoutDuration || 0), 0),
      totalWorkoutDistance: _.round(_.sumBy(validSummaries, s => s.workout_distance || s.workoutDistance || 0), 2),
      totalActiveEnergy: _.round(_.sumBy(validSummaries, s => s.active_energy || s.activeEnergy || 0), 0),
      totalBasalEnergy: _.round(_.sumBy(validSummaries, s => s.basal_energy || s.basalEnergy || 0), 0),
    },
  };
}

function generateCSV(data) {
  const rows = [];

  rows.push(['健康数据报告', '', '', '', '', '']);
  rows.push(['日期范围', `${data.overview.dateRange.startDate} 至 ${data.overview.dateRange.endDate}`, '', '', '', '']);
  rows.push(['生成时间', data.overview.generatedAt, '', '', '', '']);
  rows.push(['', '', '', '', '', '']);

  rows.push(['统计概览', '', '', '', '', '']);
  rows.push(['指标', '数值', '单位', '', '', '']);
  rows.push(['总天数', data.overview.totalDays, '天', '', '', '']);
  rows.push(['有数据天数', data.overview.daysWithData, '天', '', '', '']);
  rows.push(['缺失数据天数', data.overview.daysMissing, '天', '', '', '']);
  rows.push(['总步数', data.stats.steps.total, '步', '', '', '']);
  rows.push(['平均每日步数', data.stats.steps.avg, '步', '', '', '']);
  rows.push(['平均睡眠时长', data.stats.sleep.avgHours, '小时/天', '', '', '']);
  rows.push(['平均静息心率', data.stats.heartRate.avgResting, 'bpm', '', '', '']);
  rows.push(['平均HRV', data.stats.heartRate.avgHRV, 'ms', '', '', '']);
  rows.push(['运动次数', data.stats.activity.totalWorkouts, '次', '', '', '']);
  rows.push(['总运动时长', data.stats.activity.totalWorkoutMinutes, '分钟', '', '', '']);
  rows.push(['总活动能量', data.stats.activity.totalActiveEnergy, 'kcal', '', '', '']);
  rows.push(['', '', '', '', '', '']);

  rows.push(['异常记录', '', '', '', '', '']);
  if (data.anomalies.length > 0) {
    rows.push(['日期', '类型', '严重程度', '标题', '描述', '']);
    for (const a of data.anomalies) {
      rows.push([a.date, a.type, a.severity, a.title, a.description || '', '']);
    }
  } else {
    rows.push(['无异常记录', '', '', '', '', '']);
  }
  rows.push(['', '', '', '', '', '']);

  rows.push(['每日备注', '', '', '', '', '']);
  if (data.notes.length > 0) {
    rows.push(['日期', '标签', '备注内容', '', '', '']);
    for (const n of data.notes) {
      rows.push([n.date, n.tags || '', n.note || '', '', '', '']);
    }
  } else {
    rows.push(['无备注记录', '', '', '', '', '']);
  }

  return Papa.unparse(rows);
}

function generateMarkdown(data, startDate, endDate) {
  const md = [];

  md.push(`# 健康数据报告`);
  md.push('');
  md.push(`**日期范围**: ${startDate} 至 ${endDate}`);
  md.push(`**生成时间**: ${data.overview.generatedAt}`);
  md.push('');

  md.push(`## 概览`);
  md.push('');
  md.push(`| 指标 | 数值 | 单位 |`);
  md.push(`|------|------|------|`);
  md.push(`| 总天数 | ${data.overview.totalDays} | 天 |`);
  md.push(`| 有数据天数 | ${data.overview.daysWithData} | 天 |`);
  md.push(`| 缺失数据天数 | ${data.overview.daysMissing} | 天 |`);
  md.push('');

  md.push(`## 活动统计`);
  md.push('');
  md.push(`| 指标 | 数值 | 单位 |`);
  md.push(`|------|------|------|`);
  md.push(`| 总步数 | ${data.stats.steps.total.toLocaleString()} | 步 |`);
  md.push(`| 平均每日步数 | ${data.stats.steps.avg.toLocaleString()} | 步 |`);
  md.push(`| 运动次数 | ${data.stats.activity.totalWorkouts} | 次 |`);
  md.push(`| 总运动时长 | ${data.stats.activity.totalWorkoutMinutes} | 分钟 |`);
  md.push(`| 总运动距离 | ${data.stats.activity.totalWorkoutDistance} | km |`);
  md.push(`| 总活动能量 | ${data.stats.activity.totalActiveEnergy.toLocaleString()} | kcal |`);
  md.push('');

  md.push(`## 睡眠统计`);
  md.push('');
  md.push(`| 指标 | 数值 | 单位 |`);
  md.push(`|------|------|------|`);
  md.push(`| 平均睡眠时长 | ${data.stats.sleep.avgHours} | 小时/天 |`);
  md.push(`| 平均深睡时长 | ${data.stats.sleep.avgDeepHours} | 小时/天 |`);
  md.push(`| 平均REM时长 | ${data.stats.sleep.avgRemHours} | 小时/天 |`);
  md.push(`| 累计睡眠债 | ${data.sleepDebt.totalDebt.toFixed(1)} | 小时 |`);
  md.push('');

  md.push(`## 心率与恢复`);
  md.push('');
  md.push(`| 指标 | 数值 | 单位 |`);
  md.push(`|------|------|------|`);
  md.push(`| 平均静息心率 | ${data.stats.heartRate.avgResting} | bpm |`);
  md.push(`| 平均HRV | ${data.stats.heartRate.avgHRV} | ms |`);
  md.push('');

  md.push(`## 异常记录`);
  md.push('');

  if (data.anomalies.length > 0) {
    md.push(`| 日期 | 严重程度 | 标题 | 描述 |`);
    md.push(`|------|----------|------|------|`);
    for (const a of data.anomalies) {
      const severityEmoji = a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🟢';
      md.push(`| ${a.date} | ${severityEmoji} ${a.severity} | ${a.title} | ${a.description || '-'} |`);
    }
  } else {
    md.push(`✨ 该时段内没有检测到异常记录。`);
  }
  md.push('');

  md.push(`## 每日备注`);
  md.push('');

  if (data.notes.length > 0) {
    md.push(`| 日期 | 标签 | 备注 |`);
    md.push(`|------|------|------|`);
    for (const n of data.notes) {
      md.push(`| ${n.date} | ${n.tags || '-'} | ${n.note || '-'} |`);
    }
  } else {
    md.push(`该时段内没有备注记录。`);
  }
  md.push('');

  md.push(`---`);
  md.push(`*此报告由 Apple Health Dashboard 自动生成*`);

  return md.join('\n');
}

function generateHTML(data, startDate, endDate) {
  const html = [];

  html.push(`<!DOCTYPE html>`);
  html.push(`<html lang="zh-CN">`);
  html.push(`<head>`);
  html.push(`  <meta charset="UTF-8">`);
  html.push(`  <meta name="viewport" content="width=device-width, initial-scale=1.0">`);
  html.push(`  <title>健康数据报告 - ${startDate} 至 ${endDate}</title>`);
  html.push(`  <style>`);
  html.push(`    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }`);
  html.push(`    h1 { color: #FF2D55; border-bottom: 2px solid #FF2D55; padding-bottom: 10px; }`);
  html.push(`    h2 { color: #1C1C1E; margin-top: 30px; border-left: 4px solid #FF2D55; padding-left: 10px; }`);
  html.push(`    table { width: 100%; border-collapse: collapse; margin: 15px 0; }`);
  html.push(`    th, td { border: 1px solid #E5E5EA; padding: 12px; text-align: left; }`);
  html.push(`    th { background-color: #F2F2F7; font-weight: 600; }`);
  html.push(`    tr:nth-child(even) { background-color: #FAFAFA; }`);
  html.push(`    .meta { color: #8E8E93; font-size: 0.9em; margin-bottom: 20px; }`);
  html.push(`    .severity-high { color: #FF3B30; font-weight: bold; }`);
  html.push(`    .severity-medium { color: #FF9500; font-weight: bold; }`);
  html.push(`    .severity-low { color: #34C759; font-weight: bold; }`);
  html.push(`    .card { background: #FFFFFF; border-radius: 12px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }`);
  html.push(`  </style>`);
  html.push(`</head>`);
  html.push(`<body>`);

  html.push(`<h1>健康数据报告</h1>`);
  html.push(`<div class="meta">`);
  html.push(`  <p><strong>日期范围:</strong> ${startDate} 至 ${endDate}</p>`);
  html.push(`  <p><strong>生成时间:</strong> ${data.overview.generatedAt}</p>`);
  html.push(`</div>`);

  html.push(`<h2>概览</h2>`);
  html.push(`<table>`);
  html.push(`  <tr><th>指标</th><th>数值</th><th>单位</th></tr>`);
  html.push(`  <tr><td>总天数</td><td>${data.overview.totalDays}</td><td>天</td></tr>`);
  html.push(`  <tr><td>有数据天数</td><td>${data.overview.daysWithData}</td><td>天</td></tr>`);
  html.push(`  <tr><td>缺失数据天数</td><td>${data.overview.daysMissing}</td><td>天</td></tr>`);
  html.push(`</table>`);

  html.push(`<h2>活动统计</h2>`);
  html.push(`<table>`);
  html.push(`  <tr><th>指标</th><th>数值</th><th>单位</th></tr>`);
  html.push(`  <tr><td>总步数</td><td>${data.stats.steps.total.toLocaleString()}</td><td>步</td></tr>`);
  html.push(`  <tr><td>平均每日步数</td><td>${data.stats.steps.avg.toLocaleString()}</td><td>步</td></tr>`);
  html.push(`  <tr><td>运动次数</td><td>${data.stats.activity.totalWorkouts}</td><td>次</td></tr>`);
  html.push(`  <tr><td>总运动时长</td><td>${data.stats.activity.totalWorkoutMinutes}</td><td>分钟</td></tr>`);
  html.push(`  <tr><td>总运动距离</td><td>${data.stats.activity.totalWorkoutDistance}</td><td>km</td></tr>`);
  html.push(`  <tr><td>总活动能量</td><td>${data.stats.activity.totalActiveEnergy.toLocaleString()}</td><td>kcal</td></tr>`);
  html.push(`</table>`);

  html.push(`<h2>睡眠统计</h2>`);
  html.push(`<table>`);
  html.push(`  <tr><th>指标</th><th>数值</th><th>单位</th></tr>`);
  html.push(`  <tr><td>平均睡眠时长</td><td>${data.stats.sleep.avgHours}</td><td>小时/天</td></tr>`);
  html.push(`  <tr><td>累计睡眠债</td><td>${data.sleepDebt.totalDebt.toFixed(1)}</td><td>小时</td></tr>`);
  html.push(`</table>`);

  html.push(`<h2>异常记录</h2>`);
  if (data.anomalies.length > 0) {
    html.push(`<table>`);
    html.push(`  <tr><th>日期</th><th>严重程度</th><th>标题</th><th>描述</th></tr>`);
    for (const a of data.anomalies) {
      html.push(`  <tr>`);
      html.push(`    <td>${a.date}</td>`);
      html.push(`    <td class="severity-${a.severity}">${a.severity}</td>`);
      html.push(`    <td>${a.title}</td>`);
      html.push(`    <td>${a.description || '-'}</td>`);
      html.push(`  </tr>`);
    }
    html.push(`</table>`);
  } else {
    html.push(`<p style="color: #34C759;">✨ 该时段内没有检测到异常记录。</p>`);
  }

  html.push(`<h2>每日备注</h2>`);
  if (data.notes.length > 0) {
    html.push(`<table>`);
    html.push(`  <tr><th>日期</th><th>标签</th><th>备注</th></tr>`);
    for (const n of data.notes) {
      html.push(`  <tr>`);
      html.push(`    <td>${n.date}</td>`);
      html.push(`    <td>${n.tags || '-'}</td>`);
      html.push(`    <td>${n.note || '-'}</td>`);
      html.push(`  </tr>`);
    }
    html.push(`</table>`);
  } else {
    html.push(`<p>该时段内没有备注记录。</p>`);
  }

  html.push(`<hr style="margin: 40px 0; border: 0; border-top: 1px solid #E5E5EA;">`);
  html.push(`<p style="color: #8E8E93; text-align: center; font-size: 0.9em;">此报告由 Apple Health Dashboard 自动生成</p>`);

  html.push(`</body>`);
  html.push(`</html>`);

  return html.join('\n');
}

module.exports = router;
