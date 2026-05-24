const fs = require('fs');
const path = require('path');

function readSampleFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    return {
      success: true,
      data: Array.isArray(data) ? data : [data],
      sourceFile: path.basename(filePath),
      readAt: new Date().toISOString()
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        success: false,
        error: 'INVALID_JSON',
        message: `JSON 解析失败: ${err.message}`
      };
    }
    return {
      success: false,
      error: 'READ_ERROR',
      message: `文件读取失败: ${err.message}`
    };
  }
}

function applySampling(data, sampleRate) {
  if (sampleRate >= 1.0) {
    return {
      sampledData: data,
      sampledCount: data.length,
      totalCount: data.length,
      sampleRate: 1.0
    };
  }

  const sampleSize = Math.ceil(data.length * sampleRate);
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  const sampledData = shuffled.slice(0, sampleSize);

  return {
    sampledData,
    sampledCount: sampledData.length,
    totalCount: data.length,
    sampleRate: sampleRate,
    isSampled: true
  };
}

function normalizeData(data) {
  return data.map(item => {
    let ttl = item.ttl;
    if (ttl === undefined) {
      ttl = -1;
    } else if (typeof ttl !== 'number' || ttl < -1) {
      ttl = -1;
    }
    
    return {
      key: item.key,
      memory: item.memory,
      ttl,
      type: item.type || 'unknown',
      db: item.db || 0
    };
  });
}

function calculateBasicStats(data) {
  const totalMemory = data.reduce((sum, item) => sum + item.memory, 0);
  const noTTLCount = data.filter(item => item.ttl === -1).length;
  const typeStats = {};

  data.forEach(item => {
    typeStats[item.type] = (typeStats[item.type] || 0) + 1;
  });

  const memories = data.map(item => item.memory).sort((a, b) => b - a);
  const avgMemory = totalMemory / data.length;
  const medianMemory = memories[Math.floor(memories.length / 2)];
  const p95Memory = memories[Math.floor(memories.length * 0.05)];

  return {
    totalKeys: data.length,
    totalMemory,
    avgMemory,
    medianMemory,
    p95Memory,
    maxMemory: memories[0],
    minMemory: memories[memories.length - 1],
    noTTLCount,
    noTTLPercentage: (noTTLCount / data.length * 100).toFixed(2),
    typeStats,
    topBigKeys: data
      .sort((a, b) => b.memory - a.memory)
      .slice(0, 10)
      .map(item => ({
        key: item.key,
        memory: item.memory,
        ttl: item.ttl,
        type: item.type
      }))
  };
}

module.exports = {
  readSampleFile,
  applySampling,
  normalizeData,
  calculateBasicStats
};
