function compareSnapshots(currentData, previousData, separator, depth) {
  const currentKeys = new Set(currentData.map(i => i.key));
  const previousKeys = new Set(previousData.map(i => i.key));

  const addedKeys = currentData.filter(i => !previousKeys.has(i.key));
  const removedKeys = previousData.filter(i => !currentKeys.has(i.key));
  const commonKeys = currentData.filter(i => previousKeys.has(i.key));

  const keyChanges = [];
  const previousMap = new Map(previousData.map(i => [i.key, i]));

  commonKeys.forEach(currentItem => {
    const previousItem = previousMap.get(currentItem.key);
    if (previousItem) {
      keyChanges.push({
        key: currentItem.key,
        memoryChange: currentItem.memory - previousItem.memory,
        memoryChangePercent: ((currentItem.memory - previousItem.memory) / previousItem.memory * 100).toFixed(2),
        ttlChange: currentItem.ttl - previousItem.ttl,
        currentMemory: currentItem.memory,
        previousMemory: previousItem.memory
      });
    }
  });

  const currentStats = {
    totalKeys: currentData.length,
    totalMemory: currentData.reduce((sum, i) => sum + i.memory, 0),
    avgMemory: currentData.reduce((sum, i) => sum + i.memory, 0) / currentData.length,
    noTTLCount: currentData.filter(i => i.ttl === -1).length
  };

  const previousStats = {
    totalKeys: previousData.length,
    totalMemory: previousData.reduce((sum, i) => sum + i.memory, 0),
    avgMemory: previousData.reduce((sum, i) => sum + i.memory, 0) / previousData.length,
    noTTLCount: previousData.filter(i => i.ttl === -1).length
  };

  const summary = {
    keyCountChange: currentStats.totalKeys - previousStats.totalKeys,
    keyCountChangePercent: ((currentStats.totalKeys - previousStats.totalKeys) / previousStats.totalKeys * 100).toFixed(2),
    memoryChange: currentStats.totalMemory - previousStats.totalMemory,
    memoryChangePercent: ((currentStats.totalMemory - previousStats.totalMemory) / previousStats.totalMemory * 100).toFixed(2),
    addedCount: addedKeys.length,
    removedCount: removedKeys.length,
    commonCount: commonKeys.length,
    noTTLChange: currentStats.noTTLCount - previousStats.noTTLCount
  };

  const currentPrefixMap = aggregateKeysByPrefix(currentData, separator, depth);
  const previousPrefixMap = aggregateKeysByPrefix(previousData, separator, depth);

  const prefixTrends = comparePrefixes(currentPrefixMap, previousPrefixMap);

  return {
    summary,
    currentStats,
    previousStats,
    addedKeys: addedKeys.slice(0, 20),
    removedKeys: removedKeys.slice(0, 20),
    topGainers: keyChanges.sort((a, b) => b.memoryChange - a.memoryChange).slice(0, 10),
    topLosers: keyChanges.sort((a, b) => a.memoryChange - b.memoryChange).slice(0, 10),
    prefixTrends
  };
}

function aggregateKeysByPrefix(data, separator, depth) {
  const prefixMap = {};
  
  data.forEach(item => {
    const parts = item.key.split(separator);
    const prefix = parts.slice(0, depth).join(separator);
    
    if (!prefixMap[prefix]) {
      prefixMap[prefix] = {
        prefix,
        keyCount: 0,
        totalMemory: 0,
        noTTLCount: 0
      };
    }
    
    prefixMap[prefix].keyCount++;
    prefixMap[prefix].totalMemory += item.memory;
    if (item.ttl === -1) {
      prefixMap[prefix].noTTLCount++;
    }
  });

  return prefixMap;
}

function comparePrefixes(currentMap, previousMap) {
  const allPrefixes = new Set([...Object.keys(currentMap), ...Object.keys(previousMap)]);
  const trends = [];

  allPrefixes.forEach(prefix => {
    const current = currentMap[prefix] || { keyCount: 0, totalMemory: 0, noTTLCount: 0 };
    const previous = previousMap[prefix] || { keyCount: 0, totalMemory: 0, noTTLCount: 0 };

    trends.push({
      prefix,
      currentKeyCount: current.keyCount,
      previousKeyCount: previous.keyCount,
      keyCountChange: current.keyCount - previous.keyCount,
      keyCountChangePercent: previous.keyCount > 0 
        ? ((current.keyCount - previous.keyCount) / previous.keyCount * 100).toFixed(2)
        : 'Infinity',
      currentMemory: current.totalMemory,
      previousMemory: previous.totalMemory,
      memoryChange: current.totalMemory - previous.totalMemory,
      memoryChangePercent: previous.totalMemory > 0
        ? ((current.totalMemory - previous.totalMemory) / previous.totalMemory * 100).toFixed(2)
        : 'Infinity',
      status: !previousMap[prefix] ? 'new' : !currentMap[prefix] ? 'removed' : 'existing'
    });
  });

  return {
    topByMemoryGrowth: trends.sort((a, b) => b.memoryChange - a.memoryChange).slice(0, 10),
    topByKeyGrowth: trends.sort((a, b) => b.keyCountChange - a.keyCountChange).slice(0, 10),
    allTrends: trends
  };
}

function detectAnomalies(trendData, thresholds = { memoryChange: 50, keyChange: 30 }) {
  const anomalies = [];

  trendData.prefixTrends.allTrends.forEach(trend => {
    const memoryChange = parseFloat(trend.memoryChangePercent);
    const keyChange = parseFloat(trend.keyCountChangePercent);

    if (Math.abs(memoryChange) >= thresholds.memoryChange) {
      anomalies.push({
        type: 'memory',
        prefix: trend.prefix,
        change: memoryChange,
        severity: Math.abs(memoryChange) > 100 ? 'critical' : 'warning'
      });
    }

    if (Math.abs(keyChange) >= thresholds.keyChange) {
      anomalies.push({
        type: 'key_count',
        prefix: trend.prefix,
        change: keyChange,
        severity: Math.abs(keyChange) > 50 ? 'critical' : 'warning'
      });
    }
  });

  return anomalies;
}

module.exports = {
  compareSnapshots,
  detectAnomalies
};
