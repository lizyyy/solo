class MatrixAnalyzer {
  constructor(args) {
    this.args = args;
    this.matrixKeys = args.matrixKeys;
    this.rerunThreshold = args.rerunThreshold;
  }

  analyze(parsedLogs) {
    const matrixGroups = this.groupByMatrix(parsedLogs);
    const analyzedGroups = [];

    for (const [key, group] of Object.entries(matrixGroups)) {
      const analyzed = this.analyzeGroup(key, group);
      analyzedGroups.push(analyzed);
    }

    analyzedGroups.sort((a, b) => b.flakeScore - a.flakeScore);

    return {
      summary: this.generateSummary(analyzedGroups, parsedLogs),
      groups: analyzedGroups,
      allLogs: parsedLogs
    };
  }

  groupByMatrix(parsedLogs) {
    const groups = {};

    for (const log of parsedLogs) {
      const key = this.getMatrixKey(log.matrix);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(log);
    }

    return groups;
  }

  getMatrixKey(matrix) {
    return this.matrixKeys
      .map(key => matrix[key] || 'unknown')
      .join('|');
  }

  analyzeGroup(key, group) {
    const totalRuns = group.length;
    const failedRuns = group.filter(g => g.status === 'failed').length;
    const successRuns = group.filter(g => g.status === 'success').length;
    const failureRate = totalRuns > 0 ? failedRuns / totalRuns : 0;

    const totalReruns = group.reduce((sum, g) => sum + g.rerunCount, 0);
    const avgReruns = totalRuns > 0 ? totalReruns / totalRuns : 0;

    const highRerunCount = group.filter(g => g.rerunCount >= this.rerunThreshold).length;

    const allSnippets = [];
    for (const log of group) {
      for (const snippet of log.failureSnippets) {
        allSnippets.push({
          ...snippet,
          logFile: log.fileName,
          matrix: log.matrix
        });
      }
    }

    const flakeScore = this.calculateFlakeScore({
      failureRate,
      avgReruns,
      highRerunCount,
      totalRuns
    });

    const matrix = {};
    const keyParts = key.split('|');
    for (let i = 0; i < this.matrixKeys.length; i++) {
      matrix[this.matrixKeys[i]] = keyParts[i];
    }

    return {
      key,
      matrix,
      totalRuns,
      failedRuns,
      successRuns,
      failureRate,
      totalReruns,
      avgReruns,
      highRerunCount,
      flakeScore,
      flakeLevel: this.getFlakeLevel(flakeScore),
      failureSnippets: allSnippets.slice(0, 20),
      logs: group
    };
  }

  calculateFlakeScore(stats) {
    let score = 0;

    score += stats.failureRate * 50;

    score += Math.min(stats.avgReruns * 20, 30);

    if (stats.totalRuns >= 3) {
      const highRerunRatio = stats.highRerunCount / stats.totalRuns;
      score += highRerunRatio * 20;
    }

    return Math.min(100, score);
  }

  getFlakeLevel(score) {
    if (score >= 70) return 'CRITICAL';
    if (score >= 40) return 'HIGH';
    if (score >= 20) return 'MEDIUM';
    return 'LOW';
  }

  generateSummary(groups, allLogs) {
    const totalLogs = allLogs.length;
    const totalFailed = allLogs.filter(l => l.status === 'failed').length;
    const totalSuccess = allLogs.filter(l => l.status === 'success').length;

    const criticalGroups = groups.filter(g => g.flakeLevel === 'CRITICAL').length;
    const highGroups = groups.filter(g => g.flakeLevel === 'HIGH').length;

    const mostUnstable = groups[0] || null;

    const totalReruns = allLogs.reduce((sum, l) => sum + l.rerunCount, 0);

    return {
      totalLogs,
      totalFailed,
      totalSuccess,
      totalReruns,
      totalMatrixGroups: groups.length,
      criticalGroups,
      highGroups,
      overallFailureRate: totalLogs > 0 ? totalFailed / totalLogs : 0,
      mostUnstable: mostUnstable ? {
        matrix: mostUnstable.matrix,
        flakeScore: mostUnstable.flakeScore,
        flakeLevel: mostUnstable.flakeLevel
      } : null
    };
  }

  compareReruns(group) {
    const successAfterRerun = [];
    const stillFailing = [];

    const rerunLogs = group.filter(l => l.rerunCount > 0);
    for (const log of rerunLogs) {
      if (log.status === 'success') {
        successAfterRerun.push(log);
      } else {
        stillFailing.push(log);
      }
    }

    return {
      successAfterRerun,
      stillFailing,
      recoveryRate: rerunLogs.length > 0 ? successAfterRerun.length / rerunLogs.length : 0
    };
  }
}

module.exports = { MatrixAnalyzer };
