const { processSQL } = require('./fingerprint');

const TIME_BUCKETS = [
  { threshold: 0.1, label: '< 0.1s' },
  { threshold: 0.5, label: '0.1s - 0.5s' },
  { threshold: 1, label: '0.5s - 1s' },
  { threshold: 2, label: '1s - 2s' },
  { threshold: 5, label: '2s - 5s' },
  { threshold: 10, label: '5s - 10s' },
  { threshold: Infinity, label: '> 10s' }
];

function getTimeBucket(queryTime) {
  for (const bucket of TIME_BUCKETS) {
    if (queryTime < bucket.threshold) {
      return bucket.label;
    }
  }
  return TIME_BUCKETS[TIME_BUCKETS.length - 1].label;
}

function calculateStats(numbers) {
  if (numbers.length === 0) {
    return {
      count: 0,
      sum: 0,
      avg: 0,
      min: 0,
      max: 0,
      p50: 0,
      p95: 0,
      p99: 0
    };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((a, b) => a + b, 0);

  const getPercentile = (p) => {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  };

  return {
    count: numbers.length,
    sum: parseFloat(sum.toFixed(4)),
    avg: parseFloat((sum / numbers.length).toFixed(4)),
    min: parseFloat(sorted[0].toFixed(4)),
    max: parseFloat(sorted[sorted.length - 1].toFixed(4)),
    p50: parseFloat(getPercentile(50).toFixed(4)),
    p95: parseFloat(getPercentile(95).toFixed(4)),
    p99: parseFloat(getPercentile(99).toFixed(4))
  };
}

class QueryAnalyzer {
  constructor(options = {}) {
    this.options = {
      topN: options.topN || 10,
      sortBy: options.sortBy || 'totalTime',
      ...options
    };
    this.reset();
  }

  reset() {
    this.fingerprintGroups = new Map();
    this.tableStats = new Map();
    this.typeStats = new Map();
    this.timeBucketStats = new Map();
    this.allQueryTimes = [];
    this.allEntries = [];
  }

  addEntry(entry) {
    const sqlInfo = processSQL(entry.sql);
    const fingerprint = sqlInfo.fingerprint;

    this.allEntries.push({
      ...entry,
      fingerprint,
      normalizedSQL: sqlInfo.normalized,
      tables: sqlInfo.tables,
      queryType: sqlInfo.queryType
    });

    this.allQueryTimes.push(entry.queryTime);

    if (!this.fingerprintGroups.has(fingerprint)) {
      this.fingerprintGroups.set(fingerprint, {
        fingerprint,
        normalizedSQL: sqlInfo.normalized,
        tables: sqlInfo.tables,
        queryType: sqlInfo.queryType,
        samples: [],
        queryTimes: [],
        lockTimes: [],
        rowsSents: [],
        rowsExamineds: []
      });
    }

    const group = this.fingerprintGroups.get(fingerprint);
    group.samples.push(entry);
    group.queryTimes.push(entry.queryTime);
    if (entry.lockTime !== undefined) group.lockTimes.push(entry.lockTime);
    if (entry.rowsSent !== undefined) group.rowsSents.push(entry.rowsSent);
    if (entry.rowsExamined !== undefined) group.rowsExamineds.push(entry.rowsExamined);

    const timeBucket = getTimeBucket(entry.queryTime);
    if (!this.timeBucketStats.has(timeBucket)) {
      this.timeBucketStats.set(timeBucket, { count: 0, totalTime: 0 });
    }
    const bucketStat = this.timeBucketStats.get(timeBucket);
    bucketStat.count++;
    bucketStat.totalTime += entry.queryTime;

    for (const table of sqlInfo.tables) {
      if (!this.tableStats.has(table)) {
        this.tableStats.set(table, {
          table,
          count: 0,
          totalTime: 0,
          queryTimes: [],
          fingerprints: new Set()
        });
      }
      const tableStat = this.tableStats.get(table);
      tableStat.count++;
      tableStat.totalTime += entry.queryTime;
      tableStat.queryTimes.push(entry.queryTime);
      tableStat.fingerprints.add(fingerprint);
    }

    const queryType = sqlInfo.queryType;
    if (!this.typeStats.has(queryType)) {
      this.typeStats.set(queryType, { count: 0, totalTime: 0 });
    }
    const typeStat = this.typeStats.get(queryType);
    typeStat.count++;
    typeStat.totalTime += entry.queryTime;
  }

  analyze(entries = []) {
    this.reset();

    for (const entry of entries) {
      this.addEntry(entry);
    }

    return this.getReport();
  }

  getReport() {
    const fingerprintGroups = [];
    for (const [fingerprint, group] of this.fingerprintGroups) {
      const timeStats = calculateStats(group.queryTimes);
      const lockStats = calculateStats(group.lockTimes);
      const rowsSentStats = calculateStats(group.rowsSents);
      const rowsExaminedStats = calculateStats(group.rowsExamineds);

      const sortedSamples = [...group.samples].sort((a, b) => b.queryTime - a.queryTime);

      fingerprintGroups.push({
        fingerprint,
        normalizedSQL: group.normalizedSQL,
        tables: group.tables,
        queryType: group.queryType,
        count: timeStats.count,
        totalTime: timeStats.sum,
        avgTime: timeStats.avg,
        timeStats,
        lockStats,
        rowsSentStats,
        rowsExaminedStats,
        topSamples: sortedSamples.slice(0, 5),
        allSamples: sortedSamples
      });
    }

    const sortKey = this.options.sortBy;
    fingerprintGroups.sort((a, b) => {
      if (sortKey === 'count') return b.count - a.count;
      if (sortKey === 'avgTime') return b.avgTime - a.avgTime;
      return b.totalTime - a.totalTime;
    });

    const tableStats = [];
    for (const [table, stat] of this.tableStats) {
      const timeStats = calculateStats(stat.queryTimes);
      tableStats.push({
        table,
        count: stat.count,
        totalTime: parseFloat(stat.totalTime.toFixed(4)),
        avgTime: timeStats.avg,
        fingerprintCount: stat.fingerprints.size,
        timeStats
      });
    }
    tableStats.sort((a, b) => b.totalTime - a.totalTime);

    const typeStats = [];
    for (const [type, stat] of this.typeStats) {
      typeStats.push({
        type,
        count: stat.count,
        totalTime: parseFloat(stat.totalTime.toFixed(4)),
        avgTime: parseFloat((stat.totalTime / stat.count).toFixed(4))
      });
    }
    typeStats.sort((a, b) => b.totalTime - a.totalTime);

    const bucketStats = [];
    for (const bucket of TIME_BUCKETS) {
      const stat = this.timeBucketStats.get(bucket.label) || { count: 0, totalTime: 0 };
      bucketStats.push({
        bucket: bucket.label,
        threshold: bucket.threshold,
        count: stat.count,
        totalTime: parseFloat(stat.totalTime.toFixed(4))
      });
    }

    const overallStats = calculateStats(this.allQueryTimes);

    return {
      overall: {
        ...overallStats,
        uniqueFingerprints: this.fingerprintGroups.size,
        tablesCount: this.tableStats.size
      },
      fingerprintGroups: fingerprintGroups.slice(0, this.options.topN),
      allFingerprintGroups: fingerprintGroups,
      tableStats,
      typeStats,
      bucketStats,
      allEntries: this.allEntries
    };
  }
}

module.exports = {
  QueryAnalyzer,
  getTimeBucket,
  calculateStats,
  TIME_BUCKETS
};
