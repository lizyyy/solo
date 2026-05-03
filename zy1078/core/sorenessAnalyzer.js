import moment from 'moment';
import config from '../config/index.js';
import { formatDate, daysBetween } from '../utils/date.js';
import { getSurfaceName, getTrainingTypeName } from '../utils/normalization.js';

export class SorenessAnalyzer {
  constructor(soreness = [], runs = [], referenceDate = moment()) {
    this.soreness = soreness;
    this.runs = runs;
    this.referenceDate = moment(referenceDate);
    this.windowDays = config.soreness.correlationWindowDays;
  }

  getLocationStats() {
    const locationCounts = new Map();
    const locationSeverities = new Map();
    
    for (const pain of this.soreness) {
      const loc = pain.location || 'unknown';
      locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
      
      if (!locationSeverities.has(loc)) {
        locationSeverities.set(loc, []);
      }
      locationSeverities.get(loc).push(pain.severity);
    }
    
    return Array.from(locationCounts.entries()).map(([location, count]) => {
      const severities = locationSeverities.get(location) || [];
      return {
        location,
        count,
        avgSeverity: severities.length > 0 ? severities.reduce((a, b) => a + b, 0) / severities.length : 0,
        maxSeverity: Math.max(0, ...severities),
        minSeverity: Math.min(10, ...severities)
      };
    }).sort((a, b) => b.count - a.count);
  }

  findRunsBeforePain(painDate) {
    const windowStart = painDate.clone().subtract(this.windowDays, 'days');
    
    return this.runs.filter(r => 
      r.date.isAfter(windowStart) && r.date.isSameOrBefore(painDate)
    ).sort((a, b) => b.date - a.date);
  }

  analyzeCorrelations() {
    const correlations = [];
    
    for (const pain of this.soreness) {
      const precedingRuns = this.findRunsBeforePain(pain.date);
      
      if (precedingRuns.length > 0) {
        const shoeCounts = new Map();
        const surfaceCounts = new Map();
        const trainingTypeCounts = new Map();
        const totalDistance = precedingRuns.reduce((sum, r) => sum + r.distance, 0);
        const totalElevation = precedingRuns.reduce((sum, r) => sum + r.elevation, 0);
        
        for (const run of precedingRuns) {
          if (run.shoe && run.shoe !== 'unknown') {
            shoeCounts.set(run.shoe, (shoeCounts.get(run.shoe) || 0) + 1);
          }
          if (run.surface && run.surface !== 'unknown') {
            surfaceCounts.set(run.surface, (surfaceCounts.get(run.surface) || 0) + 1);
          }
          if (run.trainingType && run.trainingType !== 'unknown') {
            trainingTypeCounts.set(run.trainingType, (trainingTypeCounts.get(run.trainingType) || 0) + 1);
          }
        }
        
        correlations.push({
          painDate: pain.date,
          painDateStr: formatDate(pain.date),
          location: pain.location,
          side: pain.side,
          severity: pain.severity,
          description: pain.description,
          precedingRuns: precedingRuns.length,
          totalDistanceBeforePain: totalDistance,
          totalElevationBeforePain: totalElevation,
          shoesUsed: Array.from(shoeCounts.entries()),
          surfacesUsed: Array.from(surfaceCounts.entries()),
          trainingTypes: Array.from(trainingTypeCounts.entries()),
          runs: precedingRuns
        });
      }
    }
    
    return correlations;
  }

  findPatterns() {
    const correlations = this.analyzeCorrelations();
    
    if (correlations.length < config.soreness.minCorrelationSamples) {
      return {
        hasPatterns: false,
        message: `疼痛样本不足 (${correlations.length} 个)，需要至少 ${config.soreness.minCorrelationSamples} 个才能分析模式`
      };
    }
    
    const shoeAssociations = new Map();
    const surfaceAssociations = new Map();
    const trainingTypeAssociations = new Map();
    const locationShoeAssociations = new Map();
    
    for (const corr of correlations) {
      const painKey = `${corr.location}::${corr.side}`;
      
      for (const [shoe, count] of corr.shoesUsed) {
        if (!shoeAssociations.has(shoe)) {
          shoeAssociations.set(shoe, {
            shoe,
            painCount: 0,
            totalPrecedingRuns: 0,
            painLocations: new Set()
          });
        }
        shoeAssociations.get(shoe).painCount += 1;
        shoeAssociations.get(shoe).totalPrecedingRuns += count;
        shoeAssociations.get(shoe).painLocations.add(corr.location);
        
        const locKey = `${painKey}::${shoe}`;
        locationShoeAssociations.set(locKey, (locationShoeAssociations.get(locKey) || 0) + 1);
      }
      
      for (const [surface, count] of corr.surfacesUsed) {
        if (!surfaceAssociations.has(surface)) {
          surfaceAssociations.set(surface, {
            surface,
            surfaceName: getSurfaceName(surface),
            painCount: 0,
            totalPrecedingRuns: 0
          });
        }
        surfaceAssociations.get(surface).painCount += 1;
        surfaceAssociations.get(surface).totalPrecedingRuns += count;
      }
      
      for (const [type, count] of corr.trainingTypes) {
        if (!trainingTypeAssociations.has(type)) {
          trainingTypeAssociations.set(type, {
            type,
            typeName: getTrainingTypeName(type),
            painCount: 0,
            totalPrecedingRuns: 0
          });
        }
        trainingTypeAssociations.get(type).painCount += 1;
        trainingTypeAssociations.get(type).totalPrecedingRuns += count;
      }
    }
    
    const totalRunsByShoe = new Map();
    for (const run of this.runs) {
      if (run.shoe && run.shoe !== 'unknown') {
        totalRunsByShoe.set(run.shoe, (totalRunsByShoe.get(run.shoe) || 0) + 1);
      }
    }
    
    const highRiskShoes = [];
    for (const [shoe, data] of shoeAssociations) {
      const totalRuns = totalRunsByShoe.get(shoe) || 1;
      const painRatio = data.painCount / totalRuns;
      
      if (painRatio > 0.3 && data.painCount >= 2) {
        highRiskShoes.push({
          shoe,
          painCount: data.painCount,
          totalRuns,
          painRatio,
          painLocations: Array.from(data.painLocations),
          risk: 'high',
          message: `${shoe} 在 ${data.painCount} 次穿着后出现疼痛，占比 ${(painRatio * 100).toFixed(0)}%，关联部位: ${Array.from(data.painLocations).join(', ')}`
        });
      }
    }
    
    const highRiskSurfaces = [];
    for (const [surface, data] of surfaceAssociations) {
      if (data.painCount >= 2) {
        highRiskSurfaces.push({
          surface,
          surfaceName: data.surfaceName,
          painCount: data.painCount,
          message: `${data.surfaceName} 路面后出现 ${data.painCount} 次疼痛记录`
        });
      }
    }
    
    const highRiskTypes = [];
    for (const [type, data] of trainingTypeAssociations) {
      if (data.painCount >= 2) {
        highRiskTypes.push({
          type,
          typeName: data.typeName,
          painCount: data.painCount,
          message: `${data.typeName} 训练后出现 ${data.painCount} 次疼痛记录`
        });
      }
    }
    
    return {
      hasPatterns: highRiskShoes.length > 0 || highRiskSurfaces.length > 0 || highRiskTypes.length > 0,
      highRiskShoes,
      highRiskSurfaces,
      highRiskTypes,
      correlations,
      totalCorrelations: correlations.length
    };
  }

  getRecentSoreness(days = 14) {
    const cutoff = this.referenceDate.clone().subtract(days, 'days');
    return this.soreness
      .filter(s => s.date.isSameOrAfter(cutoff))
      .sort((a, b) => b.date - a.date);
  }

  analyzeAll() {
    const locationStats = this.getLocationStats();
    const patterns = this.findPatterns();
    const recentSoreness = this.getRecentSoreness();
    
    const summary = {
      totalSorenessRecords: this.soreness.length,
      uniqueLocations: locationStats.length,
      recentRecords: recentSoreness.length,
      hasHighRiskPatterns: patterns.hasPatterns
    };
    
    return {
      summary,
      locationStats,
      patterns,
      recentSoreness,
      correlations: patterns.correlations
    };
  }
}

export function analyzeSoreness(aggregator, referenceDate) {
  const analyzer = new SorenessAnalyzer(
    aggregator.soreness,
    aggregator.runs,
    referenceDate
  );
  return analyzer.analyzeAll();
}
