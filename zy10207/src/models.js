const dayjs = require('dayjs');

const TYPES = {
  DELIVERY: 'delivery',
  RETURN: 'return',
  REFUND: 'refund',
  HISTORY: 'history'
};

function createDeliveryRecord(record) {
  return {
    type: TYPES.DELIVERY,
    id: record.orderNo || generateId(),
    orderNo: record.orderNo || '',
    customer: record.customer || '',
    phone: record.phone || '',
    bucketCount: parseInt(record.bucketCount || record.buckets || '0', 10),
    depositPerBucket: parseFloat(record.depositPerBucket || '0'),
    totalDeposit: parseFloat(record.totalDeposit || '0'),
    deliveryPerson: record.deliveryPerson || record.driver || '',
    deliveryDate: parseDate(record.deliveryDate || record.date),
    status: record.status || 'pending',
    notes: record.notes || '',
    importedAt: new Date().toISOString()
  };
}

function createReturnRecord(record) {
  return {
    type: TYPES.RETURN,
    id: record.returnNo || generateId(),
    returnNo: record.returnNo || '',
    customer: record.customer || '',
    phone: record.phone || '',
    bucketCount: parseInt(record.bucketCount || record.buckets || '0', 10),
    returnPerson: record.returnPerson || record.receiver || '',
    returnDate: parseDate(record.returnDate || record.date),
    relatedDeliveryNo: record.relatedDeliveryNo || '',
    status: record.status || 'pending',
    notes: record.notes || '',
    importedAt: new Date().toISOString()
  };
}

function createRefundRecord(record) {
  return {
    type: TYPES.REFUND,
    id: record.refundNo || generateId(),
    refundNo: record.refundNo || '',
    customer: record.customer || '',
    phone: record.phone || '',
    refundAmount: parseFloat(record.refundAmount || '0'),
    bucketCount: parseInt(record.bucketCount || record.buckets || '0', 10),
    applicant: record.applicant || '',
    refundDate: parseDate(record.refundDate || record.date),
    relatedReturnNo: record.relatedReturnNo || '',
    status: record.status || 'pending',
    notes: record.notes || '',
    importedAt: new Date().toISOString()
  };
}

function createHistoryRecord(record) {
  return {
    type: TYPES.HISTORY,
    id: record.id || generateId(),
    customer: record.customer || '',
    phone: record.phone || '',
    owedBuckets: parseInt(record.owedBuckets || '0', 10),
    owedDeposit: parseFloat(record.owedDeposit || '0'),
    asOfDate: parseDate(record.asOfDate || record.date),
    source: record.source || '历史导入',
    notes: record.notes || '',
    importedAt: new Date().toISOString()
  };
}

function generateId() {
  return `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

function parseDate(dateStr) {
  if (!dateStr) return dayjs().format('YYYY-MM-DD');
  const parsed = dayjs(dateStr);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
}

module.exports = {
  TYPES,
  createDeliveryRecord,
  createReturnRecord,
  createRefundRecord,
  createHistoryRecord,
  generateId
};
