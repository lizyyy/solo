const ss = require('simple-statistics');

function calculatePercentile(sortedValues, percentile) {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  
  if (lower === upper) {
    return sortedValues[lower];
  }
  
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function calculatePercentiles(groups, percentiles) {
  return groups.map(group => {
    const { latencies, records } = group;
    const count = latencies.length;
    
    const stats = {
      count,
      min: latencies[0],
      max: latencies[count - 1],
      avg: ss.mean(latencies),
      sum: ss.sum(latencies),
      variance: ss.variance(latencies),
      stdDev: ss.standardDeviation(latencies)
    };
    
    percentiles.forEach(p => {
      stats[`p${p}`] = calculatePercentile(latencies, p);
    });
    
    return {
      path: group.path,
      tenant: group.tenant,
      statusCode: group.statusCode,
      stats,
      latencies,
      records
    };
  }).sort((a, b) => b.stats.count - a.stats.count);
}

module.exports = {
  calculatePercentiles,
  calculatePercentile
};
