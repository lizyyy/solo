const { parseDate } = require('./utils');
const { STATUS_TYPES } = require('./constants');

const STATUS_ORDER = {
  [STATUS_TYPES.CREATED]: 0,
  [STATUS_TYPES.COLLECTED]: 1,
  [STATUS_TYPES.IN_TRANSIT]: 2,
  [STATUS_TYPES.ARRIVED]: 3,
  [STATUS_TYPES.DELIVERING]: 4,
  [STATUS_TYPES.DELIVERED]: 5,
  [STATUS_TYPES.FAILED]: 6,
  [STATUS_TYPES.RETURNED]: 7
};

function sortTracesByTime(traces) {
  return [...traces].sort((a, b) => {
    const timeA = parseDate(a.time || a.timestamp);
    const timeB = parseDate(b.time || b.timestamp);
    return timeA.valueOf() - timeB.valueOf();
  });
}

function sortTracesByStatusThenTime(traces) {
  return [...traces].sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] || 99;
    const orderB = STATUS_ORDER[b.status] || 99;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    const timeA = parseDate(a.time || a.timestamp);
    const timeB = parseDate(b.time || b.timestamp);
    return timeA.valueOf() - timeB.valueOf();
  });
}

function detectTimeReversals(traces) {
  const reversals = [];
  const sorted = sortTracesByTime(traces);
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    
    const currentTime = parseDate(current.time || current.timestamp);
    const nextTime = parseDate(next.time || next.timestamp);
    
    const originalIndexA = traces.indexOf(current);
    const originalIndexB = traces.indexOf(next);
    
    if (originalIndexA > originalIndexB && nextTime.isAfter(currentTime)) {
      reversals.push({
        before: current,
        after: next,
        beforeIndex: originalIndexA,
        afterIndex: originalIndexB
      });
    }
  }
  
  return reversals;
}

function sortWithReversalDetection(traces) {
  const originalOrder = traces.map((t, index) => ({ ...t, originalIndex: index }));
  const sorted = sortTracesByTime(originalOrder);
  
  const hasTimeReversal = sorted.some((t, i) => 
    i > 0 && t.originalIndex < sorted[i - 1].originalIndex
  );
  
  return {
    sorted: sorted.map(({ originalIndex, ...t }) => t),
    originalOrder: traces,
    hasTimeReversal,
    reversals: detectTimeReversals(traces)
  };
}

function normalizeTrace(trace) {
  const normalized = { ...trace };
  
  if (trace.time && !trace.timestamp) {
    normalized.timestamp = trace.time;
  } else if (trace.timestamp && !trace.time) {
    normalized.time = trace.timestamp;
  }
  
  if (trace.location && !trace.city) {
    normalized.city = trace.location;
  } else if (trace.city && !trace.location) {
    normalized.location = trace.city;
  }
  
  if (trace.description && !trace.message) {
    normalized.message = trace.description;
  } else if (trace.message && !trace.description) {
    normalized.description = trace.message;
  }
  
  if (trace.operator && !trace.operatorId) {
    normalized.operatorId = trace.operator;
  }
  
  if (trace.device && !trace.deviceId) {
    normalized.deviceId = trace.device;
  }
  
  return normalized;
}

function prepareTraces(traces) {
  if (!Array.isArray(traces) || traces.length === 0) {
    return {
      traces: [],
      normalized: [],
      sorted: [],
      issues: []
    };
  }
  
  const normalized = traces.map(normalizeTrace);
  const sortResult = sortWithReversalDetection(normalized);
  
  const issues = [];
  
  if (sortResult.hasTimeReversal) {
    issues.push({
      type: 'time_reversal',
      message: '检测到原始轨迹时间顺序存在问题，已重新排序',
      details: sortResult.reversals
    });
  }
  
  const invalidDates = normalized.filter(t => {
    const parsed = parseDate(t.time || t.timestamp);
    return !parsed.isValid();
  });
  
  if (invalidDates.length > 0) {
    issues.push({
      type: 'invalid_date',
      message: `发现 ${invalidDates.length} 条记录的时间格式无法解析`,
      details: invalidDates.map(t => ({ index: normalized.indexOf(t), trace: t }))
    });
  }
  
  return {
    traces,
    normalized,
    sorted: sortResult.sorted,
    issues
  };
}

module.exports = {
  sortTracesByTime,
  sortTracesByStatusThenTime,
  detectTimeReversals,
  sortWithReversalDetection,
  normalizeTrace,
  prepareTraces
};
