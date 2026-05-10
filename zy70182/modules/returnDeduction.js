const { table, generateId, now, getPeriod } = require('../utils/db');
const { logAction } = require('../utils/audit');
const { getSupplier } = require('./rebateRules');
const { getSalesRecord } = require('./salesSummary');

function addReturnRecord(data, operator = 'system') {
  const returns = table('return_records');
  
  if (!data.supplier_id) {
    throw new Error('必须指定供应商');
  }
  
  const supplier = getSupplier(data.supplier_id);
  if (!supplier) {
    throw new Error('供应商不存在');
  }
  
  if (!data.quantity || data.quantity <= 0) {
    throw new Error('退货数量必须大于0');
  }
  
  if (!data.unit_price || data.unit_price <= 0) {
    throw new Error('退货单价必须大于0');
  }
  
  if (!data.return_date) {
    throw new Error('必须指定退货日期');
  }
  
  if (data.sales_record_id) {
    const salesRecord = getSalesRecord(data.sales_record_id);
    if (!salesRecord) {
      throw new Error('关联的销售记录不存在');
    }
    if (salesRecord.supplier_id !== data.supplier_id) {
      throw new Error('销售记录与供应商不匹配');
    }
  }
  
  const recordId = generateId();
  const period = getPeriod(data.return_date);
  const createdAt = now();
  
  const record = returns.insert({
    id: recordId,
    sales_record_id: data.sales_record_id || null,
    supplier_id: data.supplier_id,
    product_sku: data.product_sku || '',
    product_name: data.product_name || '',
    quantity: data.quantity,
    unit_price: data.unit_price,
    return_date: data.return_date,
    reason: data.reason || '',
    period: period,
    created_at: createdAt
  });
  
  logAction('return_record', recordId, 'create', null, { id: recordId, ...data }, operator, '添加退货记录');
  
  return getReturnRecord(recordId);
}

function getReturnRecord(recordId) {
  const returns = table('return_records');
  return returns.findById(recordId);
}

function listReturnRecords(supplierId = null, period = null) {
  const returns = table('return_records');
  let records = [...returns._data];
  
  if (supplierId) {
    records = records.filter(r => r.supplier_id === supplierId);
  }
  
  if (period) {
    records = records.filter(r => r.period === period);
  }
  
  records.sort((a, b) => {
    if (a.return_date !== b.return_date) {
      return new Date(b.return_date) - new Date(a.return_date);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });
  
  return records;
}

function getReturnSummary(supplierId, period) {
  const records = listReturnRecords(supplierId, period);
  
  let totalQuantity = 0;
  let totalAmount = 0;
  
  records.forEach(record => {
    totalQuantity += record.quantity;
    totalAmount += record.quantity * record.unit_price;
  });
  
  return {
    supplier_id: supplierId,
    period,
    record_count: records.length,
    total_quantity: totalQuantity,
    total_amount: totalAmount,
    records
  };
}

module.exports = {
  addReturnRecord,
  getReturnRecord,
  listReturnRecords,
  getReturnSummary
};
