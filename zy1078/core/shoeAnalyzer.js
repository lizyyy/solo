import moment from 'moment';
import config from '../config/index.js';
import { formatDate, daysBetween } from '../utils/date.js';
import { getSurfaceName, getTrainingTypeName } from '../utils/normalization.js';

export class ShoeAnalyzer {
  constructor(shoes = [], runs = [], soreness = [], referenceDate = moment()) {
    this.shoes = shoes;
    this.runs = runs;
    this.soreness = soreness;
    this.referenceDate = moment(referenceDate);
  }

  analyzeShoeStats() {
    const shoeStats = new Map();
    
    for (const shoe of this.shoes) {
      const key = shoe.name.toLowerCase();
      shoeStats.set(key, {
        ...shoe,
        totalDistance: shoe.initialMileage || 0,
        runCount: 0,
        lastRun: null,
        firstRun: null,
        runs: [],
        surfaces: {},
        trainingTypes: {},
        weeklyUsage: {}
      });
    }
    
    for (const run of this.runs) {
      if (!run.shoe || run.shoe === 'unknown') continue;
      
      const key = run.shoe.toLowerCase();
      let stats = shoeStats.get(key);
      
      if (!stats) {
        stats = {
          name: run.shoe,
          brand: '',
          model: '',
          purchaseDate: null,
          initialMileage: 0,
          totalDistance: 0,
          runCount: 0,
          lastRun: null,
          firstRun: null,
          runs: [],
          surfaces: {},
          trainingTypes: {},
          weeklyUsage: {},
          retired: false,
          isUnknown: true
        };
        shoeStats.set(key, stats);
      }
      
      stats.totalDistance += run.distance;
      stats.runCount += 1;
      stats.runs.push(run);
      
      if (!stats.firstRun || run.date.isBefore(stats.firstRun)) {
        stats.firstRun = run.date;
      }
      if (!stats.lastRun || run.date.isAfter(stats.lastRun)) {
        stats.lastRun = run.date;
      }
      
      stats.surfaces[run.surface] = (stats.surfaces[run.surface] || 0) + run.distance;
      stats.trainingTypes[run.trainingType] = (stats.trainingTypes[run.trainingType] || 0) + run.distance;
      
      const weekKey = run.date.format('YYYY-WW');
      if (!stats.weeklyUsage[weekKey]) {
        stats.weeklyUsage[weekKey] = {
          week: weekKey,
          distance: 0,
          runCount: 0
        };
      }
      stats.weeklyUsage[weekKey].distance += run.distance;
      stats.weeklyUsage[weekKey].runCount += 1;
    }
    
    return Array.from(shoeStats.values()).map(s => this.assessShoeStatus(s));
  }

  assessShoeStatus(shoe) {
    const warnings = [];
    const alerts = [];
    const suggestions = [];
    
    const totalDistance = shoe.totalDistance || 0;
    const maxMileage = config.shoes.maxMileage;
    const warningMileage = config.shoes.warningMileage;
    
    let mileageStatus = 'good';
    let mileageMessage = '里程正常';
    
    if (totalDistance >= maxMileage) {
      mileageStatus = 'danger';
      mileageMessage = `已达到建议退役里程 ${maxMileage} km`;
      alerts.push({
        type: 'retirement',
        category: '里程',
        severity: 'high',
        message: `这双鞋已累计 ${totalDistance.toFixed(1)} km，达到建议退役里程 ${maxMileage} km，建议更换`,
        details: {
          currentMileage: totalDistance,
          maxMileage: maxMileage
        }
      });
    } else if (totalDistance >= warningMileage) {
      mileageStatus = 'warning';
      mileageMessage = `接近建议退役里程 ${maxMileage} km`;
      warnings.push({
        type: 'high_mileage',
        category: '里程',
        severity: 'medium',
        message: `累计里程 ${totalDistance.toFixed(1)} km，接近建议退役里程，建议减少使用或准备更换`,
        details: {
          currentMileage: totalDistance,
          maxMileage: maxMileage,
          remaining: maxMileage - totalDistance
        }
      });
    }
    
    let usageStatus = 'good';
    let usageMessage = '使用频率正常';
    
    if (shoe.lastRun) {
      const daysSinceLastWorn = daysBetween(this.referenceDate, shoe.lastRun);
      
      if (daysSinceLastWorn >= config.shoes.maxDaysSinceWorn) {
        usageStatus = 'warning';
        usageMessage = `已 ${daysSinceLastWorn} 天未使用`;
        warnings.push({
          type: 'unused',
          category: '轮换',
          severity: 'low',
          message: `已 ${daysSinceLastWorn} 天未穿这双鞋，建议轮换使用以保持鞋型`,
          details: {
            daysSinceLastWorn,
            lastRunDate: formatDate(shoe.lastRun)
          }
        });
      }
      
      const recentWeeks = Object.values(shoe.weeklyUsage).slice(-4);
      const totalRecentDistance = recentWeeks.reduce((sum, w) => sum + w.distance, 0);
      const avgWeeklyDistance = recentWeeks.length > 0 ? totalRecentDistance / recentWeeks.length : 0;
      
      if (avgWeeklyDistance > 30 && totalDistance < warningMileage) {
        suggestions.push({
          type: 'rotation_suggestion',
          category: '轮换',
          message: `最近每周平均使用 ${avgWeeklyDistance.toFixed(1)} km，建议增加鞋款轮换以延长寿命`,
          details: {
            avgWeeklyDistance
          }
        });
      }
    }
    
    let overallStatus = 'good';
    if (alerts.length > 0) {
      overallStatus = 'danger';
    } else if (warnings.length > 0) {
      overallStatus = 'warning';
    }
    
    return {
      ...shoe,
      mileageStatus,
      mileageMessage,
      usageStatus,
      usageMessage,
      overallStatus,
      alerts,
      warnings,
      suggestions,
      daysSinceLastWorn: shoe.lastRun ? daysBetween(this.referenceDate, shoe.lastRun) : null,
      lastRunStr: shoe.lastRun ? formatDate(shoe.lastRun) : null,
      firstRunStr: shoe.firstRun ? formatDate(shoe.firstRun) : null,
      remainingMileage: maxMileage - totalDistance
    };
  }

  getRotationSuggestions(shoeStats) {
    const activeShoes = shoeStats.filter(s => !s.retired && s.runCount > 0);
    
    if (activeShoes.length === 0) {
      return {
        hasSuggestions: false,
        message: '没有活跃的跑鞋数据'
      };
    }
    
    const suggestions = [];
    const warnings = [];
    
    if (activeShoes.length === 1) {
      warnings.push({
        type: 'single_shoe',
        message: '当前只有一双活跃跑鞋，建议增加鞋款轮换以降低受伤风险和延长鞋的寿命'
      });
    }
    
    const usageByShoe = activeShoes.map(s => ({
      name: s.name,
      totalDistance: s.totalDistance,
      recentDistance: Object.values(s.weeklyUsage).slice(-2).reduce((sum, w) => sum + w.distance, 0),
      daysSinceLastWorn: s.daysSinceLastWorn
    }));
    
    const totalRecentDistance = usageByShoe.reduce((sum, s) => sum + s.recentDistance, 0);
    if (totalRecentDistance > 0) {
      for (const shoe of usageByShoe) {
        const ratio = shoe.recentDistance / totalRecentDistance;
        if (ratio > 0.7) {
          warnings.push({
            type: 'overused_shoe',
            shoe: shoe.name,
            message: `${shoe.name} 承担了最近 ${(ratio * 100).toFixed(0)}% 的跑量，建议增加其他鞋款的轮换`
          });
        }
      }
    }
    
    const sortedByMileage = [...activeShoes].sort((a, b) => b.totalDistance - a.totalDistance);
    
    if (sortedByMileage.length >= 2) {
      const highMileageShoes = sortedByMileage.filter(s => s.totalDistance >= config.shoes.warningMileage * 0.8);
      const lowMileageShoes = sortedByMileage.filter(s => s.totalDistance < config.shoes.warningMileage * 0.5);
      
      if (highMileageShoes.length > 0 && lowMileageShoes.length > 0) {
        suggestions.push({
          type: 'rotation_plan',
          message: `建议近期优先使用低里程鞋款: ${lowMileageShoes.map(s => s.name).join(', ')}，让高里程鞋款 ${highMileageShoes.map(s => s.name).join(', ')} 适当休息或准备退役`
        });
      }
    }
    
    return {
      hasSuggestions: suggestions.length > 0 || warnings.length > 0,
      suggestions,
      warnings,
      activeShoeCount: activeShoes.length,
      totalShoes: shoeStats.length
    };
  }

  analyzeAll() {
    const shoeStats = this.analyzeShoeStats();
    const rotationSuggestions = this.getRotationSuggestions(shoeStats);
    
    const alerts = [];
    const warnings = [];
    const suggestions = [];
    
    for (const shoe of shoeStats) {
      alerts.push(...shoe.alerts.map(a => ({ ...a, shoe: shoe.name })));
      warnings.push(...shoe.warnings.map(w => ({ ...w, shoe: shoe.name })));
      suggestions.push(...shoe.suggestions.map(s => ({ ...s, shoe: shoe.name })));
    }
    
    const stats = {
      totalShoes: shoeStats.length,
      activeShoes: shoeStats.filter(s => !s.retired).length,
      retiredShoes: shoeStats.filter(s => s.retired).length,
      shoesNeedingAttention: shoeStats.filter(s => s.overallStatus !== 'good').length,
      totalMileage: shoeStats.reduce((sum, s) => sum + (s.totalDistance || 0), 0)
    };
    
    return {
      stats,
      shoeStats,
      rotationSuggestions,
      alerts,
      warnings,
      suggestions
    };
  }
}

export function analyzeShoes(aggregator, referenceDate) {
  const analyzer = new ShoeAnalyzer(
    aggregator.shoes,
    aggregator.runs,
    aggregator.soreness,
    referenceDate
  );
  return analyzer.analyzeAll();
}
