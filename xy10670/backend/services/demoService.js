const moment = require('moment');
const orderService = require('./orderService');

const runSuccessPath = async () => {
  const orderData = {
    file_name: '年度报告_v2.pdf',
    page_count: 45,
    paper_size: 'A4',
    binding_type: '无线胶装',
    device_queue: 'HP-M1',
    pickup_promise: moment().add(2, 'hours').format('YYYY-MM-DD HH:mm:ss')
  };

  const { order } = await orderService.createOrder(orderData);
  await orderService.updateOrderStatus(order.id, 'processing', '开始打印', 'demo_user');
  await orderService.updateOrderStatus(order.id, 'success', '打印完成', 'demo_user');
  
  return order;
};

const runBlockedPath = async () => {
  const orderData = {
    file_name: '机密文件_内部使用.pdf',
    page_count: 120,
    paper_size: 'A3',
    binding_type: '精装',
    device_queue: 'Canon-C1',
    pickup_promise: moment().add(4, 'hours').format('YYYY-MM-DD HH:mm:ss')
  };

  const { order } = await orderService.createOrder(orderData);
  await orderService.updateOrderStatus(order.id, 'processing', '开始打印', 'demo_user');
  await orderService.updateOrderStatus(order.id, 'blocked', '检测到敏感内容，需人工审核', 'system');
  
  return order;
};

const runManualCorrectionPath = async () => {
  const orderData = {
    file_name: '产品手册_2024.pdf',
    page_count: 68,
    paper_size: 'A4',
    binding_type: '骑马钉',
    device_queue: 'Xerox-X1',
    pickup_promise: moment().add(3, 'hours').format('YYYY-MM-DD HH:mm:ss')
  };

  const { order } = await orderService.createOrder(orderData);
  await orderService.updateOrderStatus(order.id, 'processing', '开始打印', 'demo_user');
  await orderService.updateOrderStatus(order.id, 'manual_correction', '纸张颜色偏差，需人工调整', 'operator');
  
  return order;
};

const runDuplicateSubmissionPath = async () => {
  const idempotencyKey = 'demo-key-' + Date.now();
  const orderData = {
    file_name: '会议资料_final.pdf',
    page_count: 25,
    paper_size: 'A4',
    binding_type: '环装',
    device_queue: 'HP-M2',
    pickup_promise: moment().add(1, 'hours').format('YYYY-MM-DD HH:mm:ss')
  };

  const result1 = await orderService.createOrder(orderData, idempotencyKey);
  const result2 = await orderService.createOrder(orderData, idempotencyKey);
  
  return {
    firstSubmission: result1,
    secondSubmission: result2
  };
};

const runAllDemos = async () => {
  const successOrder = await runSuccessPath();
  const blockedOrder = await runBlockedPath();
  const manualCorrectionOrder = await runManualCorrectionPath();
  const duplicateResult = await runDuplicateSubmissionPath();

  return {
    successOrder,
    blockedOrder,
    manualCorrectionOrder,
    duplicateResult
  };
};

module.exports = {
  runSuccessPath,
  runBlockedPath,
  runManualCorrectionPath,
  runDuplicateSubmissionPath,
  runAllDemos
};
