const { parseISO, SHIFT_START_HOUR, SHIFT_NAMES } = require('./validator');

const DEFAULT_CONFIG = {
  doorOpenDurationThreshold: 300,
  temperatureRiseThreshold: 2.0,
  normalTemperatureRange: [-25, -18],
  recoveryTimeThreshold: 1800
};

function processAccessLogs(accessLogs, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const processed = [];
  const warnings = [];
  const doorEvents = new Map();
  
  const sortedLogs = [...accessLogs].sort((a, b) => {
    const da = parseISO(a.data.timestamp);
    const db = parseISO(b.data.timestamp);
    return da - db;
  });
  
  sortedLogs.forEach((log, idx) => {
    const timestamp = parseISO(log.data.timestamp);
    const doorId = log.data.doorId;
    const accessType = log.data.accessType;
    const doorStatus = log.data.doorStatus;
    
    const isOpen = accessType === 'OPEN' || accessType === 'GRANTED' || doorStatus === 'OPEN';
    const isClose = accessType === 'CLOSE' || doorStatus === 'CLOSED';
    
    if (!doorEvents.has(doorId)) {
      doorEvents.set(doorId, { status: 'UNKNOWN', lastChange: null, openCount: 0 });
    }
    
    const doorState = doorEvents.get(doorId);
    
    if (isOpen) {
      if (doorState.status === 'OPEN') {
        warnings.push({
          lineNumber: log.lineNumber,
          message: `门禁 ${doorId} 在未关闭前再次触发开门事件`,
          type: 'sequence_issue'
        });
      }
      doorState.status = 'OPEN';
      doorState.lastChange = timestamp;
      doorState.openCount++;
    } else if (isClose) {
      if (doorState.status !== 'OPEN') {
        warnings.push({
          lineNumber: log.lineNumber,
          message: `门禁 ${doorId} 在未开启状态下触发关门事件`,
          type: 'sequence_issue'
        });
      } else if (doorState.lastChange) {
        const openDuration = (timestamp - doorState.lastChange) / 1000;
        processed.push({
          doorId,
          openTime: doorState.lastChange.toISOString(),
          closeTime: timestamp.toISOString(),
          openDurationSeconds: Math.round(openDuration),
          exceededThreshold: openDuration > cfg.doorOpenDurationThreshold,
          employeeId: log.data.employeeId,
          cardId: log.data.cardId
        });
      }
      doorState.status = 'CLOSED';
      doorState.lastChange = timestamp;
    }
  });
  
  doorEvents.forEach((state, doorId) => {
    if (state.status === 'OPEN') {
      warnings.push({
        message: `门禁 ${doorId} 最终状态为开启，缺少关门记录`,
        type: 'incomplete_cycle'
      });
    }
  });
  
  return { doorOpenEvents: processed, warnings, doorStats: Object.fromEntries(doorEvents) };
}

function analyzeTemperatureCurve(temperatureData, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [minNormal, maxNormal] = cfg.normalTemperatureRange;
  
  const sortedTemps = [...temperatureData].sort((a, b) => {
    const da = parseISO(a.data.timestamp);
    const db = parseISO(b.data.timestamp);
    return da - db;
  });
  
  const result = {
    dataPoints: sortedTemps.length,
    minTemperature: Infinity,
    maxTemperature: -Infinity,
    avgTemperature: 0,
    deviations: [],
    temperatureRises: [],
    reliability: { score: 100, issues: [] }
  };
  
  if (sortedTemps.length === 0) return result;
  
  let sum = 0;
  let lastTemp = null;
  let lastTime = null;
  let continuousDeviation = 0;
  let deviationStart = null;
  
  sortedTemps.forEach((temp, idx) => {
    const timestamp = parseISO(temp.data.timestamp);
    const value = Number(temp.data.temperature);
    
    if (value < result.minTemperature) result.minTemperature = value;
    if (value > result.maxTemperature) result.maxTemperature = value;
    sum += value;
    
    if (value < minNormal || value > maxNormal) {
      if (continuousDeviation === 0) deviationStart = timestamp;
      continuousDeviation++;
    } else {
      if (continuousDeviation > 0) {
        result.deviations.push({
          startTime: deviationStart.toISOString(),
          endTime: lastTime ? lastTime.toISOString() : timestamp.toISOString(),
          durationMinutes: lastTime ? Math.round((lastTime - deviationStart) / 60000) : 0,
          dataPoints: continuousDeviation
        });
        continuousDeviation = 0;
      }
    }
    
    if (lastTemp !== null && lastTime !== null) {
      const tempDiff = value - lastTemp;
      const timeDiff = (timestamp - lastTime) / 60000;
      
      if (tempDiff > cfg.temperatureRiseThreshold) {
        result.temperatureRises.push({
          startTime: lastTime.toISOString(),
          endTime: timestamp.toISOString(),
          temperatureRise: Math.round(tempDiff * 100) / 100,
          durationMinutes: Math.round(timeDiff)
        });
      }
      
      if (timeDiff > 30) {
        result.reliability.issues.push({
          type: 'large_gap',
          message: `数据间隔超过 30 分钟`,
          between: [lastTime.toISOString(), timestamp.toISOString()]
        });
      }
    }
    
    lastTemp = value;
    lastTime = timestamp;
  });
  
  if (continuousDeviation > 0) {
    result.deviations.push({
      startTime: deviationStart.toISOString(),
      endTime: lastTime ? lastTime.toISOString() : null,
      durationMinutes: lastTime ? Math.round((lastTime - deviationStart) / 60000) : 0,
      dataPoints: continuousDeviation
    });
  }
  
  result.avgTemperature = Math.round((sum / sortedTemps.length) * 100) / 100;
  
  const gapPenalty = result.reliability.issues.filter(i => i.type === 'large_gap').length * 10;
  const deviationPenalty = result.deviations.length * 5;
  result.reliability.score = Math.max(0, 100 - gapPenalty - deviationPenalty);
  
  return result;
}

function correlateDoorAndTemperature(doorEvents, tempAnalysis, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const correlations = [];
  
  doorEvents.forEach(event => {
    const openTime = parseISO(event.openTime);
    const closeTime = parseISO(event.closeTime);
    
    const relatedRises = tempAnalysis.temperatureRises.filter(rise => {
      const riseStart = parseISO(rise.startTime);
      const riseEnd = parseISO(rise.endTime);
      return riseStart >= openTime && riseStart <= new Date(closeTime.getTime() + cfg.recoveryTimeThreshold);
    });
    
    if (relatedRises.length > 0 || event.exceededThreshold) {
      correlations.push({
        doorId: event.doorId,
        openTime: event.openTime,
        closeTime: event.closeTime,
        openDurationSeconds: event.openDurationSeconds,
        exceededThreshold: event.exceededThreshold,
        relatedTemperatureRises: relatedRises,
        maxRise: relatedRises.length > 0 
          ? Math.max(...relatedRises.map(r => r.temperatureRise))
          : 0,
        employeeId: event.employeeId,
        cardId: event.cardId
      });
    }
  });
  
  return correlations;
}

function determineShift(timestamp) {
  const date = parseISO(timestamp);
  if (!date) return null;
  
  const hour = date.getHours();
  
  if (hour >= SHIFT_START_HOUR['早班'] && hour < SHIFT_START_HOUR['中班']) {
    return '早班';
  } else if (hour >= SHIFT_START_HOUR['中班'] && hour < SHIFT_START_HOUR['晚班']) {
    return '中班';
  } else {
    return '晚班';
  }
}

function assignShiftToCorrelations(correlations, shiftSchedule = []) {
  const shiftMap = new Map();
  
  shiftSchedule.forEach(shift => {
    const key = `${shift.data.date}_${shift.data.shiftName}`;
    shiftMap.set(key, shift.data);
  });
  
  return correlations.map(corr => {
    const shiftName = determineShift(corr.openTime);
    const openDate = parseISO(corr.openTime);
    const dateStr = openDate ? openDate.toISOString().split('T')[0] : null;
    
    let shiftInfo = null;
    if (dateStr && shiftName) {
      const key = `${dateStr}_${shiftName}`;
      shiftInfo = shiftMap.get(key);
    }
    
    return {
      ...corr,
      shift: shiftName,
      shiftDate: dateStr,
      shiftEmployee: shiftInfo ? (shiftInfo.employeeName || shiftInfo.employeeId) : null,
      shiftNeedsManualCheck: !shiftInfo
    };
  });
}

function matchBatchesToEvents(correlationsWithShift, batches) {
  return correlationsWithShift.map(corr => {
    const openTime = parseISO(corr.openTime);
    const closeTime = parseISO(corr.closeTime);
    
    const affectedBatches = batches.filter(batch => {
      const start = batch.data.storageStart ? parseISO(batch.data.storageStart) : null;
      const end = batch.data.storageEnd ? parseISO(batch.data.storageEnd) : null;
      
      if (!start) return false;
      
      const eventTime = closeTime || openTime;
      if (!eventTime) return false;
      
      if (end) {
        return eventTime >= start && eventTime <= end;
      }
      return eventTime >= start;
    });
    
    return {
      ...corr,
      affectedBatches: affectedBatches.map(b => ({
        batchId: b.data.batchId,
        productName: b.data.productName,
        requiredTemp: b.data.requiredTemp,
        needsManualCheck: !b.data.storageEnd
      })),
      manualCheckRequired: affectedBatches.some(b => !b.data.storageEnd) || corr.shiftNeedsManualCheck
    };
  });
}

function generateFinalReport(accessResult, tempAnalysis, correlations, fullMatches) {
  return {
    summary: {
      accessLogsProcessed: accessResult.doorOpenEvents.length + (accessResult.warnings?.length || 0),
      validDoorCycles: accessResult.doorOpenEvents.length,
      temperatureDataPoints: tempAnalysis.dataPoints,
      temperatureRisesDetected: tempAnalysis.temperatureRises.length,
      correlationsFound: correlations.length,
      batchesAffected: fullMatches.reduce((sum, m) => sum + m.affectedBatches.length, 0),
      needsManualReview: fullMatches.filter(m => m.manualCheckRequired).length
    },
    accessWarnings: accessResult.warnings || [],
    temperatureAnalysis: tempAnalysis,
    riskEvents: fullMatches
  };
}

module.exports = {
  DEFAULT_CONFIG,
  processAccessLogs,
  analyzeTemperatureCurve,
  correlateDoorAndTemperature,
  determineShift,
  assignShiftToCorrelations,
  matchBatchesToEvents,
  generateFinalReport
};
