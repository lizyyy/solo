const Storage = require('./storage');

const DEFAULT_THRESHOLD = 10.0;

const Comparator = {
  compareRuns: async function (baseRunId, newRunId, options = {}) {
    const threshold = options.threshold || DEFAULT_THRESHOLD;
    
    const baseRun = await Storage.getBenchmarkRun(baseRunId);
    const newRun = await Storage.getBenchmarkRun(newRunId);
    
    if (!baseRun) {
      throw new Error(`Base run ${baseRunId} not found`);
    }
    
    if (!newRun) {
      throw new Error(`New run ${newRunId} not found`);
    }
    
    const baseResults = await Storage.getBenchmarkResults(baseRun.id);
    const newResults = await Storage.getBenchmarkResults(newRun.id);
    
    const baseMap = new Map();
    for (const result of baseResults) {
      baseMap.set(result.name, result);
    }
    
    const newMap = new Map();
    for (const result of newResults) {
      newMap.set(result.name, result);
    }
    
    const allBenchmarkNames = new Set([
      ...baseMap.keys(),
      ...newMap.keys()
    ]);
    
    const comparisonDetails = [];
    let hasRegressions = false;
    let hasImprovements = false;
    
    for (const name of allBenchmarkNames) {
      const baseResult = baseMap.get(name);
      const newResult = newMap.get(name);
      
      if (!baseResult || !newResult) {
        continue;
      }
      
      const metrics = ['ns_op', 'b_op', 'allocs_op'];
      
      for (const metric of metrics) {
        const baseValue = baseResult[metric];
        const newValue = newResult[metric];
        
        if (baseValue === null || newValue === null || baseValue === 0) {
          continue;
        }
        
        const deltaPercent = ((newValue - baseValue) / baseValue) * 100;
        
        let status = 'unchanged';
        let thresholdExceeded = false;
        
        if (deltaPercent > threshold) {
          status = 'regression';
          thresholdExceeded = true;
          hasRegressions = true;
        } else if (deltaPercent < -threshold) {
          status = 'improvement';
          thresholdExceeded = true;
          hasImprovements = true;
        }
        
        comparisonDetails.push({
          benchmark_name: name,
          metric,
          base_value: baseValue,
          new_value: newValue,
          delta_percent: parseFloat(deltaPercent.toFixed(2)),
          status,
          threshold_exceeded: thresholdExceeded
        });
      }
    }
    
    let overallStatus = 'unchanged';
    if (hasRegressions) {
      overallStatus = 'regression';
    } else if (hasImprovements) {
      overallStatus = 'improvement';
    }
    
    return {
      baseRun,
      newRun,
      overallStatus,
      details: comparisonDetails,
      summary: {
        totalComparisons: comparisonDetails.length,
        regressions: comparisonDetails.filter(d => d.status === 'regression').length,
        improvements: comparisonDetails.filter(d => d.status === 'improvement').length,
        unchanged: comparisonDetails.filter(d => d.status === 'unchanged').length,
        thresholdExceeded: comparisonDetails.filter(d => d.threshold_exceeded).length
      }
    };
  },

  saveComparison: async function (baseRunId, newRunId, notes = '', options = {}) {
    const comparison = await this.compareRuns(baseRunId, newRunId, options);
    
    const baseRun = await Storage.getBenchmarkRun(baseRunId);
    const newRun = await Storage.getBenchmarkRun(newRunId);
    
    const comparisonId = await Storage.saveComparison(
      baseRun.id,
      newRun.id,
      notes,
      comparison.overallStatus
    );
    
    await Storage.saveComparisonDetails(comparisonId, comparison.details);
    
    return {
      comparisonId,
      ...comparison
    };
  },

  getComparisonWithDetails: async function (comparisonId) {
    const comparison = await Storage.getComparison(comparisonId);
    
    if (!comparison) {
      return null;
    }
    
    const details = await Storage.getComparisonDetails(comparisonId);
    
    const baseRun = await Storage.getBenchmarkRun(comparison.base_run_id);
    const newRun = await Storage.getBenchmarkRun(comparison.new_run_id);
    
    return {
      ...comparison,
      baseRun,
      newRun,
      details,
      summary: {
        totalComparisons: details.length,
        regressions: details.filter(d => d.status === 'regression').length,
        improvements: details.filter(d => d.status === 'improvement').length,
        unchanged: details.filter(d => d.status === 'unchanged').length,
        thresholdExceeded: details.filter(d => d.threshold_exceeded).length
      }
    };
  },

  formatMetricName: function (metric) {
    const names = {
      'ns_op': 'ns/op',
      'b_op': 'B/op',
      'allocs_op': 'allocs/op',
      'mb_s': 'MB/s'
    };
    return names[metric] || metric;
  },

  formatComparisonResult: function (comparison) {
    const lines = [];
    
    lines.push(`Comparison: ${comparison.baseRun.run_id} vs ${comparison.newRun.run_id}`);
    lines.push(`Overall Status: ${comparison.overallStatus.toUpperCase()}`);
    lines.push(`Summary: ${comparison.summary.regressions} regressions, ${comparison.summary.improvements} improvements, ${comparison.summary.unchanged} unchanged`);
    lines.push('');
    
    if (comparison.details.length === 0) {
      lines.push('No benchmarks to compare.');
      return lines.join('\n');
    }
    
    const byBenchmark = new Map();
    for (const detail of comparison.details) {
      if (!byBenchmark.has(detail.benchmark_name)) {
        byBenchmark.set(detail.benchmark_name, []);
      }
      byBenchmark.get(detail.benchmark_name).push(detail);
    }
    
    for (const [name, details] of byBenchmark) {
      lines.push(`Benchmark: ${name}`);
      
      for (const detail of details) {
        const metricName = this.formatMetricName(detail.metric);
        const deltaSymbol = detail.delta_percent > 0 ? '+' : '';
        const statusMarker = detail.threshold_exceeded 
          ? (detail.status === 'regression' ? '[REGRESSION]' : '[IMPROVEMENT]') 
          : '';
        
        lines.push(`  ${metricName}: ${detail.base_value} -> ${detail.new_value} (${deltaSymbol}${detail.delta_percent.toFixed(2)}%) ${statusMarker}`);
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }
};

module.exports = Comparator;
