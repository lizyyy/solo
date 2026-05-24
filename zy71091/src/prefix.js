function extractPrefix(key, separator, depth) {
  const parts = key.split(separator);
  return parts.slice(0, depth).join(separator);
}

function aggregateByPrefix(data, separator, maxDepth, topN) {
  const prefixTree = {};
  const allDepths = {};

  for (let d = 1; d <= maxDepth; d++) {
    allDepths[d] = {};
  }

  data.forEach(item => {
    const parts = item.key.split(separator);
    
    for (let d = 1; d <= Math.min(maxDepth, parts.length); d++) {
      const prefix = parts.slice(0, d).join(separator);
      
      if (!allDepths[d][prefix]) {
        allDepths[d][prefix] = {
          prefix,
          depth: d,
          keyCount: 0,
          totalMemory: 0,
          noTTLCount: 0,
          avgMemory: 0,
          typeBreakdown: {},
          sampleKeys: []
        };
      }

      const stats = allDepths[d][prefix];
      stats.keyCount++;
      stats.totalMemory += item.memory;
      if (item.ttl === -1) {
        stats.noTTLCount++;
      }
      stats.typeBreakdown[item.type] = (stats.typeBreakdown[item.type] || 0) + 1;
      
      if (stats.sampleKeys.length < 5) {
        stats.sampleKeys.push(item.key);
      }
    }
  });

  const result = {};
  
  for (let d = 1; d <= maxDepth; d++) {
    const prefixes = Object.values(allDepths[d]).map(p => ({
      ...p,
      avgMemory: p.totalMemory / p.keyCount,
      noTTLPercentage: (p.noTTLCount / p.keyCount * 100).toFixed(2)
    }));

    prefixes.sort((a, b) => b.totalMemory - a.totalMemory);

    result[d] = {
      totalPrefixes: prefixes.length,
      topPrefixes: prefixes.slice(0, topN),
      allPrefixes: prefixes
    };
  }

  return result;
}

function detectPrefixPatterns(data, separator) {
  const firstLevel = {};
  
  data.forEach(item => {
    const parts = item.key.split(separator);
    if (parts.length > 0) {
      const firstPart = parts[0];
      firstLevel[firstPart] = (firstLevel[firstPart] || 0) + 1;
    }
  });

  const sorted = Object.entries(firstLevel)
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count);

  const businessPrefixes = sorted.filter(p => p.count >= 10).map(p => p.prefix);
  const mixedPrefixes = sorted.filter(p => p.count < 10 && p.count >= 2).map(p => p.prefix);

  return {
    businessPrefixes: businessPrefixes.slice(0, 20),
    mixedPrefixes: mixedPrefixes.slice(0, 10),
    firstLevelStats: sorted
  };
}

function analyzePrefixMemoryDistribution(prefixData, depth) {
  const levelData = prefixData[depth];
  if (!levelData) return null;

  const topPrefixes = levelData.topPrefixes;
  const totalMemory = topPrefixes.reduce((sum, p) => sum + p.totalMemory, 0);

  const cumulative = [];
  let runningTotal = 0;
  
  topPrefixes.forEach(p => {
    runningTotal += p.totalMemory;
    cumulative.push({
      prefix: p.prefix,
      memory: p.totalMemory,
      cumulativePercentage: (runningTotal / totalMemory * 100).toFixed(2)
    });
  });

  const top5Memory = topPrefixes.slice(0, 5).reduce((sum, p) => sum + p.totalMemory, 0);
  const top10Memory = topPrefixes.slice(0, 10).reduce((sum, p) => sum + p.totalMemory, 0);

  return {
    depth,
    totalPrefixes: levelData.totalPrefixes,
    totalMemory,
    top5Percentage: (top5Memory / totalMemory * 100).toFixed(2),
    top10Percentage: (top10Memory / totalMemory * 100).toFixed(2),
    cumulativeDistribution: cumulative.slice(0, 20)
  };
}

function findHighRiskPrefixes(prefixData, depth) {
  const levelData = prefixData[depth];
  if (!levelData) return [];

  return levelData.allPrefixes
    .filter(p => parseFloat(p.noTTLPercentage) > 50)
    .sort((a, b) => b.totalMemory - a.totalMemory)
    .slice(0, 10)
    .map(p => ({
      prefix: p.prefix,
      keyCount: p.keyCount,
      totalMemory: p.totalMemory,
      noTTLCount: p.noTTLCount,
      noTTLPercentage: p.noTTLPercentage,
      risk: 'high'
    }));
}

module.exports = {
  extractPrefix,
  aggregateByPrefix,
  detectPrefixPatterns,
  analyzePrefixMemoryDistribution,
  findHighRiskPrefixes
};
