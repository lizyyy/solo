const { table, generateId, now, getPeriod } = require('../utils/db');
const { logAction } = require('../utils/audit');
const { getSupplier } = require('./rebateRules');

function addSalesRecord(data, operator = 'system') {
  const sales = table('sales_records');
  
  if (!data.supplier_id) {
    throw new Error('必须指定供应商');
  }
  
  const supplier = getSupplier(data.supplier_id);
  if (!supplier) {
    throw new Error('供应商不存在');
  }
  
  if (!data.quantity || data.quantity <= 0) {
    throw new Error('销量必须大于0');
  }
  
  if (!data.unit_price || data.unit_price <= 0) {
    throw new Error('单价必须大于0');
  }
  
  if (!data.sale_date) {
    throw new Error('必须指定销售日期');
  }
  
  const recordId = generateId();
  const period = getPeriod(data.sale_date);
  const createdAt = now();
  
  const record = sales.insert({
    id: recordId,
    supplier_id: data.supplier_id,
    product_sku: data.product_sku || '',
    product_name: data.product_name || '',
    quantity: data.quantity,
    unit_price: data.unit_price,
    sale_date: data.sale_date,
    period: period,
    created_at: createdAt
  });
  
  logAction('sales_record', recordId, 'create', null, { id: recordId, ...data }, operator, '添加销售记录');
  
  return getSalesRecord(recordId);
}

function getSalesRecord(recordId) {
  const sales = table('sales_records');
  return sales.findById(recordId);
}

function listSalesRecords(supplierId = null, period = null) {
  const sales = table('sales_records');
  let records = [...sales._data];
  
  if (supplierId) {
    records = records.filter(r => r.supplier_id === supplierId);
  }
  
  if (period) {
    records = records.filter(r => r.period === period);
  }
  
  records.sort((a, b) => {
    if (a.sale_date !== b.sale_date) {
      return new Date(b.sale_date) - new Date(a.sale_date);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });
  
  return records;
}

function getSalesSummary(supplierId, period) {
  const records = listSalesRecords(supplierId, period);
  
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
    avg_unit_price: totalQuantity > 0 ? totalAmount / totalQuantity : 0,
    records
  };
}

module.exports = {
  addSalesRecord,
  getSalesRecord,
  listSalesRecords,
  getSalesSummary
};
