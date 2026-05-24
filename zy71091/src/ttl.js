function parseTTLBuckets(bucketStr) {
  return bucketStr.split(',').map(b => parseInt(b.trim(), 10)).sort((a, b) => a - b);
}

function formatBucketLabel(min, max) {
  if (min === 0 && max === 0) {
    return '无 TTL (永久)';
  }
  if (max === Infinity) {
    return `> ${formatTTL(min)}`;
  }
  return `${formatTTL(min)} - ${formatTTL(max)}`;
}

function formatTTL(seconds) {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}天`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}周`;
  return `${Math.floor(seconds / 2592000)}月`;
}

function analyzeTTL(data, bucketStr) {
  const buckets = parseTTLBuckets(bucketStr);
  const bucketStats = {};
  const noTTLData = [];
  const withTTLData = [];

  data.forEach(item => {
    if (item.ttl === -1 || item.ttl === undefined) {
      noTTLData.push(item);
    } else {
      withTTLData.push(item);
    }
  });

  bucketStats['no_ttl'] = {
    label: '无 TTL (永久)',
    minTTL: -1,
    maxTTL: -1,
    count: noTTLData.length,
    percentage: (noTTLData.length / data.length * 100).toFixed(2),
    totalMemory: noTTLData.reduce((sum, i) => sum + i.memory, 0),
    avgMemory: noTTLData.length > 0 ? noTTLData.reduce((sum, i) => sum + i.memory, 0) / noTTLData.length : 0,
    sampleKeys: noTTLData.slice(0, 5).map(i => i.key)
  };

  for (let i = 0; i < buckets.length; i++) {
    const min = buckets[i];
    const max = i < buckets.length - 1 ? buckets[i + 1] : Infinity;
    
    const bucketItems = withTTLData.filter(item => {
      if (i === buckets.length - 1) {
        return item.ttl >= min;
      }
      return item.ttl >= min && item.ttl < max;
    });

    const bucketKey = `ttl_${min}_${max === Infinity ? 'inf' : max}`;
    bucketStats[bucketKey] = {
      label: formatBucketLabel(min, max),
      minTTL: min,
      maxTTL: max,
      count: bucketItems.length,
      percentage: (bucketItems.length / data.length * 100).toFixed(2),
      totalMemory: bucketItems.reduce((sum, i) => sum + i.memory, 0),
      avgMemory: bucketItems.length > 0 ? bucketItems.reduce((sum, i) => sum + i.memory, 0) / bucketItems.length : 0,
      sampleKeys: bucketItems.slice(0, 5).map(i => i.key)
    };
  }

  const sortedBuckets = Object.values(bucketStats).sort((a, b) => b.totalMemory - a.totalMemory);

  const ttlValues = withTTLData.map(i => i.ttl).sort((a, b) => a - b);
  const stats = {
    totalKeys: data.length,
    noTTLCount: noTTLData.length,
    noTTLPercentage: (noTTLData.length / data.length * 100).toFixed(2),
    withTTLCount: withTTLData.length,
    withTTLPercentage: (withTTLData.length / data.length * 100).toFixed(2),
    minTTL: ttlValues.length > 0 ? ttlValues[0] : 0,
    maxTTL: ttlValues.length > 0 ? ttlValues[ttlValues.length - 1] : 0,
    avgTTL: ttlValues.length > 0 ? ttlValues.reduce((a, b) => a + b, 0) / ttlValues.length : 0,
    medianTTL: ttlValues.length > 0 ? ttlValues[Math.floor(ttlValues.length / 2)] : 0
  };

  return {
    stats,
    buckets: bucketStats,
    sortedBuckets,
    topMemoryBuckets: sortedBuckets.slice(0, 5),
    topCountBuckets: Object.values(bucketStats).sort((a, b) => b.count - a.count).slice(0, 5)
  };
}

function findExpiringSoon(data, thresholdSeconds = 3600) {
  const expiring = data
    .filter(item => item.ttl > 0 && item.ttl <= thresholdSeconds)
    .sort((a, b) => a.ttl - b.ttl);

  return {
    count: expiring.length,
    totalMemory: expiring.reduce((sum, i) => sum + i.memory, 0),
    threshold: thresholdSeconds,
    topItems: expiring.slice(0, 10)
  };
}

function findLongLivedKeys(data, thresholdSeconds = 86400 * 30) {
  const longLived = data
    .filter(item => item.ttl === -1 || item.ttl >= thresholdSeconds)
    .sort((a, b) => b.memory - a.memory);

  return {
    count: longLived.length,
    totalMemory: longLived.reduce((sum, i) => sum + i.memory, 0),
    threshold: thresholdSeconds,
    topItems: longLived.slice(0, 10)
  };
}

module.exports = {
  analyzeTTL,
  findExpiringSoon,
  findLongLivedKeys,
  parseTTLBuckets,
  formatTTL
};
