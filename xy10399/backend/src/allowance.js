const { db } = require('./database');

const calculateTransportAllowance = (fromStoreId, toStoreId, date, startTime, endTime) => {
  const details = [];
  let total = 0;

  const [sHour] = startTime.split(':').map(Number);
  const [eHour] = endTime.split(':').map(Number);

  const rule = db.transportAllowanceRules.find(
    r => (r.from_store_id === fromStoreId && r.to_store_id === toStoreId) ||
         (r.from_store_id === toStoreId && r.to_store_id === fromStoreId)
  );

  let baseAmount = rule ? rule.allowance_amount : 0;

  details.push({
    item: '基础交通补贴',
    amount: baseAmount,
    description: `门店间补贴标准`
  });
  total += baseAmount;

  if (sHour < 8 || eHour > 20) {
    const peakHoursBonus = 15;
    details.push({
      item: '高峰时段补贴',
      amount: peakHoursBonus,
      description: '早于8点或晚于20点'
    });
    total += peakHoursBonus;
  }

  const day = new Date(date);
  const dayOfWeek = day.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const weekendBonus = 20;
    details.push({
      item: '周末补贴',
      amount: weekendBonus,
      description: '周六或周日'
    });
    total += weekendBonus;
  }

  const calculateHours = (sTime, eTime) => {
    const [sH, sM] = sTime.split(':').map(Number);
    const [eH, eM] = eTime.split(':').map(Number);
    return (eH * 60 + eM - sH * 60 - sM) / 60;
  };

  const hours = calculateHours(startTime, endTime);
  if (hours > 8) {
    const overtimeBonus = Math.floor((hours - 8) / 2) * 10;
    if (overtimeBonus > 0) {
      details.push({
        item: '超时补贴',
        amount: overtimeBonus,
        description: `工作${hours.toFixed(1)}小时，超过8小时部分`
      });
      total += overtimeBonus;
    }
  }

  return {
    details,
    total,
    breakdown: {
      base: baseAmount,
      peakHours: details.find(d => d.item === '高峰时段补贴')?.amount || 0,
      weekend: details.find(d => d.item === '周末补贴')?.amount || 0,
      overtime: details.find(d => d.item === '超时补贴')?.amount || 0
    }
  };
};

const calculateBatchAllowance = (transfers) => {
  const result = {
    items: [],
    summary: {
      base: 0,
      peakHours: 0,
      weekend: 0,
      overtime: 0,
      total: 0
    }
  };

  transfers.forEach(transfer => {
    const allowance = calculateTransportAllowance(
      transfer.from_store_id,
      transfer.to_store_id,
      transfer.date,
      transfer.start_time,
      transfer.end_time
    );

    result.items.push({
      ...transfer,
      allowance: allowance
    });

    result.summary.base += allowance.breakdown.base;
    result.summary.peakHours += allowance.breakdown.peakHours;
    result.summary.weekend += allowance.breakdown.weekend;
    result.summary.overtime += allowance.breakdown.overtime;
    result.summary.total += allowance.total;
  });

  return result;
};

module.exports = {
  calculateTransportAllowance,
  calculateBatchAllowance
};
