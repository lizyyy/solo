const { TYPES } = require('./models');
const storage = require('./storage');
const chalk = require('chalk');

function checkDuplicates(newRecords, type) {
  const { all } = storage.getAllData(type);
  const existingIds = new Set(all.map(r => r.id));
  const duplicates = newRecords.filter(r => existingIds.has(r.id));
  
  if (duplicates.length > 0) {
    return {
      hasError: true,
      type: 'DUPLICATE',
      message: `发现 ${duplicates.length} 条重复记录`,
      records: duplicates.map(d => ({ id: d.id, customer: d.customer }))
    };
  }
  return null;
}

function checkBasicValidity(records, type) {
  const errors = [];
  
  records.forEach((record, index) => {
    const issues = [];
    
    if (!record.customer) {
      issues.push('客户名称不能为空');
    }
    
    if (type === TYPES.DELIVERY) {
      if (!record.id) {
        issues.push('订单号不能为空');
      }
      if (record.bucketCount <= 0) {
        issues.push('桶数必须大于0');
      }
      if (record.totalDeposit < 0) {
        issues.push('押金不能为负数');
      }
      if (!record.deliveryPerson) {
        issues.push('配送员不能为空');
      }
    }
    
    if (type === TYPES.RETURN) {
      if (record.bucketCount <= 0) {
        issues.push('回收桶数必须大于0');
      }
    }
    
    if (type === TYPES.REFUND) {
      if (record.refundAmount < 0) {
        issues.push('退款金额不能为负数');
      }
    }
    
    if (issues.length > 0) {
      errors.push({
        type: 'VALIDATION',
        index: index + 1,
        id: record.id,
        customer: record.customer,
        issues
      });
    }
  });
  
  return errors.length > 0 ? errors : null;
}

function runAllChecks() {
  const errors = [];
  const warnings = [];
  
  const deliveries = storage.getAllData(TYPES.DELIVERY).all;
  const returns = storage.getAllData(TYPES.RETURN).all;
  const refunds = storage.getAllData(TYPES.REFUND).all;
  const histories = storage.getAllData(TYPES.HISTORY).all;
  
  errors.push(...checkBasicValidity(deliveries, TYPES.DELIVERY) || []);
  errors.push(...checkBasicValidity(returns, TYPES.RETURN) || []);
  errors.push(...checkBasicValidity(refunds, TYPES.REFUND) || []);
  errors.push(...checkBasicValidity(histories, TYPES.HISTORY) || []);
  
  errors.push(...checkReturnVsDelivery(deliveries, returns, histories));
  errors.push(...checkRefundVsBuckets(deliveries, returns, refunds, histories));
  
  warnings.push(...checkDeliveryPersonDiscrepancy(deliveries, returns));
  
  return { errors, warnings, all: [...errors, ...warnings] };
}

function checkReturnVsDelivery(deliveries, returns, histories) {
  const issues = [];
  
  const customerDeliveryBuckets = {};
  const customerReturnBuckets = {};
  const customerHistoryBuckets = {};
  
  deliveries.forEach(d => {
    const key = `${d.customer}-${d.phone || ''}`;
    customerDeliveryBuckets[key] = (customerDeliveryBuckets[key] || 0) + d.bucketCount;
  });
  
  returns.forEach(r => {
    const key = `${r.customer}-${r.phone || ''}`;
    customerReturnBuckets[key] = (customerReturnBuckets[key] || 0) + r.bucketCount;
  });
  
  histories.forEach(h => {
    const key = `${h.customer}-${h.phone || ''}`;
    customerHistoryBuckets[key] = (customerHistoryBuckets[key] || 0) + h.owedBuckets;
  });
  
  const allCustomers = new Set([
    ...Object.keys(customerDeliveryBuckets),
    ...Object.keys(customerReturnBuckets),
    ...Object.keys(customerHistoryBuckets)
  ]);
  
  allCustomers.forEach(key => {
    const returned = customerReturnBuckets[key] || 0;
    const delivered = customerDeliveryBuckets[key] || 0;
    const historyOwed = customerHistoryBuckets[key] || 0;
    const totalAvailable = delivered + historyOwed;
    
    if (returned > totalAvailable) {
      issues.push({
        type: 'OVER_RETURN',
        message: '回收桶数大于配送+历史欠桶总数',
        customer: key.split('-')[0],
        delivered,
        historyOwed,
        totalAvailable,
        returned,
        excess: returned - totalAvailable
      });
    }
  });
  
  return issues;
}

function checkRefundVsBuckets(deliveries, returns, refunds, histories) {
  const issues = [];
  
  const customerDeliveryBuckets = {};
  const customerReturnBuckets = {};
  const customerHistoryBuckets = {};
  const customerRefundedBuckets = {};
  
  deliveries.forEach(d => {
    const key = `${d.customer}-${d.phone || ''}`;
    customerDeliveryBuckets[key] = (customerDeliveryBuckets[key] || 0) + d.bucketCount;
  });
  
  returns.forEach(r => {
    const key = `${r.customer}-${r.phone || ''}`;
    customerReturnBuckets[key] = (customerReturnBuckets[key] || 0) + r.bucketCount;
  });
  
  histories.forEach(h => {
    const key = `${h.customer}-${h.phone || ''}`;
    customerHistoryBuckets[key] = (customerHistoryBuckets[key] || 0) + h.owedBuckets;
  });
  
  refunds.forEach(r => {
    const key = `${r.customer}-${r.phone || ''}`;
    customerRefundedBuckets[key] = (customerRefundedBuckets[key] || 0) + r.bucketCount;
  });
  
  Object.keys(customerRefundedBuckets).forEach(key => {
    const delivered = customerDeliveryBuckets[key] || 0;
    const returned = customerReturnBuckets[key] || 0;
    const historyOwed = customerHistoryBuckets[key] || 0;
    const refunded = customerRefundedBuckets[key] || 0;
    
    const netOwed = delivered + historyOwed - returned;
    
    if (refunded > 0 && netOwed > 0) {
      issues.push({
        type: 'REFUND_WITHOUT_BUCKETS',
        message: '客户退押金但仍欠桶',
        customer: key.split('-')[0],
        delivered,
        historyOwed,
        returned,
        netOwed,
        refunded
      });
    }
  });
  
  return issues;
}

function checkDeliveryPersonDiscrepancy(deliveries, returns) {
  const issues = [];
  
  const personDelivered = {};
  const personReturned = {};
  
  deliveries.forEach(d => {
    const person = d.deliveryPerson;
    if (person) {
      personDelivered[person] = (personDelivered[person] || 0) + d.bucketCount;
    }
  });
  
  returns.forEach(r => {
    const person = r.returnPerson;
    if (person) {
      personReturned[person] = (personReturned[person] || 0) + r.bucketCount;
    }
  });
  
  const allPersons = new Set([
    ...Object.keys(personDelivered),
    ...Object.keys(personReturned)
  ]);
  
  allPersons.forEach(person => {
    const delivered = personDelivered[person] || 0;
    const returned = personReturned[person] || 0;
    const net = delivered - returned;
    
    if (net > 0) {
      issues.push({
        type: 'DELIVERY_PERSON_SHORT',
        message: '配送员漏交空桶',
        person,
        delivered,
        returned,
        unaccounted: net
      });
    }
  });
  
  return issues;
}

module.exports = {
  checkDuplicates,
  checkBasicValidity,
  runAllChecks,
  checkReturnVsDelivery,
  checkRefundVsBuckets,
  checkDeliveryPersonDiscrepancy
};
