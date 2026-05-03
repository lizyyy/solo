import moment from 'moment';
import config from '../config/index.js';
import { getWeekNumber, daysBetween, formatDate } from '../utils/date.js';
import { getSurfaceName, getTrainingTypeName } from '../utils/normalization.js';

export class RiskAnalyzer {
  constructor(runs = [], soreness = [], referenceDate = moment()) {
    this.runs = runs;
    this.soreness = soreness;
    this.referenceDate = moment(referenceDate);
  }

  calculateWorkload(run) {
    const pace = run.pace || 5;
    const distance = run.distance;
    const elevation = run.elevation;
    
    const elevationFactor = 1 + (Math.abs(elevation) / 100) * 0.1;
    const paceFactor = this.getPaceFactor(pace);
    
    return distance * elevationFactor * paceFactor;
  }

  getPaceFactor(pace) {
    if (pace < 4) return 1.5;
    if (pace < 4.5) return 1.3;
    if (pace < 5) return 1.1;
    if (pace < 5.5) return 1.0;
    if (pace < 6) return 0.9;
    return 0.8;
  }

  calculateAcuteWorkload() {
    const acuteStart = this.referenceDate.clone().subtract(config.risks.acuteDays, 'days');
    const acuteRuns = this.runs.filter(r => 
      r.date.isAfter(acuteStart) && r.date.isSameOrBefore(this.referenceDate)
    );
    
    return {
      totalWorkload: acuteRuns.reduce((sum, r) => sum + this.calculateWorkload(r), 0),
      totalDistance: acuteRuns.reduce((sum, r) => sum + r.distance, 0),
      runCount: acuteRuns.length,
      runs: acuteRuns,
      startDate: acuteStart,
      endDate: this.referenceDate
    };
  }

  calculateChronicWorkload() {
    const chronicStart = this.referenceDate.clone().subtract(config.risks.chronicDays, 'days');
    const acuteStart = this.referenceDate.clone().subtract(config.risks.acuteDays, 'days');
    
    const chronicRuns = this.runs.filter(r => 
      r.date.isAfter(chronicStart) && r.date.isSameOrBefore(acuteStart)
    );
    
    const chronicWeeks = config.risks.chronicDays / 7;
    
    return {
      totalWorkload: chronicRuns.reduce((sum, r) => sum + this.calculateWorkload(r), 0),
      avgWeeklyWorkload: chronicRuns.reduce((sum, r) => sum + this.calculateWorkload(r), 0) / chronicWeeks,
      totalDistance: chronicRuns.reduce((sum, r) => sum + r.distance, 0),
      avgWeeklyDistance: chronicRuns.reduce((sum, r) => sum + r.distance, 0) / chronicWeeks,
      runCount: chronicRuns.length,
      runs: chronicRuns,
      startDate: chronicStart,
      endDate: acuteStart
    };
  }

  calculateACWR() {
    const acute = this.calculateAcuteWorkload();
    const chronic = this.calculateChronicWorkload();
    
    let acwr = null;
    let acwrDistance = null;
    
    if (chronic.avgWeeklyWorkload > 0) {
      acwr = acute.totalWorkload / chronic.avgWeeklyWorkload;
    }
    if (chronic.avgWeeklyDistance > 0) {
      acwrDistance = acute.totalDistance / chronic.avgWeeklyDistance;
    }
    
    let level = 'safe';
    let message = '训练负荷正常';
    
    if (acwr !== null) {
      if (acwr >= config.risks.acwrDangerThreshold) {
        level = 'danger';
        message = `急慢比过高 (${acwr.toFixed(2)})，有较高受伤风险`;
      } else if (acwr >= config.risks.acwrWarnThreshold) {
        level = 'warning';
        message = `急慢比偏高 (${acwr.toFixed(2)})，注意控制训练量`;
      } else if (acwr < 0.5) {
        level = 'warning';
        message = `急慢比过低 (${acwr.toFixed(2)})，训练量可能下降过快`;
      }
    }
    
    return {
      acwr,
      acwrDistance,
      acuteWorkload: acute.totalWorkload,
      chronicAvgWorkload: chronic.avgWeeklyWorkload,
      acuteDistance: acute.totalDistance,
      chronicAvgDistance: chronic.avgWeeklyDistance,
      level,
      message,
      acute,
      chronic
    };
  }

  calculateWeeklyIncreases(weeksCount = 4) {
    const weekData = this.aggregateByWeek();
    const recentWeeks = weekData.slice(-weeksCount);
    
    const increases = [];
    
    for (let i = 1; i < recentWeeks.length; i++) {
      const prev = recentWeeks[i - 1];
      const curr = recentWeeks[i];
      
      const distanceIncrease = curr.totalDistance - prev.totalDistance;
      const distanceIncreasePercent = prev.totalDistance > 0 ? distanceIncrease / prev.totalDistance : 0;
      
      const isSignificant = distanceIncreasePercent >= config.risks.weeklyIncreaseThreshold ||
                           distanceIncrease >= config.risks.weeklyAbsoluteIncreaseThreshold;
      
      increases.push({
        weekKey: curr.key,
        weekStart: curr.startDate,
        previousWeekDistance: prev.totalDistance,
        currentWeekDistance: curr.totalDistance,
        distanceIncrease,
        distanceIncreasePercent,
        isSignificant,
        level: isSignificant ? 'warning' : 'safe'
      });
    }
    
    return increases;
  }

  aggregateByWeek() {
    const weeks = new Map();
    
    for (const run of this.runs) {
      const { year, week } = getWeekNumber(run.date);
      const key = `${year}-W${week.toString().padStart(2, '0')}`;
      
      if (!weeks.has(key)) {
        const startOfWeek = run.date.clone().startOf('isoWeek');
        weeks.set(key, {
          year,
          week,
          key,
          startDate: startOfWeek,
          totalDistance: 0,
          totalWorkload: 0,
          runCount: 0,
          longRunDistance: 0
        });
      }
      
      const weekData = weeks.get(key);
      weekData.totalDistance += run.distance;
      weekData.totalWorkload += this.calculateWorkload(run);
      weekData.runCount += 1;
      
      if (run.distance >= config.risks.longRunDistanceThreshold) {
        weekData.longRunDistance += run.distance;
      }
    }
    
    return Array.from(weeks.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.week - b.week;
    });
  }

  checkConsecutiveHighIntensityDays() {
    const daysMap = new Map();
    
    for (const run of this.runs) {
      const dayKey = formatDate(run.date);
      if (!daysMap.has(dayKey)) {
        daysMap.set(dayKey, {
          date: run.date,
          dateStr: dayKey,
          isHighIntensity: false,
          runs: [],
          maxPace: null
        });
      }
      
      const dayData = daysMap.get(dayKey);
      dayData.runs.push(run);
      
      if (run.pace && run.pace <= config.risks.highIntensityPaceThreshold) {
        dayData.isHighIntensity = true;
        if (!dayData.maxPace || run.pace < dayData.maxPace) {
          dayData.maxPace = run.pace;
        }
      }
    }
    
    const sortedDays = Array.from(daysMap.values())
      .sort((a, b) => a.date - b.date);
    
    const consecutivePeriods = [];
    let currentStreak = null;
    
    for (const day of sortedDays) {
      if (day.isHighIntensity) {
        if (!currentStreak) {
          currentStreak = {
            startDate: day.date,
            startDateStr: day.dateStr,
            days: [],
            count: 0
          };
        }
        currentStreak.days.push(day);
        currentStreak.count += 1;
        currentStreak.endDate = day.date;
        currentStreak.endDateStr = day.dateStr;
      } else {
        if (currentStreak) {
          consecutivePeriods.push({
            ...currentStreak,
            isRisk: currentStreak.count >= config.risks.maxConsecutiveHighDays
          });
          currentStreak = null;
        }
      }
    }
    
    if (currentStreak) {
      consecutivePeriods.push({
        ...currentStreak,
        isRisk: currentStreak.count >= config.risks.maxConsecutiveHighDays
      });
    }
    
    const riskyPeriods = consecutivePeriods.filter(p => p.isRisk);
    
    return {
      consecutivePeriods,
      riskyPeriods,
      hasRisk: riskyPeriods.length > 0,
      maxStreak: Math.max(0, ...consecutivePeriods.map(p => p.count))
    };
  }

  checkLongRunRatio() {
    const weekData = this.aggregateByWeek();
    const recentWeeks = weekData.slice(-4);
    
    const results = [];
    
    for (const week of recentWeeks) {
      const longRunRatio = week.totalDistance > 0 ? week.longRunDistance / week.totalDistance : 0;
      
      const isHigh = longRunRatio >= config.risks.longRunRatioThreshold;
      
      results.push({
        weekKey: week.key,
        weekStart: week.startDate,
        totalDistance: week.totalDistance,
        longRunDistance: week.longRunDistance,
        longRunRatio,
        isHigh,
        level: isHigh ? 'warning' : 'safe'
      });
    }
    
    return results;
  }

  checkMissingRestDays() {
    const last14Days = [];
    for (let i = 13; i >= 0; i--) {
      last14Days.push(this.referenceDate.clone().subtract(i, 'days'));
    }
    
    const daysWithRuns = new Set();
    for (const run of this.runs) {
      daysWithRuns.add(formatDate(run.date));
    }
    
    const consecutiveRunStreaks = [];
    let currentStreak = 0;
    let streakStart = null;
    
    for (const day of last14Days) {
      const dayStr = formatDate(day);
      if (daysWithRuns.has(dayStr)) {
        if (currentStreak === 0) {
          streakStart = day;
        }
        currentStreak++;
      } else {
        if (currentStreak >= 5) {
          consecutiveRunStreaks.push({
            startDate: streakStart,
            endDate: day.clone().subtract(1, 'days'),
            length: currentStreak,
            isRisk: currentStreak >= 6
          });
        }
        currentStreak = 0;
        streakStart = null;
      }
    }
    
    if (currentStreak >= 5) {
      consecutiveRunStreaks.push({
        startDate: streakStart,
        endDate: last14Days[last14Days.length - 1],
        length: currentStreak,
        isRisk: currentStreak >= 6
      });
    }
    
    const riskyStreaks = consecutiveRunStreaks.filter(s => s.isRisk);
    
    return {
      consecutiveRunStreaks,
      riskyStreaks,
      hasRisk: riskyStreaks.length > 0,
      daysRunInLast14: daysWithRuns.size
    };
  }

  analyzeAllRisks() {
    const acwrResult = this.calculateACWR();
    const weeklyIncreases = this.calculateWeeklyIncreases();
    const consecutiveHigh = this.checkConsecutiveHighIntensityDays();
    const longRunRatios = this.checkLongRunRatio();
    const missingRest = this.checkMissingRestDays();
    
    const risks = [];
    const warnings = [];
    
    if (acwrResult.level === 'danger') {
      risks.push({
        type: 'acwr_danger',
        category: '训练负荷',
        severity: 'high',
        message: acwrResult.message,
        details: {
          acwr: acwrResult.acwr,
          acuteWorkload: acwrResult.acuteWorkload,
          chronicAvgWorkload: acwrResult.chronicAvgWorkload
        }
      });
    } else if (acwrResult.level === 'warning') {
      warnings.push({
        type: 'acwr_warning',
        category: '训练负荷',
        severity: 'medium',
        message: acwrResult.message,
        details: {
          acwr: acwrResult.acwr
        }
      });
    }
    
    for (const inc of weeklyIncreases.filter(i => i.isSignificant)) {
      const percentText = (inc.distanceIncreasePercent * 100).toFixed(1);
      warnings.push({
        type: 'weekly_spike',
        category: '训练负荷',
        severity: 'medium',
        message: `${inc.weekKey} 周跑量突增 ${inc.distanceIncrease.toFixed(1)} km (${percentText}%)`,
        details: {
          weekKey: inc.weekKey,
          previousDistance: inc.previousWeekDistance,
          currentDistance: inc.currentWeekDistance,
          increase: inc.distanceIncrease,
          increasePercent: inc.distanceIncreasePercent
        }
      });
    }
    
    if (consecutiveHigh.hasRisk) {
      for (const period of consecutiveHigh.riskyPeriods) {
        risks.push({
          type: 'consecutive_high',
          category: '训练强度',
          severity: 'high',
          message: `${period.startDateStr} 至 ${period.endDateStr} 连续 ${period.count} 天高强度训练`,
          details: {
            startDate: period.startDateStr,
            endDate: period.endDateStr,
            count: period.count
          }
        });
      }
    }
    
    for (const lr of longRunRatios.filter(r => r.isHigh)) {
      const ratioText = (lr.longRunRatio * 100).toFixed(1);
      warnings.push({
        type: 'long_run_ratio',
        category: '训练结构',
        severity: 'medium',
        message: `${lr.weekKey} 周长距离占比过高 (${ratioText}%)`,
        details: {
          weekKey: lr.weekKey,
          totalDistance: lr.totalDistance,
          longRunDistance: lr.longRunDistance,
          ratio: lr.longRunRatio
        }
      });
    }
    
    if (missingRest.hasRisk) {
      for (const streak of missingRest.riskyStreaks) {
        warnings.push({
          type: 'missing_rest',
          category: '恢复',
          severity: 'medium',
          message: `连续 ${streak.length} 天跑步未休息，建议安排恢复日`,
          details: {
            startDate: formatDate(streak.startDate),
            endDate: formatDate(streak.endDate),
            length: streak.length
          }
        });
      }
    }
    
    const summary = {
      overallLevel: risks.length > 0 ? 'danger' : (warnings.length > 0 ? 'warning' : 'safe'),
      riskCount: risks.length,
      warningCount: warnings.length,
      totalIssues: risks.length + warnings.length
    };
    
    return {
      summary,
      risks,
      warnings,
      acwr: acwrResult,
      weeklyIncreases,
      consecutiveHigh,
      longRunRatios,
      missingRest
    };
  }
}

export function analyzeRisks(aggregator, referenceDate) {
  const analyzer = new RiskAnalyzer(
    aggregator.runs,
    aggregator.soreness,
    referenceDate
  );
  return analyzer.analyzeAllRisks();
}
