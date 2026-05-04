const fs = require('fs');
const csv = require('csv-parser');
const { Readable } = require('stream');

class TrafficParser {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async parse() {
    const records = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(this.filePath)
        .pipe(csv())
        .on('data', (data) => {
          records.push(this.normalizeRecord(data));
        })
        .on('end', () => {
          resolve(this.analyzeTraffic(records));
        })
        .on('error', reject);
    });
  }

  parseSync() {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this.parseCSVLine(lines[i]);
      const record = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx] || '';
      });
      records.push(this.normalizeRecord(record));
    }

    return this.analyzeTraffic(records);
  }

  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    return values;
  }

  normalizeRecord(record) {
    const normalized = {};

    const fieldMappings = {
      'timestamp': ['timestamp', 'time', 'datetime', 'date'],
      'endpoint': ['endpoint', 'path', 'route', 'url', 'uri'],
      'method': ['method', 'http_method', 'httpmethod'],
      'status': ['status', 'status_code', 'statuscode', 'code'],
      'latency': ['latency', 'response_time', 'responsetime', 'duration'],
      'request_size': ['request_size', 'requestsize', 'req_size'],
      'response_size': ['response_size', 'responsesize', 'res_size'],
      'memory_before': ['memory_before', 'memorybefore', 'mem_before'],
      'memory_after': ['memory_after', 'memoryafter', 'mem_after'],
      'gc_count': ['gc_count', 'gccount', 'gc'],
      'heap_used': ['heap_used', 'heapused', 'heap'],
      'rss': ['rss', 'resident_size']
    };

    for (const [targetField, sourceFields] of Object.entries(fieldMappings)) {
      for (const sourceField of sourceFields) {
        if (record[sourceField] !== undefined) {
          normalized[targetField] = record[sourceField];
          break;
        }
      }
    }

    if (normalized.timestamp) {
      normalized.timestampMs = this.parseTimestamp(normalized.timestamp);
    }

    if (normalized.status) {
      normalized.statusCode = parseInt(normalized.status) || normalized.status;
    }

    if (normalized.latency) {
      normalized.latencyMs = this.parseNumber(normalized.latency);
    }

    if (normalized.request_size) {
      normalized.requestSizeBytes = this.parseNumber(normalized.request_size);
    }

    if (normalized.response_size) {
      normalized.responseSizeBytes = this.parseNumber(normalized.response_size);
    }

    if (normalized.memory_before) {
      normalized.memoryBeforeBytes = this.parseMemoryValue(normalized.memory_before);
    }

    if (normalized.memory_after) {
      normalized.memoryAfterBytes = this.parseMemoryValue(normalized.memory_after);
    }

    if (normalized.heap_used) {
      normalized.heapUsedBytes = this.parseMemoryValue(normalized.heap_used);
    }

    if (normalized.rss) {
      normalized.rssBytes = this.parseMemoryValue(normalized.rss);
    }

    return normalized;
  }

  parseTimestamp(ts) {
    if (typeof ts === 'number') return ts;
    
    const num = parseInt(ts);
    if (!isNaN(num)) {
      if (num > 1000000000000) return num;
      return num * 1000;
    }

    const date = new Date(ts);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }

    return Date.now();
  }

  parseNumber(value) {
    if (typeof value === 'number') return value;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }

  parseMemoryValue(value) {
    if (typeof value === 'number') return value;
    
    const strValue = String(value).toLowerCase();
    const match = strValue.match(/^([\d.]+)\s*(kb|mb|gb|k|m|g)?$/);
    
    if (match) {
      const num = parseFloat(match[1]);
      const unit = match[2] || 'b';
      
      switch (unit) {
        case 'kb':
        case 'k':
          return num * 1024;
        case 'mb':
        case 'm':
          return num * 1024 * 1024;
        case 'gb':
        case 'g':
          return num * 1024 * 1024 * 1024;
        default:
          return num;
      }
    }

    return this.parseNumber(value);
  }

  analyzeTraffic(records) {
    const result = {
      meta: {
        totalRequests: records.length,
        analyzedAt: new Date().toISOString()
      },
      records: records,
      summary: {},
      byEndpoint: {},
      byMethod: {},
      byStatus: {},
      timeSeries: [],
      memoryTrends: [],
      outliers: [],
      statistics: {}
    };

    result.byEndpoint = this.groupBy(records, 'endpoint');
    result.byMethod = this.groupBy(records, 'method');
    result.byStatus = this.groupByStatus(records);
    result.timeSeries = this.generateTimeSeries(records);
    result.memoryTrends = this.analyzeMemoryTrends(records);
    result.outliers = this.findOutliers(records);
    result.statistics = this.calculateStatistics(records);
    result.summary = this.generateSummary(result);

    return result;
  }

  groupBy(records, field) {
    const groups = {};
    
    for (const record of records) {
      const key = record[field] || 'unknown';
      if (!groups[key]) {
        groups[key] = {
          count: 0,
          records: [],
          avgLatency: 0,
          totalLatency: 0,
          maxLatency: 0,
          minLatency: Infinity,
          errorRate: 0,
          totalMemoryIncrease: 0
        };
      }
      
      groups[key].count++;
      groups[key].records.push(record);
      
      if (record.latencyMs !== undefined) {
        groups[key].totalLatency += record.latencyMs;
        groups[key].maxLatency = Math.max(groups[key].maxLatency, record.latencyMs);
        groups[key].minLatency = Math.min(groups[key].minLatency, record.latencyMs);
      }

      if (record.memoryBeforeBytes !== undefined && record.memoryAfterBytes !== undefined) {
        groups[key].totalMemoryIncrease += (record.memoryAfterBytes - record.memoryBeforeBytes);
      }
    }

    for (const key of Object.keys(groups)) {
      const group = groups[key];
      if (group.count > 0) {
        group.avgLatency = group.totalLatency / group.count;
        if (group.minLatency === Infinity) group.minLatency = 0;
      }
      delete group.records;
    }

    return groups;
  }

  groupByStatus(records) {
    const groups = {
      success: { count: 0, percentage: 0 },
      clientError: { count: 0, percentage: 0 },
      serverError: { count: 0, percentage: 0 },
      other: { count: 0, percentage: 0 },
      byCode: {}
    };

    for (const record of records) {
      const status = record.statusCode;
      
      if (!groups.byCode[status]) {
        groups.byCode[status] = 0;
      }
      groups.byCode[status]++;

      if (status >= 200 && status < 400) {
        groups.success.count++;
      } else if (status >= 400 && status < 500) {
        groups.clientError.count++;
      } else if (status >= 500) {
        groups.serverError.count++;
      } else {
        groups.other.count++;
      }
    }

    const total = records.length;
    if (total > 0) {
      groups.success.percentage = (groups.success.count / total) * 100;
      groups.clientError.percentage = (groups.clientError.count / total) * 100;
      groups.serverError.percentage = (groups.serverError.count / total) * 100;
      groups.other.percentage = (groups.other.count / total) * 100;
    }

    return groups;
  }

  generateTimeSeries(records) {
    if (records.length === 0) return [];

    const sorted = [...records].sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
    const firstTs = sorted[0].timestampMs;
    const lastTs = sorted[sorted.length - 1].timestampMs;
    const duration = lastTs - firstTs;

    let interval = 60000;
    if (duration > 3600000) {
      interval = 300000;
    }
    if (duration > 86400000) {
      interval = 3600000;
    }

    const buckets = {};
    for (const record of sorted) {
      const bucketKey = Math.floor((record.timestampMs || firstTs) / interval) * interval;
      if (!buckets[bucketKey]) {
        buckets[bucketKey] = {
          timestamp: bucketKey,
          requestCount: 0,
          avgLatency: 0,
          totalLatency: 0,
          errorCount: 0,
          totalMemoryIncrease: 0
        };
      }
      
      buckets[bucketKey].requestCount++;
      
      if (record.latencyMs !== undefined) {
        buckets[bucketKey].totalLatency += record.latencyMs;
      }

      if (record.statusCode >= 500) {
        buckets[bucketKey].errorCount++;
      }

      if (record.memoryBeforeBytes !== undefined && record.memoryAfterBytes !== undefined) {
        buckets[bucketKey].totalMemoryIncrease += (record.memoryAfterBytes - record.memoryBeforeBytes);
      }
    }

    const series = Object.values(buckets).sort((a, b) => a.timestamp - b.timestamp);
    
    for (const bucket of series) {
      if (bucket.requestCount > 0) {
        bucket.avgLatency = bucket.totalLatency / bucket.requestCount;
      }
    }

    return series;
  }

  analyzeMemoryTrends(records) {
    const trends = {
      hasMemoryData: false,
      memoryOverTime: [],
      avgMemoryPerRequest: 0,
      totalMemoryIncrease: 0,
      trend: 'stable',
      leakIndicators: []
    };

    const memoryRecords = records.filter(r => 
      r.memoryBeforeBytes !== undefined || 
      r.heapUsedBytes !== undefined
    );

    if (memoryRecords.length === 0) {
      return trends;
    }

    trends.hasMemoryData = true;

    const sorted = [...memoryRecords].sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));

    for (const record of sorted) {
      const dataPoint = {
        timestamp: record.timestampMs,
        endpoint: record.endpoint,
        method: record.method
      };

      if (record.memoryBeforeBytes !== undefined && record.memoryAfterBytes !== undefined) {
        dataPoint.memoryBefore = record.memoryBeforeBytes;
        dataPoint.memoryAfter = record.memoryAfterBytes;
        dataPoint.memoryDelta = record.memoryAfterBytes - record.memoryBeforeBytes;
        trends.totalMemoryIncrease += dataPoint.memoryDelta;
      }

      if (record.heapUsedBytes !== undefined) {
        dataPoint.heapUsed = record.heapUsedBytes;
      }

      if (record.rssBytes !== undefined) {
        dataPoint.rss = record.rssBytes;
      }

      trends.memoryOverTime.push(dataPoint);
    }

    if (trends.memoryOverTime.length > 1) {
      const first = trends.memoryOverTime[0];
      const last = trends.memoryOverTime[trends.memoryOverTime.length - 1];
      
      if (first.memoryAfter !== undefined && last.memoryAfter !== undefined) {
        const growth = last.memoryAfter - first.memoryAfter;
        if (growth > 10 * 1024 * 1024) {
          trends.trend = 'growing';
          trends.leakIndicators.push({
            type: 'memory_growth',
            description: `内存增长 ${(growth / (1024 * 1024)).toFixed(2)}MB`,
            severity: 'warning'
          });
        } else if (growth < -10 * 1024 * 1024) {
          trends.trend = 'shrinking';
        }
      }
    }

    if (trends.memoryOverTime.length > 0) {
      trends.avgMemoryPerRequest = trends.totalMemoryIncrease / trends.memoryOverTime.length;
    }

    const memoryDeltas = trends.memoryOverTime
      .filter(m => m.memoryDelta !== undefined)
      .map(m => m.memoryDelta);
    
    const positiveDeltas = memoryDeltas.filter(d => d > 0);
    if (positiveDeltas.length > 0 && memoryDeltas.length > 0) {
      const positiveRatio = positiveDeltas.length / memoryDeltas.length;
      if (positiveRatio > 0.8) {
        trends.leakIndicators.push({
          type: 'consistent_growth',
          description: `${(positiveRatio * 100).toFixed(1)}% 的请求后内存增加`,
          severity: 'warning'
        });
      }
    }

    return trends;
  }

  findOutliers(records) {
    const outliers = {
      highLatency: [],
      highMemoryIncrease: [],
      errors: []
    };

    const latencyRecords = records.filter(r => r.latencyMs !== undefined);
    if (latencyRecords.length > 0) {
      const latencies = latencyRecords.map(r => r.latencyMs);
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const stdDev = this.calculateStdDev(latencies);
      const threshold = avgLatency + (stdDev * 3);

      outliers.highLatency = latencyRecords
        .filter(r => r.latencyMs > threshold)
        .map(r => ({
          endpoint: r.endpoint,
          method: r.method,
          latency: r.latencyMs,
          status: r.statusCode,
          timestamp: r.timestamp
        }))
        .sort((a, b) => b.latency - a.latency)
        .slice(0, 20);
    }

    const memoryRecords = records.filter(r => 
      r.memoryBeforeBytes !== undefined && r.memoryAfterBytes !== undefined
    );
    
    if (memoryRecords.length > 0) {
      const deltas = memoryRecords.map(r => r.memoryAfterBytes - r.memoryBeforeBytes);
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const stdDev = this.calculateStdDev(deltas);
      const threshold = avgDelta + (stdDev * 2);

      outliers.highMemoryIncrease = memoryRecords
        .filter(r => (r.memoryAfterBytes - r.memoryBeforeBytes) > threshold)
        .map(r => ({
          endpoint: r.endpoint,
          method: r.method,
          memoryIncrease: r.memoryAfterBytes - r.memoryBeforeBytes,
          memoryBefore: r.memoryBeforeBytes,
          memoryAfter: r.memoryAfterBytes,
          timestamp: r.timestamp
        }))
        .sort((a, b) => b.memoryIncrease - a.memoryIncrease)
        .slice(0, 20);
    }

    outliers.errors = records
      .filter(r => r.statusCode >= 500)
      .map(r => ({
        endpoint: r.endpoint,
        method: r.method,
        status: r.statusCode,
        latency: r.latencyMs,
        timestamp: r.timestamp
      }))
      .slice(0, 20);

    return outliers;
  }

  calculateStdDev(values) {
    if (values.length < 2) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  calculateStatistics(records) {
    const stats = {
      totalRequests: records.length,
      avgLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      errorRate: 0,
      throughputPerMinute: 0
    };

    const latencyRecords = records.filter(r => r.latencyMs !== undefined);
    if (latencyRecords.length > 0) {
      const latencies = latencyRecords.map(r => r.latencyMs).sort((a, b) => a - b);
      
      stats.avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      stats.p50Latency = this.percentile(latencies, 50);
      stats.p95Latency = this.percentile(latencies, 95);
      stats.p99Latency = this.percentile(latencies, 99);
      stats.maxLatency = latencies[latencies.length - 1];
      stats.minLatency = latencies[0];
    }

    if (stats.minLatency === Infinity) stats.minLatency = 0;

    const errorRecords = records.filter(r => r.statusCode >= 500);
    if (records.length > 0) {
      stats.errorRate = (errorRecords.length / records.length) * 100;
    }

    const sortedRecords = [...records].sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
    if (sortedRecords.length > 1) {
      const firstTs = sortedRecords[0].timestampMs || Date.now();
      const lastTs = sortedRecords[sortedRecords.length - 1].timestampMs || Date.now();
      const durationMs = lastTs - firstTs;
      if (durationMs > 0) {
        stats.throughputPerMinute = (records.length / durationMs) * 60000;
      }
    }

    return stats;
  }

  percentile(sortedArray, p) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  generateSummary(result) {
    const summary = {
      overview: {
        totalRequests: result.meta.totalRequests,
        timeRange: 'N/A',
        avgThroughput: result.statistics.throughputPerMinute.toFixed(2) + ' req/min',
        avgLatency: result.statistics.avgLatency.toFixed(2) + ' ms',
        errorRate: result.statistics.errorRate.toFixed(2) + '%'
      },
      endpoints: [],
      methods: [],
      memorySummary: null
    };

    if (result.records.length > 0) {
      const sorted = [...result.records].sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
      const first = new Date(sorted[0].timestampMs || Date.now()).toISOString();
      const last = new Date(sorted[sorted.length - 1].timestampMs || Date.now()).toISOString();
      summary.overview.timeRange = `${first} 至 ${last}`;
    }

    summary.endpoints = Object.entries(result.byEndpoint)
      .map(([endpoint, data]) => ({
        endpoint,
        requestCount: data.count,
        avgLatency: data.avgLatency.toFixed(2) + ' ms'
      }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    summary.methods = Object.entries(result.byMethod)
      .map(([method, data]) => ({
        method,
        requestCount: data.count,
        percentage: (data.count / result.meta.totalRequests * 100).toFixed(1) + '%'
      }))
      .sort((a, b) => b.requestCount - a.requestCount);

    if (result.memoryTrends.hasMemoryData) {
      summary.memorySummary = {
        trend: result.memoryTrends.trend,
        totalMemoryIncrease: (result.memoryTrends.totalMemoryIncrease / (1024 * 1024)).toFixed(2) + ' MB',
        avgMemoryPerRequest: (result.memoryTrends.avgMemoryPerRequest / 1024).toFixed(2) + ' KB',
        leakIndicatorsCount: result.memoryTrends.leakIndicators.length
      };
    }

    return summary;
  }
}

module.exports = TrafficParser;
