/**
 * 分析引擎模块
 * 负责计算：漏拍区、重复拍摄、缺陷等级、风速超限风险
 */

class AnalysisEngine {
  constructor(dataParser) {
    this.dataParser = dataParser;
    this.analysisResults = null;
  }

  /**
   * 执行所有分析
   */
  analyzeAll() {
    const { turbine, flightPath, defects, rules } = this.dataParser.getAllData();
    
    if (!turbine || !flightPath || !defects || !rules) {
      console.error('数据不完整，无法执行分析');
      return null;
    }

    this.analysisResults = {
      coverage: this.analyzeCoverage(turbine, flightPath, rules),
      defects: this.analyzeDefects(defects, rules, turbine),
      windSpeed: this.analyzeWindSpeed(flightPath, rules),
      summary: null
    };

    this.analysisResults.summary = this.generateSummary(this.analysisResults);
    
    console.log('分析完成:', this.analysisResults);
    return this.analysisResults;
  }

  /**
   * 分析覆盖情况：漏拍区和重复拍摄
   */
  analyzeCoverage(turbine, flightPath, rules) {
    const coverageResult = {
      blades: {},
      overall: {
        totalCoverage: 0,
        coveragePercentage: 0,
        missingSegments: [],
        overlaps: [],
        issues: []
      }
    };

    const minPhotoPerSegment = rules.inspection?.coverage?.minPhotoPerSegment || 2;
    const maxOverlap = rules.inspection?.coverage?.maxOverlap || 0.3;

    for (const blade of turbine.blades) {
      const bladeCoverage = this.analyzeBladeCoverage(blade, flightPath, minPhotoPerSegment, maxOverlap);
      coverageResult.blades[blade.bladeId] = bladeCoverage;
      
      coverageResult.overall.missingSegments.push(...bladeCoverage.missingSegments);
      coverageResult.overall.overlaps.push(...bladeCoverage.overlaps);
      coverageResult.overall.issues.push(...bladeCoverage.issues);
      coverageResult.overall.totalCoverage += bladeCoverage.coverageLength;
    }

    const totalBladeLength = turbine.blades.reduce((sum, b) => sum + b.length, 0);
    coverageResult.overall.coveragePercentage = 
      (coverageResult.overall.totalCoverage / totalBladeLength) * 100;

    return coverageResult;
  }

  /**
   * 分析单叶片的覆盖情况
   */
  analyzeBladeCoverage(blade, flightPath, minPhotoPerSegment, maxOverlap) {
    const bladeFlights = flightPath.filter(f => f.bladeId === blade.bladeId);
    
    const coverageIntervals = bladeFlights.map(f => ({
      start: f.coverageArea?.start || 0,
      end: f.coverageArea?.end || 0,
      flightId: f.flightId,
      photoCount: f.photoCount || 0,
      segmentId: f.segmentId
    }));

    const mergedCoverage = this.mergeIntervals(coverageIntervals);
    const coverageLength = mergedCoverage.reduce((sum, interval) => 
      sum + (interval.end - interval.start), 0);

    const segmentCoverage = {};
    for (const segment of blade.segments) {
      segmentCoverage[segment.segmentId] = {
        segment: segment,
        flights: [],
        coverage: 0,
        isFullyCovered: false,
        hasEnoughPhotos: false
      };
    }

    for (const flight of bladeFlights) {
      if (flight.segmentId && segmentCoverage[flight.segmentId]) {
        segmentCoverage[flight.segmentId].flights.push(flight);
      }
      
      for (const segment of blade.segments) {
        const overlapStart = Math.max(segment.start, flight.coverageArea?.start || 0);
        const overlapEnd = Math.min(segment.end, flight.coverageArea?.end || 0);
        
        if (overlapEnd > overlapStart) {
          const overlapLength = overlapEnd - overlapStart;
          segmentCoverage[segment.segmentId].coverage += overlapLength;
        }
      }
    }

    const missingSegments = [];
    for (const [segmentId, data] of Object.entries(segmentCoverage)) {
      const segmentLength = data.segment.end - data.segment.start;
      const coverageRatio = data.coverage / segmentLength;
      
      data.isFullyCovered = coverageRatio >= 0.95;
      const totalPhotos = data.flights.reduce((sum, f) => sum + (f.photoCount || 0), 0);
      data.hasEnoughPhotos = totalPhotos >= minPhotoPerSegment;
      
      if (!data.isFullyCovered || !data.hasEnoughPhotos) {
        missingSegments.push({
          bladeId: blade.bladeId,
          segmentId: segmentId,
          segmentName: data.segment.name,
          coveragePercentage: (coverageRatio * 100).toFixed(1),
          photoCount: totalPhotos,
          requiredPhotos: minPhotoPerSegment,
          issue: !data.isFullyCovered ? 'coverage' : 'photos'
        });
      }
    }

    const overlaps = this.detectOverlaps(coverageIntervals, maxOverlap, blade.bladeId);

    return {
      bladeId: blade.bladeId,
      bladeName: blade.name,
      coverageLength: coverageLength,
      coveragePercentage: (coverageLength / blade.length) * 100,
      mergedCoverage: mergedCoverage,
      segmentCoverage: segmentCoverage,
      missingSegments: missingSegments,
      overlaps: overlaps,
      issues: [
        ...missingSegments.map(m => ({
          type: 'missing_coverage',
          bladeId: blade.bladeId,
          segmentId: m.segmentId,
          description: `${m.segmentName} 覆盖不足或照片数量不够`
        })),
        ...overlaps.map(o => ({
          type: 'overlap',
          bladeId: blade.bladeId,
          description: `飞行 ${o.flightIds.join(', ')} 存在 ${(o.overlapPercentage * 100).toFixed(0)}% 重复拍摄`
        }))
      ]
    };
  }

  /**
   * 合并区间
   */
  mergeIntervals(intervals) {
    if (intervals.length === 0) return [];
    
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged = [{ start: sorted[0].start, end: sorted[0].end }];
    
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const current = sorted[i];
      
      if (current.start <= last.end) {
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push({ start: current.start, end: current.end });
      }
    }
    
    return merged;
  }

  /**
   * 检测重复拍摄
   */
  detectOverlaps(intervals, maxOverlap, bladeId) {
    const overlaps = [];
    
    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        const a = intervals[i];
        const b = intervals[j];
        
        const overlapStart = Math.max(a.start, b.start);
        const overlapEnd = Math.min(a.end, b.end);
        
        if (overlapEnd > overlapStart) {
          const overlapLength = overlapEnd - overlapStart;
          const aLength = a.end - a.start;
          const bLength = b.end - b.start;
          const minLength = Math.min(aLength, bLength);
          const overlapPercentage = overlapLength / minLength;
          
          if (overlapPercentage > maxOverlap) {
            overlaps.push({
              bladeId: bladeId,
              flightIds: [a.flightId, b.flightId],
              overlapStart: overlapStart,
              overlapEnd: overlapEnd,
              overlapLength: overlapLength,
              overlapPercentage: overlapPercentage
            });
          }
        }
      }
    }
    
    return overlaps;
  }

  /**
   * 分析缺陷数据
   */
  analyzeDefects(defects, rules, turbine) {
    const defectRules = rules.defect?.severity || {};
    
    const analyzedDefects = defects.map(defect => {
      const analysis = this.analyzeSingleDefect(defect, defectRules, turbine);
      return { ...defect, analysis };
    });

    const bySeverity = {
      high: analyzedDefects.filter(d => d.analysis.effectiveSeverity === 'high'),
      medium: analyzedDefects.filter(d => d.analysis.effectiveSeverity === 'medium'),
      low: analyzedDefects.filter(d => d.analysis.effectiveSeverity === 'low')
    };

    const byBlade = {};
    for (const defect of analyzedDefects) {
      if (!byBlade[defect.bladeId]) {
        byBlade[defect.bladeId] = [];
      }
      byBlade[defect.bladeId].push(defect);
    }

    const boundaryDefects = analyzedDefects.filter(d => d.analysis.isNearBoundary);

    return {
      defects: analyzedDefects,
      bySeverity: bySeverity,
      byBlade: byBlade,
      boundaryDefects: boundaryDefects,
      stats: {
        total: analyzedDefects.length,
        high: bySeverity.high.length,
        medium: bySeverity.medium.length,
        low: bySeverity.low.length,
        boundaryIssues: boundaryDefects.length
      }
    };
  }

  /**
   * 分析单个缺陷
   * 处理缺陷落在边界段的问题
   */
  analyzeSingleDefect(defect, defectRules, turbine) {
    const analysis = {
      effectiveSeverity: defect.severity,
      isNearBoundary: false,
      boundaryInfo: null,
      severityReason: '原始等级',
      recommendedAction: ''
    };

    const blade = turbine.blades.find(b => b.bladeId === defect.bladeId);
    if (blade) {
      const distance = defect.distanceFromRoot;
      const epsilon = 0.5;
      
      for (const segment of blade.segments) {
        if (Math.abs(distance - segment.start) < epsilon || 
            Math.abs(distance - segment.end) < epsilon) {
          analysis.isNearBoundary = true;
          analysis.boundaryInfo = {
            segmentId: segment.segmentId,
            segmentName: segment.name,
            boundaryType: Math.abs(distance - segment.start) < epsilon ? 'start' : 'end',
            distanceToBoundary: Math.min(
              Math.abs(distance - segment.start),
              Math.abs(distance - segment.end)
            )
          };
          break;
        }
      }
    }

    const size = defect.size || 0;
    const type = defect.type;
    
    const getTypesArray = (rule) => {
      if (!rule?.types) return [];
      if (Array.isArray(rule.types)) return rule.types;
      if (typeof rule.types === 'object') {
        return Object.values(rule.types);
      }
      return [rule.types];
    };

    const highTypes = getTypesArray(defectRules.high);
    const mediumTypes = getTypesArray(defectRules.medium);
    const lowTypes = getTypesArray(defectRules.low);

    const defaultHighTypes = ['crack', 'delamination', 'erosion'];
    const defaultMediumTypes = ['pitting', 'bonding_issue'];
    const defaultLowTypes = ['scratch'];

    const finalHighTypes = highTypes.length > 0 ? highTypes : defaultHighTypes;
    const finalMediumTypes = mediumTypes.length > 0 ? mediumTypes : defaultMediumTypes;
    const finalLowTypes = lowTypes.length > 0 ? lowTypes : defaultLowTypes;
    
    if (finalHighTypes.includes(type) && size >= (defectRules.high?.threshold || 20.0)) {
      analysis.effectiveSeverity = 'high';
      analysis.recommendedAction = defectRules.high?.action || '立即处理';
      if (defect.severity !== 'high') {
        analysis.severityReason = '根据规则升级：类型和尺寸达到高危标准';
      }
    } else if (finalMediumTypes.includes(type) && size >= (defectRules.medium?.threshold || 10.0)) {
      if (analysis.effectiveSeverity !== 'high') {
        analysis.effectiveSeverity = 'medium';
        analysis.recommendedAction = defectRules.medium?.action || '计划处理';
        if (defect.severity !== 'medium') {
          analysis.severityReason = '根据规则升级：类型和尺寸达到中危标准';
        }
      }
    } else if (finalLowTypes.includes(type)) {
      if (analysis.effectiveSeverity !== 'high' && analysis.effectiveSeverity !== 'medium') {
        analysis.effectiveSeverity = 'low';
        analysis.recommendedAction = defectRules.low?.action || '持续监测';
      }
    }

    return analysis;
  }

  /**
   * 分析风速超限风险
   */
  analyzeWindSpeed(flightPath, rules) {
    const maxAllowable = rules.inspection?.windSpeed?.maxAllowable || 6.0;
    const warningThreshold = rules.inspection?.windSpeed?.warningThreshold || 5.0;

    const windAnalysis = {
      flights: [],
      exceeded: [],
      warning: [],
      stats: {
        total: flightPath.length,
        maxWindSpeed: 0,
        avgWindSpeed: 0,
        exceededCount: 0,
        warningCount: 0
      }
    };

    let totalWindSpeed = 0;
    let maxWindSpeed = 0;

    for (const flight of flightPath) {
      const windSpeed = flight.windSpeed || 0;
      totalWindSpeed += windSpeed;
      maxWindSpeed = Math.max(maxWindSpeed, windSpeed);

      const flightAnalysis = {
        flightId: flight.flightId,
        bladeId: flight.bladeId,
        segmentId: flight.segmentId,
        windSpeed: windSpeed,
        timestamp: flight.timestamp,
        status: 'normal'
      };

      if (windSpeed > maxAllowable) {
        flightAnalysis.status = 'exceeded';
        flightAnalysis.riskLevel = 'high';
        flightAnalysis.warning = `风速 ${windSpeed} m/s 超过限值 ${maxAllowable} m/s`;
        windAnalysis.exceeded.push(flightAnalysis);
      } else if (windSpeed > warningThreshold) {
        flightAnalysis.status = 'warning';
        flightAnalysis.riskLevel = 'medium';
        flightAnalysis.warning = `风速 ${windSpeed} m/s 接近限值 ${maxAllowable} m/s`;
        windAnalysis.warning.push(flightAnalysis);
      }

      windAnalysis.flights.push(flightAnalysis);
    }

    windAnalysis.stats = {
      total: flightPath.length,
      maxWindSpeed: maxWindSpeed,
      avgWindSpeed: totalWindSpeed / flightPath.length,
      exceededCount: windAnalysis.exceeded.length,
      warningCount: windAnalysis.warning.length
    };

    return windAnalysis;
  }

  /**
   * 生成综合摘要
   */
  generateSummary(analysis) {
    const { coverage, defects, windSpeed } = analysis;

    const issues = [];
    
    if (coverage.overall.missingSegments.length > 0) {
      issues.push({
        type: 'coverage',
        severity: 'high',
        description: `发现 ${coverage.overall.missingSegments.length} 个覆盖不足的段`,
        details: coverage.overall.missingSegments
      });
    }

    if (coverage.overall.overlaps.length > 0) {
      issues.push({
        type: 'overlap',
        severity: 'medium',
        description: `发现 ${coverage.overall.overlaps.length} 处重复拍摄`,
        details: coverage.overall.overlaps
      });
    }

    if (defects.stats.high > 0) {
      issues.push({
        type: 'defect',
        severity: 'high',
        description: `发现 ${defects.stats.high} 个高危缺陷`,
        details: defects.bySeverity.high
      });
    }

    if (defects.stats.medium > 0) {
      issues.push({
        type: 'defect',
        severity: 'medium',
        description: `发现 ${defects.stats.medium} 个中危缺陷`,
        details: defects.bySeverity.medium
      });
    }

    if (defects.stats.boundaryIssues > 0) {
      issues.push({
        type: 'boundary',
        severity: 'medium',
        description: `发现 ${defects.stats.boundaryIssues} 个位于段边界的缺陷需要确认`,
        details: defects.boundaryDefects
      });
    }

    if (windSpeed.stats.exceededCount > 0) {
      issues.push({
        type: 'wind',
        severity: 'high',
        description: `发现 ${windSpeed.stats.exceededCount} 次飞行风速超限`,
        details: windSpeed.exceeded
      });
    }

    if (windSpeed.stats.warningCount > 0) {
      issues.push({
        type: 'wind',
        severity: 'medium',
        description: `发现 ${windSpeed.stats.warningCount} 次飞行风速预警`,
        details: windSpeed.warning
      });
    }

    return {
      overallStatus: issues.some(i => i.severity === 'high') ? 'warning' : 'ok',
      overallScore: this.calculateScore(coverage, defects, windSpeed),
      issues: issues.sort((a, b) => {
        const priority = { high: 0, medium: 1, low: 2 };
        return priority[a.severity] - priority[b.severity];
      }),
      keyMetrics: {
        coveragePercentage: coverage.overall.coveragePercentage.toFixed(1),
        highDefects: defects.stats.high,
        totalDefects: defects.stats.total,
        windExceeded: windSpeed.stats.exceededCount,
        maxWindSpeed: windSpeed.stats.maxWindSpeed.toFixed(1)
      }
    };
  }

  /**
   * 计算综合评分
   */
  calculateScore(coverage, defects, windSpeed) {
    let score = 100;
    
    score -= coverage.overall.missingSegments.length * 5;
    score -= coverage.overall.overlaps.length * 2;
    score -= defects.stats.high * 10;
    score -= defects.stats.medium * 5;
    score -= windSpeed.stats.exceededCount * 8;
    score -= windSpeed.stats.warningCount * 3;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 获取分析结果
   */
  getAnalysisResults() {
    return this.analysisResults;
  }
}

export default AnalysisEngine;
