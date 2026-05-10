const { TYPES } = require('./models');
const storage = require('./storage');
const dayjs = require('dayjs');
const chalk = require('chalk');

function calculateCustomerOwedBuckets() {
  const deliveries = storage.getAllData(TYPES.DELIVERY).all;
  const returns = storage.getAllData(TYPES.RETURN).all;
  const histories = storage.getAllData(TYPES.HISTORY).all;
  
  const customerStats = {};
  
  histories.forEach(h => {
    const key = `${h.customer}-${h.phone || ''}`;
    if (!customerStats[key]) {
      customerStats[key] = {
        customer: h.customer,
        phone: h.phone,
        delivered: 0,
        returned: 0,
        historyOwed: 0,
        totalDeposit: 0,
        refunded: 0
      };
    }
    customerStats[key].historyOwed += h.owedBuckets;
    customerStats[key].totalDeposit += h.owedDeposit;
  });
  
  deliveries.forEach(d => {
    const key = `${d.customer}-${d.phone || ''}`;
    if (!customerStats[key]) {
      customerStats[key] = {
        customer: d.customer,
        phone: d.phone,
        delivered: 0,
        returned: 0,
        historyOwed: 0,
        totalDeposit: 0,
        refunded: 0
      };
    }
    customerStats[key].delivered += d.bucketCount;
    customerStats[key].totalDeposit += d.totalDeposit;
  });
  
  returns.forEach(r => {
    const key = `${r.customer}-${r.phone || ''}`;
    if (!customerStats[key]) {
      customerStats[key] = {
        customer: r.customer,
        phone: r.phone,
        delivered: 0,
        returned: 0,
        historyOwed: 0,
        totalDeposit: 0,
        refunded: 0
      };
    }
    customerStats[key].returned += r.bucketCount;
  });
  
  const refunds = storage.getAllData(TYPES.REFUND).all;
  refunds.forEach(r => {
    const key = `${r.customer}-${r.phone || ''}`;
    if (!customerStats[key]) {
      customerStats[key] = {
        customer: r.customer,
        phone: r.phone,
        delivered: 0,
        returned: 0,
        historyOwed: 0,
        totalDeposit: 0,
        refunded: 0
      };
    }
    customerStats[key].refunded += r.refundAmount;
  });
  
  const results = Object.values(customerStats).map(s => ({
    ...s,
    netOwed: s.delivered + s.historyOwed - s.returned,
    netDeposit: s.totalDeposit - s.refunded
  }));
  
  return results.sort((a, b) => b.netOwed - a.netOwed);
}

function calculateDeliveryPersonStats() {
  const deliveries = storage.getAllData(TYPES.DELIVERY).all;
  const returns = storage.getAllData(TYPES.RETURN).all;
  
  const personStats = {};
  
  deliveries.forEach(d => {
    const person = d.deliveryPerson;
    if (!person) return;
    
    if (!personStats[person]) {
      personStats[person] = {
        person,
        delivered: 0,
        returned: 0,
        deliveryOrders: 0
      };
    }
    personStats[person].delivered += d.bucketCount;
    personStats[person].deliveryOrders += 1;
  });
  
  returns.forEach(r => {
    const person = r.returnPerson;
    if (!person) return;
    
    if (!personStats[person]) {
      personStats[person] = {
        person,
        delivered: 0,
        returned: 0,
        deliveryOrders: 0
      };
    }
    personStats[person].returned += r.bucketCount;
  });
  
  const results = Object.values(personStats).map(s => ({
    ...s,
    difference: s.delivered - s.returned
  }));
  
  return results.sort((a, b) => b.difference - a.difference);
}

function calculateWeeklyDepositChanges(weeksAgo = 0) {
  const deliveries = storage.getAllData(TYPES.DELIVERY).all;
  const returns = storage.getAllData(TYPES.RETURN).all;
  const refunds = storage.getAllData(TYPES.REFUND).all;
  
  const targetWeekStart = dayjs().subtract(weeksAgo, 'week').startOf('week');
  const targetWeekEnd = dayjs().subtract(weeksAgo, 'week').endOf('week');
  
  const inRange = (date) => {
    const d = dayjs(date);
    return d.isAfter(targetWeekStart) && d.isBefore(targetWeekEnd);
  };
  
  const weeklyDeliveries = deliveries.filter(d => inRange(d.deliveryDate));
  const weeklyRefunds = refunds.filter(r => inRange(r.refundDate));
  
  const depositIn = weeklyDeliveries.reduce((sum, d) => sum + d.totalDeposit, 0);
  const depositOut = weeklyRefunds.reduce((sum, r) => sum + r.refundAmount, 0);
  
  return {
    period: `${targetWeekStart.format('YYYY-MM-DD')} ~ ${targetWeekEnd.format('YYYY-MM-DD')}`,
    deliveryCount: weeklyDeliveries.length,
    refundCount: weeklyRefunds.length,
    depositIn,
    depositOut,
    netChange: depositIn - depositOut
  };
}

module.exports = {
  calculateCustomerOwedBuckets,
  calculateDeliveryPersonStats,
  calculateWeeklyDepositChanges
};
