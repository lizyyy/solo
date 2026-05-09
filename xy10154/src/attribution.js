const { parseDate, formatDate, extractCity } = require('./utils');
const { 
  ANOMALY_TYPES, 
  ANOMALY_NAMES, 
  ANOMALY_SEVERITY,
  ANOMALY_CAUSES,
  ANOMALY_SUGGESTIONS 
} = require('./constants');

function analyzeSignedBeforeCollect(anomaly, traces) {
  const details = anomaly.details || {};
  const causes = [];
  const evidence = [];
  const suggestions = [];
  
  if (details.timeDiffHours) {
    if (details.timeDiffHours > 24) {
      causes.push('数据导入顺序错误可能性高');
      evidence.push(`签收比揽收早 ${details.timeDiffHours} 小时，超过合理范围`);
    } else {
      causes.push('可能是系统时间同步问题');
      evidence.push(`时间差 ${details.timeDiffHours} 小时，可能是不同设备时间不同步`);
    }
  }
  
  if (details.deliveredTrace && details.collectedTrace) {
    const deliveredOp = details.deliveredTrace.operatorId || details.deliveredTrace.operator;
    const collectedOp = details.collectedTrace.operatorId || details.collectedTrace.operator;
    
    if (deliveredOp && collectedOp && deliveredOp !== collectedOp) {
      causes.push('可能是不同操作人员操作顺序混乱');
      evidence.push(`签收操作员: ${deliveredOp}, 揽收操作员: ${collectedOp}`);
    }
    
    const deliveredDevice = details.deliveredTrace.deviceId || details.deliveredTrace.device;
    const collectedDevice = details.collectedTrace.deviceId || details.collectedTrace.device;
    
    if (deliveredDevice && collectedDevice && deliveredDevice !== collectedDevice) {
      causes.push('不同扫描设备可能存在时间不同步');
      evidence.push(`签收设备: ${deliveredDevice}, 揽收设备: ${collectedDevice}`);
    }
  }
  
  if (causes.length === 0) {
    causes.push(...ANOMALY_CAUSES[ANOMALY_TYPES.SIGNED_BEFORE_COLLECT].slice(0, 2));
  }
  
  suggestions.push(...ANOMALY_SUGGESTIONS[ANOMALY_TYPES.SIGNED_BEFORE_COLLECT].slice(0, 2));
  
  return {
    ...anomaly,
    name: ANOMALY_NAMES[anomaly.type],
    severity: ANOMALY_SEVERITY[anomaly.type],
    confidence: causes.length > 2 ? 'high' : 'medium',
    causes,
    evidence,
    suggestions,
    actionPriority: 'P0'
  };
}

function analyzeCityJump(anomaly, traces) {
  const details = anomaly.details || {};
  const causes = [];
  const evidence = [];
  const suggestions = [];
  
  if (details.estimatedSpeed) {
    if (details.estimatedSpeed > 1000) {
      causes.push('极有可能是物流网点编码错误或录入错误');
      evidence.push(`估算速度 ${Math.round(details.estimatedSpeed)} km/h，远超正常物流速度`);
    } else if (details.estimatedSpeed > 500) {
      causes.push('可能是分拣错误导致错发');
      evidence.push(`速度异常高（${Math.round(details.estimatedSpeed)} km/h），可能被错误分拣`);
    }
  }
  
  if (details.fromCity && details.toCity) {
    causes.push('GPS定位漂移或中转信息录入错误');
    evidence.push(`城市变化: ${details.fromCity} -> ${details.toCity}`);
  }
  
  if (details.timeDiffHours !== undefined && details.timeDiffHours <= 0) {
    causes.push('同时存在时间倒流问题');
    evidence.push(`时间差异常: ${details.timeDiffHours} 小时`);
  }
  
  if (causes.length === 0) {
    causes.push(...ANOMALY_CAUSES[ANOMALY_TYPES.CITY_JUMP].slice(0, 2));
  }
  
  suggestions.push(...ANOMALY_SUGGESTIONS[ANOMALY_TYPES.CITY_JUMP].slice(0, 2));
  
  return {
    ...anomaly,
    name: ANOMALY_NAMES[anomaly.type],
    severity: ANOMALY_SEVERITY[anomaly.type],
    confidence: details.estimatedSpeed > 1000 ? 'high' : 'medium',
    causes,
    evidence,
    suggestions,
    actionPriority: 'P0'
  };
}

function analyzeDuplicateScan(anomaly, traces) {
  const details = anomaly.details || {};
  const causes = [];
  const evidence = [];
  const suggestions = [];
  
  if (details.firstTrace && details.secondTrace) {
    const timeDiff = parseDate(details.secondTrace.time || details.secondTrace.timestamp)
      .diff(parseDate(details.firstTrace.time || details.firstTrace.timestamp), 'seconds');
    
    if (timeDiff < 60) {
      causes.push('扫描设备重复触发');
      evidence.push(`两次扫描间隔仅 ${timeDiff} 秒，可能是设备故障`);
    } else if (timeDiff < 300) {
      causes.push('操作人员可能重复扫描');
      evidence.push(`间隔 ${timeDiff} 秒，可能是操作人员误操作`);
    } else {
      causes.push('可能是数据重复导入');
      evidence.push(`间隔 ${timeDiff} 秒，可能是批次重复导入`);
    }
  }
  
  if (causes.length === 0) {
    causes.push(...ANOMALY_CAUSES[ANOMALY_TYPES.DUPLICATE_SCAN].slice(0, 2));
  }
  
  suggestions.push(...ANOMALY_SUGGESTIONS[ANOMALY_TYPES.DUPLICATE_SCAN].slice(0, 2));
  
  return {
    ...anomaly,
    name: ANOMALY_NAMES[anomaly.type],
    severity: ANOMALY_SEVERITY[anomaly.type],
    confidence: 'medium',
    causes,
    evidence,
    suggestions,
    actionPriority: 'P2'
  };
}

function analyzeTimeReversal(anomaly, traces) {
  const details = anomaly.details || {};
  const causes = [];
  const evidence = [];
  const suggestions = [];
  
  if (details.timeDiffMinutes) {
    if (details.timeDiffMinutes > 60) {
      causes.push('系统时区设置错误或不同设备时间未同步');
      evidence.push(`时间倒流 ${details.timeDiffMinutes} 分钟，可能是时区问题`);
    } else {
      causes.push('可能是数据延迟上报');
      evidence.push(`时间差 ${details.timeDiffMinutes} 分钟，可能是网络延迟`);
    }
  }
  
  if (details.earlierTrace && details.laterTrace) {
    const earlierOp = details.earlierTrace.operatorId || details.earlierTrace.operator;
    const laterOp = details.laterTrace.operatorId || details.laterTrace.operator;
    
    if (earlierOp && laterOp && earlierOp !== laterOp) {
      causes.push('不同操作人员的设备时间不同步');
      evidence.push(`涉及不同操作员: ${earlierOp} 和 ${laterOp}`);
    }
  }
  
  if (causes.length === 0) {
    causes.push(...ANOMALY_CAUSES[ANOMALY_TYPES.TIME_REVERSAL].slice(0, 2));
  }
  
  suggestions.push(...ANOMALY_SUGGESTIONS[ANOMALY_TYPES.TIME_REVERSAL].slice(0, 2));
  
  return {
    ...anomaly,
    name: ANOMALY_NAMES[anomaly.type],
    severity: ANOMALY_SEVERITY[anomaly.type],
    confidence: 'medium',
    causes,
    evidence,
    suggestions,
    actionPriority: 'P1'
  };
}

function analyzeInvalidStatusTransition(anomaly, traces) {
  const details = anomaly.details || {};
  const causes = [];
  const evidence = [];
  const suggestions = [];
  
  if (details.fromStatus && details.toStatus) {
    evidence.push(`状态流转: ${details.fromStatus} -> ${details.toStatus}`);
    
    if (details.toStatus === 'DELIVERED' && details.fromStatus !== 'DELIVERING') {
      causes.push('可能是跳过了派送环节或状态编码错误');
      evidence.push('未经过派送中状态直接签收');
    }
    
    if (details.fromStatus === 'DELIVERED') {
      causes.push('已签收后又有新状态，可能是数据重复');
      evidence.push('签收状态后还有新轨迹');
    }
  }
  
  if (details.toTrace && details.fromTrace) {
    if (details.toTrace.operatorId === 'system' || details.toTrace.operator === 'system') {
      causes.push('系统状态机配置错误');
      evidence.push('涉及系统自动操作');
    }
  }
  
  if (causes.length === 0) {
    causes.push(...ANOMALY_CAUSES[ANOMALY_TYPES.INVALID_STATUS_TRANSITION].slice(0, 2));
  }
  
  suggestions.push(...ANOMALY_SUGGESTIONS[ANOMALY_TYPES.INVALID_STATUS_TRANSITION].slice(0, 2));
  
  return {
    ...anomaly,
    name: ANOMALY_NAMES[anomaly.type],
    severity: ANOMALY_SEVERITY[anomaly.type],
    confidence: 'medium',
    causes,
    evidence,
    suggestions,
    actionPriority: 'P1'
  };
}

function analyzeMissingCollect(anomaly, traces) {
  const details = anomaly.details || {};
  const causes = [];
  const evidence = [];
  const suggestions = [];
  
  if (traces.length > 0) {
    const firstTrace = traces[0];
    if (firstTrace.status !== 'CREATED') {
      causes.push('揽收环节漏扫或数据缺失');
      evidence.push(`第一条记录状态为 ${firstTrace.status}，不是正常的已下单或已揽收`);
    }
  }
  
  const hasTransit = traces.some(t => t.status === 'IN_TRANSIT' || t.status === 'ARRIVED');
  if (hasTransit) {
    causes.push('可能是分拣中心直达跳过揽收扫描');
    evidence.push('存在运输/到达记录但无揽收记录');
  }
  
  if (causes.length === 0) {
    causes.push(...ANOMALY_CAUSES[ANOMALY_TYPES.MISSING_COLLECT].slice(0, 2));
  }
  
  suggestions.push(...ANOMALY_SUGGESTIONS[ANOMALY_TYPES.MISSING_COLLECT].slice(0, 2));
  
  return {
    ...anomaly,
    name: ANOMALY_NAMES[anomaly.type],
    severity: ANOMALY_SEVERITY[anomaly.type],
    confidence: 'medium',
    causes,
    evidence,
    suggestions,
    actionPriority: 'P0'
  };
}

const analyzers = {
  [ANOMALY_TYPES.SIGNED_BEFORE_COLLECT]: analyzeSignedBeforeCollect,
  [ANOMALY_TYPES.CITY_JUMP]: analyzeCityJump,
  [ANOMALY_TYPES.DUPLICATE_SCAN]: analyzeDuplicateScan,
  [ANOMALY_TYPES.TIME_REVERSAL]: analyzeTimeReversal,
  [ANOMALY_TYPES.INVALID_STATUS_TRANSITION]: analyzeInvalidStatusTransition,
  [ANOMALY_TYPES.MISSING_COLLECT]: analyzeMissingCollect
};

function attributeAnomalies(anomalies, traces) {
  return anomalies.map(anomaly => {
    const analyzer = analyzers[anomaly.type];
    if (analyzer) {
      return analyzer(anomaly, traces);
    }
    return {
      ...anomaly,
      name: ANOMALY_NAMES[anomaly.type] || anomaly.type,
      severity: ANOMALY_SEVERITY[anomaly.type] || 'medium',
      confidence: 'low',
      causes: ANOMALY_CAUSES[anomaly.type] || [],
      evidence: [],
      suggestions: ANOMALY_SUGGESTIONS[anomaly.type] || [],
      actionPriority: 'P2'
    };
  });
}

module.exports = {
  attributeAnomalies
};
