const { parseDate, extractCity, isSameLocation, formatDate } = require('./utils');
const { 
  STATUS_TYPES, 
  STATUS_TRANSITIONS, 
  ANOMALY_TYPES,
  VALIDATION_RESULT 
} = require('./constants');

function isStatusTransitionValid(fromStatus, toStatus) {
  if (!fromStatus) return true;
  if (!toStatus) return false;
  
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
}

function detectSignedBeforeCollect(traces) {
  const anomalies = [];
  
  const collectedTraces = traces.filter(t => 
    t.status === STATUS_TYPES.COLLECTED
  );
  
  const deliveredTraces = traces.filter(t => 
    t.status === STATUS_TYPES.DELIVERED
  );
  
  if (collectedTraces.length === 0 && deliveredTraces.length > 0) {
    anomalies.push({
      type: ANOMALY_TYPES.MISSING_COLLECT,
      severity: 'high',
      message: '已签收但未找到揽收记录',
      details: {
        deliveredTrace: deliveredTraces[0],
        missingCollected: true
      }
    });
  }
  
  if (collectedTraces.length > 0 && deliveredTraces.length > 0) {
    const earliestCollected = collectedTraces.reduce((earliest, t) => {
      const tTime = parseDate(t.time || t.timestamp);
      const eTime = parseDate(earliest.time || earliest.timestamp);
      return tTime.isBefore(eTime) ? t : earliest;
    }, collectedTraces[0]);
    
    const earliestDelivered = deliveredTraces.reduce((earliest, t) => {
      const tTime = parseDate(t.time || t.timestamp);
      const eTime = parseDate(earliest.time || earliest.timestamp);
      return tTime.isBefore(eTime) ? t : earliest;
    }, deliveredTraces[0]);
    
    const collectedTime = parseDate(earliestCollected.time || earliestCollected.timestamp);
    const deliveredTime = parseDate(earliestDelivered.time || earliestDelivered.timestamp);
    
    if (deliveredTime.isBefore(collectedTime)) {
      const timeDiff = collectedTime.diff(deliveredTime, 'hours');
      
      anomalies.push({
        type: ANOMALY_TYPES.SIGNED_BEFORE_COLLECT,
        severity: 'high',
        message: `先签收后揽收：签收时间比揽收时间早 ${timeDiff} 小时`,
        details: {
          deliveredTrace: earliestDelivered,
          collectedTrace: earliestCollected,
          timeDiffHours: timeDiff
        }
      });
    }
  }
  
  return anomalies;
}

const ABSTRACT_LOCATIONS = ['运输途中', '在途中', '转运中', '发往', '运往', '派送中', '派送'];

function isAbstractLocation(city) {
  if (!city) return true;
  const lower = city.toLowerCase();
  return ABSTRACT_LOCATIONS.some(al => lower.includes(al));
}

function detectCityJumps(traces) {
  const anomalies = [];
  const MIN_SPEED_KMH = 800;
  
  for (let i = 0; i < traces.length - 1; i++) {
    const current = traces[i];
    const next = traces[i + 1];
    
    const currentCity = extractCity(current.location || current.city);
    const nextCity = extractCity(next.location || next.city);
    
    if (!currentCity || !nextCity) {
      continue;
    }
    
    if (isAbstractLocation(currentCity) || isAbstractLocation(nextCity)) {
      continue;
    }
    
    if (currentCity === nextCity || isSameLocation(currentCity, nextCity)) {
      continue;
    }
    
    const currentTime = parseDate(current.time || current.timestamp);
    const nextTime = parseDate(next.time || next.timestamp);
    
    const timeDiffHours = nextTime.diff(currentTime, 'hours', true);
    
    if (timeDiffHours <= 0) {
      anomalies.push({
        type: ANOMALY_TYPES.CITY_JUMP,
        severity: 'high',
        message: `城市跳点：从「${currentCity}」跳转到「${nextCity}」，时间差异常`,
        details: {
          fromCity: currentCity,
          toCity: nextCity,
          fromTrace: current,
          toTrace: next,
          timeDiffHours
        }
      });
      continue;
    }
    
    const cityCodes = {
      '北京': 1, '上海': 2, '广州': 3, '深圳': 4, '杭州': 5, '南京': 6,
      '苏州': 7, '成都': 8, '重庆': 9, '武汉': 10, '西安': 11, '天津': 12,
      '郑州': 13, '长沙': 14, '青岛': 15, '大连': 16, '厦门': 17, '福州': 18,
      '济南': 19, '合肥': 20, '南昌': 21, '南宁': 22, '昆明': 23, '贵阳': 24,
      '兰州': 25, '西宁': 26, '银川': 27, '乌鲁木齐': 28, '拉萨': 29,
      '海口': 30, '三亚': 31
    };
    
    const distanceEstimates = {
      '北京-上海': 1200, '北京-广州': 1900, '北京-深圳': 2100,
      '北京-杭州': 1100, '北京-成都': 1500, '北京-重庆': 1400,
      '上海-广州': 1200, '上海-深圳': 1400, '上海-杭州': 150,
      '上海-成都': 1700, '上海-重庆': 1700,
      '广州-深圳': 100, '广州-成都': 1300, '广州-重庆': 1200,
      '成都-重庆': 300, '北京-武汉': 1000, '上海-武汉': 700,
      '广州-武汉': 800, '成都-武汉': 1000, '北京-西安': 900,
      '上海-西安': 1300, '广州-西安': 1400
    };
    
    const key1 = `${currentCity}-${nextCity}`;
    const key2 = `${nextCity}-${currentCity}`;
    const estimatedDistance = distanceEstimates[key1] || distanceEstimates[key2] || 1000;
    
    const estimatedSpeed = estimatedDistance / timeDiffHours;
    
    if (estimatedSpeed > MIN_SPEED_KMH && timeDiffHours < 24) {
      anomalies.push({
        type: ANOMALY_TYPES.CITY_JUMP,
        severity: 'high',
        message: `城市跳点：从「${currentCity}」到「${nextCity}」，估算速度约 ${Math.round(estimatedSpeed)} km/h，时间仅 ${timeDiffHours.toFixed(1)} 小时`,
        details: {
          fromCity: currentCity,
          toCity: nextCity,
          fromTrace: current,
          toTrace: next,
          estimatedDistance,
          estimatedSpeed,
          timeDiffHours
        }
      });
    }
  }
  
  return anomalies;
}

function detectDuplicateScans(traces) {
  const anomalies = [];
  const seen = new Map();
  
  traces.forEach((trace, index) => {
    const key = JSON.stringify({
      status: trace.status,
      location: trace.location || trace.city,
      time: formatDate(trace.time || trace.timestamp),
      operator: trace.operatorId || trace.operator
    });
    
    if (seen.has(key)) {
      const previousIndex = seen.get(key);
      
      anomalies.push({
        type: ANOMALY_TYPES.DUPLICATE_SCAN,
        severity: 'medium',
        message: `重复扫描：第 ${previousIndex + 1} 条与第 ${index + 1} 条记录相同`,
        details: {
          firstTrace: traces[previousIndex],
          secondTrace: trace,
          firstIndex: previousIndex,
          secondIndex: index
        }
      });
    } else {
      seen.set(key, index);
    }
  });
  
  return anomalies;
}

function detectTimeReversals(traces) {
  const anomalies = [];
  
  for (let i = 0; i < traces.length - 1; i++) {
    const current = traces[i];
    const next = traces[i + 1];
    
    const currentTime = parseDate(current.time || current.timestamp);
    const nextTime = parseDate(next.time || next.timestamp);
    
    if (nextTime.isBefore(currentTime)) {
      const timeDiff = currentTime.diff(nextTime, 'minutes');
      
      anomalies.push({
        type: ANOMALY_TYPES.TIME_REVERSAL,
        severity: 'medium',
        message: `时间倒流：第 ${i + 2} 条记录时间比第 ${i + 1} 条早 ${timeDiff} 分钟`,
        details: {
          earlierTrace: next,
          laterTrace: current,
          earlierIndex: i + 1,
          laterIndex: i,
          timeDiffMinutes: timeDiff
        }
      });
    }
  }
  
  return anomalies;
}

function detectInvalidStatusTransitions(traces) {
  const anomalies = [];
  
  for (let i = 0; i < traces.length - 1; i++) {
    const current = traces[i];
    const next = traces[i + 1];
    
    if (!isStatusTransitionValid(current.status, next.status)) {
      anomalies.push({
        type: ANOMALY_TYPES.INVALID_STATUS_TRANSITION,
        severity: 'medium',
        message: `状态流转异常：${current.status} 不能直接转换到 ${next.status}`,
        details: {
          fromStatus: current.status,
          toStatus: next.status,
          fromTrace: current,
          toTrace: next
        }
      });
    }
  }
  
  return anomalies;
}

function validatePackage(traces) {
  if (!Array.isArray(traces) || traces.length === 0) {
    return {
      result: VALIDATION_RESULT.ERROR,
      anomalies: [],
      summary: {
        total: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    };
  }
  
  const allAnomalies = [];
  
  allAnomalies.push(...detectSignedBeforeCollect(traces));
  allAnomalies.push(...detectCityJumps(traces));
  allAnomalies.push(...detectDuplicateScans(traces));
  allAnomalies.push(...detectTimeReversals(traces));
  allAnomalies.push(...detectInvalidStatusTransitions(traces));
  
  const summary = {
    total: allAnomalies.length,
    high: allAnomalies.filter(a => a.severity === 'high').length,
    medium: allAnomalies.filter(a => a.severity === 'medium').length,
    low: allAnomalies.filter(a => a.severity === 'low').length
  };
  
  let result = VALIDATION_RESULT.VALID;
  if (summary.high > 0) {
    result = VALIDATION_RESULT.ERROR;
  } else if (summary.medium > 0) {
    result = VALIDATION_RESULT.WARNING;
  }
  
  return {
    result,
    anomalies: allAnomalies,
    summary,
    traceCount: traces.length,
    firstTrace: traces[0],
    lastTrace: traces[traces.length - 1]
  };
}

module.exports = {
  isStatusTransitionValid,
  detectSignedBeforeCollect,
  detectCityJumps,
  detectDuplicateScans,
  detectTimeReversals,
  detectInvalidStatusTransitions,
  validatePackage
};
