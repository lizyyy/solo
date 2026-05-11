const dayjs = require('dayjs');

const TYPES = {
  DELIVERY: 'delivery',
  RETURN: 'return',
  REFUND: 'refund',
  HISTORY: 'history'
};

function createDeliveryRecord(record) {
  const customer = record.customer || '';
  const phone = record.phone || '';
  const deliveryDate = parseDate(record.deliveryDate || record.date);
  const bucketCount = parseInt(record.bucketCount || record.buckets || '0', 10);
  
  const stableId = record.orderNo || generateDeliveryId(customer, phone, deliveryDate, bucketCount);
  
  return {
    type: TYPES.DELIVERY,
    id: stableId,
    orderNo: record.orderNo || '',
    customer: customer,
    phone: phone,
    bucketCount: bucketCount,
    depositPerBucket: parseFloat(record.depositPerBucket || '0'),
    totalDeposit: parseFloat(record.totalDeposit || '0'),
    deliveryPerson: record.deliveryPerson || record.driver || '',
    deliveryDate: deliveryDate,
    status: record.status || 'pending',
    notes: record.notes || '',
    importedAt: new Date().toISOString()
  };
}

function createReturnRecord(record) {
  const customer = record.customer || '';
  const phone = record.phone || '';
  const returnDate = parseDate(record.returnDate || record.date);
  const bucketCount = parseInt(record.bucketCount || record.buckets || '0', 10);
  
  const stableId = record.returnNo || generateReturnId(customer, phone, returnDate, bucketCount);
  
  return {
    type: TYPES.RETURN,
    id: stableId,
    returnNo: record.returnNo || '',
    customer: customer,
    phone: phone,
    bucketCount: bucketCount,
    returnPerson: record.returnPerson || record.receiver || '',
    returnDate: returnDate,
    relatedDeliveryNo: record.relatedDeliveryNo || '',
    status: record.status || 'pending',
    notes: record.notes || '',
    importedAt: new Date().toISOString()
  };
}

function createRefundRecord(record) {
  const customer = record.customer || '';
  const phone = record.phone || '';
  const refundDate = parseDate(record.refundDate || record.date);
  const bucketCount = parseInt(record.bucketCount || record.buckets || '0', 10);
  const refundAmount = parseFloat(record.refundAmount || '0');
  
  const stableId = record.refundNo || generateRefundId(customer, phone, refundDate, bucketCount, refundAmount);
  
  return {
    type: TYPES.REFUND,
    id: stableId,
    refundNo: record.refundNo || '',
    customer: customer,
    phone: phone,
    refundAmount: refundAmount,
    bucketCount: bucketCount,
    applicant: record.applicant || '',
    refundDate: refundDate,
    relatedReturnNo: record.relatedReturnNo || '',
    status: record.status || 'pending',
    notes: record.notes || '',
    importedAt: new Date().toISOString()
  };
}

function createHistoryRecord(record) {
  const customer = record.customer || '';
  const phone = record.phone || '';
  const asOfDate = parseDate(record.asOfDate || record.date);
  
  const stableId = record.id || generateHistoryId(customer, phone, asOfDate);
  
  return {
    type: TYPES.HISTORY,
    id: stableId,
    customer: customer,
    phone: phone,
    owedBuckets: parseInt(record.owedBuckets || '0', 10),
    owedDeposit: parseFloat(record.owedDeposit || '0'),
    asOfDate: asOfDate,
    source: record.source || '历史导入',
    notes: record.notes || '',
    importedAt: new Date().toISOString()
  };
}

function generateHistoryId(customer, phone, asOfDate) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const shortPhone = cleanPhone.length > 4 ? cleanPhone.slice(-4) : cleanPhone;
  const customerKey = (customer || 'UNKNOWN').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').slice(0, 10);
  return `HIST-${customerKey}-${shortPhone}-${asOfDate}`;
}

function generateDeliveryId(customer, phone, deliveryDate, bucketCount) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const shortPhone = cleanPhone.length > 4 ? cleanPhone.slice(-4) : cleanPhone;
  const customerKey = (customer || 'UNKNOWN').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').slice(0, 10);
  return `DLV-${customerKey}-${shortPhone}-${deliveryDate}-${bucketCount}`;
}

function generateReturnId(customer, phone, returnDate, bucketCount) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const shortPhone = cleanPhone.length > 4 ? cleanPhone.slice(-4) : cleanPhone;
  const customerKey = (customer || 'UNKNOWN').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').slice(0, 10);
  return `RTN-${customerKey}-${shortPhone}-${returnDate}-${bucketCount}`;
}

function generateRefundId(customer, phone, refundDate, bucketCount, refundAmount) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const shortPhone = cleanPhone.length > 4 ? cleanPhone.slice(-4) : cleanPhone;
  const customerKey = (customer || 'UNKNOWN').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').slice(0, 10);
  const amountKey = Math.round(refundAmount * 100);
  return `RFD-${customerKey}-${shortPhone}-${refundDate}-${bucketCount}-${amountKey}`;
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
