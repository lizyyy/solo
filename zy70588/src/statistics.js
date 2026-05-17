function calculateConfidenceInterval(sampleCount, sampleRate, confidenceLevel = 0.95) {
  const zScores = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576
  };
  
  const z = zScores[confidenceLevel] || 1.96;
  const estimatedTotal = sampleCount / sampleRate;
  
  const se = Math.sqrt((estimatedTotal * sampleRate * (1 - sampleRate)) / sampleCount) * (1 / sampleRate);
  const marginOfError = z * se;
  
  return {
    estimated: Math.round(estimatedTotal),
    lowerBound: Math.max(0, Math.round(estimatedTotal - marginOfError)),
    upperBound: Math.round(estimatedTotal + marginOfError),
    marginOfError: Math.round(marginOfError),
    confidenceLevel,
    standardError: se
  };
}

function calculateErrorRate(errorCount, totalCount) {
  if (totalCount === 0) return 0;
  return errorCount / totalCount;
}

function detectAnomalies(groups, sampleRate) {
  const anomalies = [];
  const groupList = Object.values(groups);
  
  if (groupList.length === 0) return anomalies;
  
  const counts = groupList.map(g => g.sampleCount);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const stdDev = Math.sqrt(counts.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / counts.length);
  
  for (const group of groupList) {
    const zScore = stdDev > 0 ? (group.sampleCount - mean) / stdDev : 0;
    const isAnomaly = Math.abs(zScore) > 2;
    
    if (isAnomaly || group.sampleCount < 5) {
      const ci = calculateConfidenceInterval(group.sampleCount, sampleRate);
      anomalies.push({
        groupKey: group.key,
        groups: group.groups,
        sampleCount: group.sampleCount,
        zScore: Math.round(zScore * 100) / 100,
        reason: group.sampleCount < 5 
          ? `样本量过小 (n=${group.sampleCount})，置信区间不可靠`
          : `异常样本量 (z-score=${Math.round(zScore * 100) / 100})`,
        confidenceInterval: ci
      });
    }
  }
  
  return anomalies;
}

function aggregateGroups(parseResults, confidenceLevel = 0.95) {
  const { groups, sampleRate, totalLines, validLines, badLines } = parseResults;
  const aggregated = [];
  
  let totalSampleErrors = 0;
  let totalSampleCount = 0;
  
  for (const [key, group] of Object.entries(groups)) {
    const ci = calculateConfidenceInterval(group.sampleCount, sampleRate, confidenceLevel);
    const errorCi = calculateConfidenceInterval(group.errorCount, sampleRate, confidenceLevel);
    const errorRate = calculateErrorRate(group.errorCount, group.sampleCount);
    
    totalSampleErrors += group.errorCount;
    totalSampleCount += group.sampleCount;
    
    aggregated.push({
      key,
      groups: group.groups,
      sampleCount: group.sampleCount,
      sampleErrorCount: group.errorCount,
      sampleErrorRate: Math.round(errorRate * 10000) / 10000,
      estimatedCount: ci.estimated,
      estimatedErrorCount: errorCi.estimated,
      estimatedErrorRate: Math.round(calculateErrorRate(errorCi.estimated, ci.estimated) * 10000) / 10000,
      confidenceInterval: ci,
      errorConfidenceInterval: errorCi
    });
  }
  
  aggregated.sort((a, b) => b.estimatedErrorCount - a.estimatedErrorCount);
  
  const totalCi = calculateConfidenceInterval(totalSampleCount, sampleRate, confidenceLevel);
  const totalErrorCi = calculateConfidenceInterval(totalSampleErrors, sampleRate, confidenceLevel);
  
  const anomalies = detectAnomalies(groups, sampleRate);
  
  return {
    summary: {
      totalLines,
      validLines,
      badLineCount: badLines.length,
      sampleRate,
      totalSampleCount,
      totalSampleErrors,
      totalEstimatedCount: totalCi.estimated,
      totalEstimatedErrors: totalErrorCi.estimated,
      overallErrorRate: Math.round(calculateErrorRate(totalSampleErrors, totalSampleCount) * 10000) / 10000,
      overallConfidenceInterval: totalErrorCi
    },
    groups: aggregated,
    anomalies,
    badLines
  };
}

function calculateGroupStats(groups) {
  if (groups.length === 0) return null;
  
  const counts = groups.map(g => g.sampleCount);
  const errorCounts = groups.map(g => g.sampleErrorCount);
  
  return {
    groupCount: groups.length,
    minSampleCount: Math.min(...counts),
    maxSampleCount: Math.max(...counts),
    avgSampleCount: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
    medianSampleCount: [...counts].sort((a, b) => a - b)[Math.floor(counts.length / 2)],
    totalErrors: errorCounts.reduce((a, b) => a + b, 0)
  };
}

module.exports = {
  calculateConfidenceInterval,
  calculateErrorRate,
  detectAnomalies,
  aggregateGroups,
  calculateGroupStats
};
