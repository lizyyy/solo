const fs = require('fs');
const path = require('path');
const url = require('url');

function extractDomain(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname;
  } catch {
    return 'unknown';
  }
}

function getResourceType(entry) {
  const mimeType = entry.response?.content?.mimeType || '';
  const urlPath = entry.request?.url || '';
  
  if (mimeType.includes('text/html')) return 'html';
  if (mimeType.includes('text/css')) return 'css';
  if (mimeType.includes('application/javascript') || mimeType.includes('text/javascript')) return 'js';
  if (mimeType.includes('image/')) return 'image';
  if (mimeType.includes('font/')) return 'font';
  if (mimeType.includes('application/json')) return 'json';
  if (urlPath.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) return 'image';
  if (urlPath.match(/\.(css)$/i)) return 'css';
  if (urlPath.match(/\.(js|mjs)$/i)) return 'js';
  if (urlPath.match(/\.(woff|woff2|ttf|eot)$/i)) return 'font';
  if (urlPath.match(/\.(html|htm)$/i)) return 'html';
  return 'other';
}

function getBucket(latency, buckets) {
  for (let i = 0; i < buckets.length; i++) {
    if (latency < buckets[i]) {
      return i;
    }
  }
  return buckets.length;
}

function getBucketLabel(bucketIndex, buckets) {
  if (bucketIndex === 0) {
    return `<${buckets[0]}ms`;
  }
  if (bucketIndex >= buckets.length) {
    return `>=${buckets[buckets.length - 1]}ms`;
  }
  return `${buckets[bucketIndex - 1]}ms-${buckets[bucketIndex]}ms`;
}

function validateEntry(entry, index) {
  const errors = [];
  
  if (!entry) {
    return { valid: false, errors: ['条目为空'], index };
  }
  
  if (!entry.request || !entry.request.url) {
    errors.push('缺少 request.url');
  }
  
  if (entry.time === undefined || entry.time === null || isNaN(entry.time)) {
    errors.push('缺少或无效的 time 字段');
  }
  
  if (!entry.response) {
    errors.push('缺少 response');
  } else if (entry.response.status === undefined) {
    errors.push('缺少 response.status');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    index
  };
}

async function analyzeHar(harFilePath, options) {
  const { buckets, topN, outputDir, harFilePath: originalHarPath } = options;
  
  const rawContent = fs.readFileSync(harFilePath, 'utf8');
  let harData;
  
  try {
    harData = JSON.parse(rawContent);
  } catch (e) {
    throw new Error(`HAR 文件解析失败: ${e.message}`);
  }
  
  if (!harData.log || !Array.isArray(harData.log.entries)) {
    throw new Error('无效的 HAR 格式: 缺少 log.entries 数组');
  }
  
  const entries = harData.log.entries;
  const errors = [];
  const validEntries = [];
  
  entries.forEach((entry, index) => {
    const validation = validateEntry(entry, index);
    if (!validation.valid) {
      errors.push({
        index,
        errors: validation.errors,
        entry: JSON.stringify(entry).substring(0, 500) + '...',
        source: `${originalHarPath}:entries[${index}]`
      });
    } else {
        validEntries.push({ ...entry, _index: index });
      }
    });
  
  const domainStats = {};
  const typeStats = {};
  const statusStats = {};
  const bucketStats = new Array(buckets.length + 1).fill(0);
  const allRequests = [];
  
  validEntries.forEach((entry) => {
    const domain = extractDomain(entry.request.url);
    const resourceType = getResourceType(entry);
    const status = entry.response?.status || 0;
    const latency = entry.time || 0;
    const bucketIndex = getBucket(latency, buckets);
    
    const requestInfo = {
      index: entry._index,
      url: entry.request.url,
      domain,
    resourceType,
    status,
    latency: Math.round(latency),
    bucket: bucketIndex,
    bucketLabel: getBucketLabel(bucketIndex, buckets),
    method: entry.request.method,
    source: `${originalHarPath}:entries[${entry._index}]`
    };
    
    allRequests.push(requestInfo);
    
    if (!domainStats[domain]) {
      domainStats[domain] = {
        domain,
        count: 0,
        totalLatency: 0,
        buckets: new Array(buckets.length + 1).fill(0),
        slowest: []
      };
    }
    domainStats[domain].count++;
    domainStats[domain].totalLatency += latency;
    domainStats[domain].buckets[bucketIndex]++;
    domainStats[domain].slowest.push(requestInfo);
    
    if (!typeStats[resourceType]) {
        typeStats[resourceType] = {
        type: resourceType,
        count: 0,
        totalLatency: 0,
        buckets: new Array(buckets.length + 1).fill(0),
        slowest: []
      };
    }
    typeStats[resourceType].count++;
    typeStats[resourceType].totalLatency += latency;
    typeStats[resourceType].buckets[bucketIndex]++;
    typeStats[resourceType].slowest.push(requestInfo);
    
    const statusKey = String(status);
    if (!statusStats[statusKey]) {
      statusStats[statusKey] = {
        status: statusKey,
        count: 0,
        totalLatency: 0,
        sampleRequests: []
      };
    }
    statusStats[statusKey].count++;
    statusStats[statusKey].totalLatency += latency;
    statusStats[statusKey].sampleRequests.push(requestInfo);
    
    bucketStats[bucketIndex]++;
  });
  
  Object.values(domainStats).forEach(stat => {
    stat.avgLatency = Math.round(stat.totalLatency / stat.count);
    stat.slowest.sort((a, b) => b.latency - a.latency);
    stat.slowest = stat.slowest.slice(0, topN);
  });
  
  Object.values(typeStats).forEach(stat => {
    stat.avgLatency = Math.round(stat.totalLatency / stat.count);
    stat.slowest.sort((a, b) => b.latency - a.latency);
    stat.slowest = stat.slowest.slice(0, topN);
  });
  
  Object.values(statusStats).forEach(stat => {
    stat.avgLatency = Math.round(stat.totalLatency / stat.count);
    stat.sampleRequests.sort((a, b) => b.latency - a.latency);
    stat.sampleRequests = stat.sampleRequests.slice(0, topN);
  });
  
  allRequests.sort((a, b) => b.latency - a.latency);
  const topSlowest = allRequests.slice(0, topN * 2);
  
  const totalLatency = allRequests.reduce((sum, r) => sum + r.latency, 0);
  
  const bucketLabels = buckets.map((_, i) => getBucketLabel(i, buckets));
  bucketLabels.push(`>=${buckets[buckets.length - 1]}ms`);
  
  return {
    metadata: {
      harFile: originalHarPath,
      totalEntries: entries.length,
    validEntries: validEntries.length,
      errorCount: errors.length,
      analyzedAt: new Date().toISOString(),
      buckets,
      bucketLabels,
      topN
    },
    summary: {
      totalRequests: allRequests.length,
      avgLatency: Math.round(totalLatency / allRequests.length) || 0,
      totalLatency,
      bucketStats: bucketStats.map((count, i) => ({
        bucket: i,
        label: getBucketLabel(i, buckets),
        count,
        percentage: allRequests.length ? ((count / allRequests.length) * 100).toFixed(1) : 0
      }))
    },
    domains: Object.values(domainStats).sort((a, b) => b.count - a.count),
    resourceTypes: Object.values(typeStats).sort((a, b) => b.count - a.count),
    statusCodes: Object.values(statusStats).sort((a, b) => b.count - a.count),
    topSlowest,
    allRequests,
    errors
  };
}

module.exports = { analyzeHar, extractDomain, getResourceType, getBucket, getBucketLabel };
