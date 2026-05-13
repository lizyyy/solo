const { Parser } = require('json2csv');
const orderService = require('./orderService');

const exportOrdersToCSV = async (filters = {}) => {
  const orders = await orderService.getOrders(filters);

  const fields = [
    { label: '订单号', value: 'order_no' },
    { label: '文件名', value: 'file_name' },
    { label: '页数', value: 'page_count' },
    { label: '纸张规格', value: 'paper_size' },
    { label: '装订方式', value: 'binding_type' },
    { label: '设备队列', value: 'device_queue' },
    { label: '取件承诺', value: 'pickup_promise' },
    { label: '状态', value: 'status' },
    { label: '返工原因', value: 'rework_reason' },
    { label: '创建时间', value: 'created_at' },
    { label: '更新时间', value: 'updated_at' }
  ];

  const statusMap = {
    'pending': '待处理',
    'processing': '处理中',
    'success': '成功',
    'blocked': '已拦截',
    'manual_correction': '人工修正',
    'failed': '失败',
    'completed': '已完成'
  };

  const data = orders.map(order => ({
    ...order,
    status: statusMap[order.status] || order.status
  }));

  const json2csvParser = new Parser({ fields, encoding: 'utf-8' });
  const csv = json2csvParser.parse(data);

  return '\uFEFF' + csv;
};

const exportTimelineToCSV = async (orderId) => {
  const timeline = await orderService.getTimeline(orderId);

  const fields = [
    { label: '操作类型', value: 'action' },
    { label: '状态', value: 'status' },
    { label: '描述', value: 'description' },
    { label: '操作人', value: 'operator' },
    { label: '操作时间', value: 'created_at' }
  ];

  const statusMap = {
    'pending': '待处理',
    'processing': '处理中',
    'success': '成功',
    'blocked': '已拦截',
    'manual_correction': '人工修正',
    'failed': '失败',
    'completed': '已完成'
  };

  const data = timeline.map(item => ({
    ...item,
    status: statusMap[item.status] || item.status
  }));

  const json2csvParser = new Parser({ fields, encoding: 'utf-8' });
  const csv = json2csvParser.parse(data);

  return '\uFEFF' + csv;
};

module.exports = {
  exportOrdersToCSV,
  exportTimelineToCSV
};
