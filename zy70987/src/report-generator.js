function generateJSON(batch, items, statistics) {
  const summary = {
    batch_id: batch.id,
    station_id: batch.station_id,
    batch_no: batch.batch_no,
    submitted_at: batch.submitted_at,
    items_count: batch.items_count,
    statistics: {
      total: batch.items_count,
      ...statistics,
      error_rate: calculateErrorRate(items)
    }
  };

  const categorizedItems = {
    normal: filterByCategory(items, '正常'),
    pending_supplement: filterByCategory(items, '待补充'),
    blocked: filterByCategory(items, '已拦截')
  };

  return {
    summary,
    categorized_items: categorizedItems,
    all_items: items.map(item => ({
      row_index: item.row_index,
      item_id: item.item_id,
      waybill_no: item.waybill_no,
      receiver_name: item.receiver_name,
      receiver_phone: item.receiver_phone,
      detained_at: item.detained_at,
      category: item.category,
      reason_code: item.reason_code,
      reason_desc: item.reason_desc,
      action_required: item.action_required,
      action_deadline: item.action_deadline,
      has_errors: item.errors && item.errors.length > 0,
      error_count: item.errors ? item.errors.length : 0
    }))
  };
}

function generateCSV(batch, items, statistics) {
  const headers = [
    '行号',
    '物品ID',
    '运单号',
    '收件人',
    '联系电话',
    '滞留时间',
    '预计自取时间',
    '分类结果',
    '原因代码',
    '原因说明',
    '后续动作',
    '动作截止日期',
    '错误字段',
    '错误信息'
  ];

  const rows = items.map(item => {
    const errorFields = item.errors && item.errors.length > 0 
      ? item.errors.map(e => e.field_name).join('; ') 
      : '';
    const errorMessages = item.errors && item.errors.length > 0
      ? item.errors.map(e => e.error_message).join('; ')
      : '';

    return [
      item.row_index,
      item.item_id,
      item.waybill_no || '',
      item.receiver_name || '',
      item.receiver_phone || '',
      item.detained_at || '',
      item.raw_data?.expected_pickup_at || '',
      item.category || '',
      item.reason_code || '',
      item.reason_desc || '',
      item.action_required || '',
      item.action_deadline || '',
      errorFields,
      errorMessages
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
  });

  const summaryRows = [
    [],
    ['批次汇总'],
    ['批次ID', batch.id],
    ['驿站ID', batch.station_id],
    ['批次号', batch.batch_no],
    ['提交时间', batch.submitted_at],
    ['总数量', batch.items_count],
    ['正常', statistics['正常'] || 0],
    ['待补充', statistics['待补充'] || 0],
    ['已拦截', statistics['已拦截'] || 0],
    ['错误率', calculateErrorRate(items)]
  ].map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));

  return [
    ...summaryRows,
    [],
    headers.join(','),
    ...rows
  ].join('\n');
}

function filterByCategory(items, category) {
  return items
    .filter(item => item.category === category)
    .map(item => ({
      row_index: item.row_index,
      item_id: item.item_id,
      waybill_no: item.waybill_no,
      receiver_name: item.receiver_name,
      receiver_phone: item.receiver_phone,
      detained_at: item.detained_at,
      reason_code: item.reason_code,
      reason_desc: item.reason_desc,
      action_required: item.action_required,
      action_deadline: item.action_deadline
    }));
}

function calculateErrorRate(items) {
  const itemsWithErrors = items.filter(item => item.errors && item.errors.length > 0).length;
  const rate = items.length > 0 ? (itemsWithErrors / items.length * 100).toFixed(2) + '%' : '0%';
  return rate;
}

module.exports = {
  generateJSON,
  generateCSV
};
