const helpers = require('../utils/helpers');
const storage = require('./storage');

function calculateSummary(data) {
  const reservation = data.reservation || [];
  const actual = data.actual || [];
  const cancel = data.cancel || [];
  const extra = data.extra || [];
  const leftover = data.leftover || [];
  const cost = data.cost || [];
  
  const totalReservation = reservation.reduce((sum, r) => sum + (r.headcount || 0), 0);
  const totalActual = actual.reduce((sum, a) => sum + (a.actualCount || 0), 0);
  const totalCancel = cancel.reduce((sum, c) => sum + (c.cancelCount || 0), 0);
  const totalExtra = extra.reduce((sum, e) => sum + (e.extraCount || 0), 0);
  
  const effectiveReservation = totalReservation - totalCancel + totalExtra;
  
  const leftoverWeight = leftover.reduce((sum, l) => sum + (l.weight || 0), 0);
  
  const costMap = {};
  cost.forEach(c => {
    costMap[c.dish] = c.unitCost;
  });
  
  const leftoverCost = leftover.reduce((sum, l) => {
    const unitCost = costMap[l.dish] || 0;
    return sum + (l.weight || 0) * unitCost;
  }, 0);
  
  const attendanceRate = effectiveReservation > 0 ? totalActual / effectiveReservation : 0;
  const cancelRate = totalReservation > 0 ? totalCancel / totalReservation : 0;
  
  const lateCancels = cancel.filter(c => {
    const cutoff = c.cutOffTime || '10:00';
    return !helpers.isTimeBefore(c.cancelTime, cutoff);
  });
  const lateCancelCount = lateCancels.reduce((sum, c) => sum + (c.cancelCount || 0), 0);
  const lateCancelRate = totalCancel > 0 ? lateCancelCount / totalCancel : 0;
  
  return {
    totalReservation,
    totalActual,
    totalCancel,
    totalExtra,
    effectiveReservation,
    leftoverWeight: helpers.formatNumber(leftoverWeight),
    leftoverCost: helpers.formatNumber(leftoverCost),
    attendanceRate: helpers.formatPercent(attendanceRate),
    cancelRate: helpers.formatPercent(cancelRate),
    lateCancelRate: helpers.formatPercent(lateCancelRate)
  };
}

function generateAnalysis(data, summary) {
  const analysis = [];
  const leftover = data.leftover || [];
  
  if (leftover.length > 0) {
    const sortedLeftover = [...leftover].sort((a, b) => (b.weight || 0) - (a.weight || 0));
    const heavyLeftovers = sortedLeftover.filter(l => (l.weight || 0) >= 3);
    
    if (heavyLeftovers.length > 0) {
      const dishes = heavyLeftovers.map(l => `${l.dish}(${l.weight}kg)`).join(', ');
      analysis.push(`大量剩菜菜品: ${dishes}`);
    }
  }
  
  const actual = data.actual || [];
  const reservation = data.reservation || [];
  const extra = data.extra || [];
  
  const resByKey = {};
  reservation.forEach(r => {
    const key = `${r.department}_${r.mealType}`;
    resByKey[key] = (resByKey[key] || 0) + (r.headcount || 0);
  });
  
  const extraByKey = {};
  extra.forEach(e => {
    const key = `${e.department}_${e.mealType}`;
    extraByKey[key] = (extraByKey[key] || 0) + (e.extraCount || 0);
  });
  
  const actualByKey = {};
  actual.forEach(a => {
    const key = `${a.department}_${a.mealType}`;
    actualByKey[key] = (actualByKey[key] || 0) + (a.actualCount || 0);
  });
  
  Object.keys(actualByKey).forEach(key => {
    const actualCount = actualByKey[key];
    const resCount = resByKey[key] || 0;
    const extraCount = extraByKey[key] || 0;
    
    if (actualCount > resCount + extraCount) {
      analysis.push(`部门取餐超预约: ${key}, 实际${actualCount}人, 预约+加餐${resCount + extraCount}人`);
    }
  });
  
  return analysis;
}

function generateSuggestions(data, summary, yesterdaySummary = null) {
  const suggestions = [];
  const leftoverWeight = parseFloat(summary.leftoverWeight);
  const attendanceRate = parseFloat(summary.attendanceRate) / 100;
  
  if (yesterdaySummary) {
    const yesterdayLeftover = parseFloat(yesterdaySummary.leftoverWeight);
    const yesterdayAttendance = parseFloat(yesterdaySummary.attendanceRate) / 100;
    
    if (yesterdayLeftover > 0) {
      const leftoverChange = ((leftoverWeight - yesterdayLeftover) / yesterdayLeftover) * 100;
      
      if (leftoverChange < 0) {
        suggestions.push(`趋势向好：剩菜量较昨日减少${Math.abs(Math.round(leftoverChange))}%`);
      } else if (leftoverChange > 0) {
        suggestions.push(`需注意：剩菜量较昨日增加${Math.round(leftoverChange)}%`);
      }
      
      const attendanceChange = (attendanceRate - yesterdayAttendance) * 100;
      
      if (leftoverWeight < yesterdayLeftover && attendanceRate > yesterdayAttendance) {
        suggestions.push(
          `相比昨日，剩菜减少${Math.abs(Math.round(leftoverChange))}%，到岗率提升${Math.round(attendanceChange * 10) / 10}个百分点，优化方向正确，继续保持`
        );
      }
    }
  }
  
  if (leftoverWeight > 20) {
    suggestions.push(`今日剩菜量过大(${leftoverWeight}kg)，建议明日基础采购量减少${Math.min(15, Math.round(leftoverWeight / 2))}%`);
  } else if (leftoverWeight > 10) {
    suggestions.push(`今日剩菜量较大(${leftoverWeight}kg)，建议明日基础采购量减少${Math.round(leftoverWeight / 2)}%`);
  } else if (leftoverWeight > 5) {
    suggestions.push(`今日剩菜量适中(${leftoverWeight}kg)，建议明日基础采购量减少3%`);
  } else if (leftoverWeight < 2) {
    suggestions.push(`今日剩菜量较少(${leftoverWeight}kg)，需关注是否存在缺菜情况，建议明日采购量维持或微调+2%`);
  }
  
  if (attendanceRate < 0.85) {
    suggestions.push(`今日到岗率偏低(${summary.attendanceRate})，建议明日进一步关注预约准确性`);
  }
  
  const lateCancelRate = parseFloat(summary.lateCancelRate) / 100;
  if (lateCancelRate > 0.1) {
    suggestions.push(`今日晚退餐比例较高(${summary.lateCancelRate})，建议加强退餐截止时间提醒`);
  }
  
  return suggestions;
}

function analyze(date, data) {
  const summary = calculateSummary(data);
  const analysis = generateAnalysis(data, summary);
  
  const yesterday = helpers.getYesterday(date);
  const yesterdayRecord = storage.getConfirmed(yesterday);
  const yesterdaySummary = yesterdayRecord?.review?.summary || null;
  
  const suggestions = generateSuggestions(data, summary, yesterdaySummary);
  
  return {
    summary,
    analysis,
    suggestions
  };
}

module.exports = {
  calculateSummary,
  generateAnalysis,
  generateSuggestions,
  analyze
};
