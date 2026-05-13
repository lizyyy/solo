const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const now = new Date().toISOString();

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function initData() {
  console.log('开始初始化数据...');

  const budgetId1 = uuidv4();
  const budgetId2 = uuidv4();

  await runQuery(
    `INSERT INTO club_budgets (id, club_name, fiscal_year, total_amount, used_amount, remaining_amount, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [budgetId1, '计算机协会', '2024', 50000, 15000, 35000, 'active', 'admin', now, now]
  );

  await runQuery(
    `INSERT INTO club_budgets (id, club_name, fiscal_year, total_amount, used_amount, remaining_amount, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [budgetId2, '文艺社团', '2024', 30000, 8000, 22000, 'active', 'admin', now, now]
  );

  const activityId1 = uuidv4();
  const activityId2 = uuidv4();
  const activityId3 = uuidv4();
  const activityId4 = uuidv4();

  await runQuery(
    `INSERT INTO activity_applications (id, budget_id, activity_name, activity_date, location, expected_participants, estimated_amount, description, status, applicant, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [activityId1, budgetId1, '编程大赛', '2024-06-15', '教学楼A101', 100, 8000, '年度校级编程大赛', 'approved', '张三', now, now]
  );

  await runQuery(
    `INSERT INTO activity_applications (id, budget_id, activity_name, activity_date, location, expected_participants, estimated_amount, description, status, applicant, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [activityId2, budgetId1, '技术分享会', '2024-07-20', '图书馆报告厅', 50, 3000, 'AI技术分享会', 'reviewing', '李四', now, now]
  );

  await runQuery(
    `INSERT INTO activity_applications (id, budget_id, activity_name, activity_date, location, expected_participants, estimated_amount, description, status, applicant, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [activityId3, budgetId2, '迎新晚会', '2024-09-01', '大学生活动中心', 200, 15000, '新生迎新晚会', 'rejected', '王五', now, now]
  );

  await runQuery(
    `INSERT INTO activity_applications (id, budget_id, activity_name, activity_date, location, expected_participants, estimated_amount, description, status, applicant, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [activityId4, budgetId2, '舞蹈培训', '2024-08-10', '舞蹈房', 30, 5000, '暑期舞蹈培训', 'pending', '赵六', now, now]
  );

  const purchaseId1 = uuidv4();
  const purchaseId2 = uuidv4();
  const purchaseId3 = uuidv4();

  await runQuery(
    `INSERT INTO purchase_items (id, activity_id, item_name, quantity, unit_price, total_price, supplier, purchase_date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [purchaseId1, activityId1, '奖杯奖牌', 10, 200, 2000, '奖牌定制店', '2024-06-10', 'approved', now, now]
  );

  await runQuery(
    `INSERT INTO purchase_items (id, activity_id, item_name, quantity, unit_price, total_price, supplier, purchase_date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [purchaseId2, activityId1, '打印资料', 200, 5, 1000, '校园打印店', '2024-06-12', 'approved', now, now]
  );

  await runQuery(
    `INSERT INTO purchase_items (id, activity_id, item_name, quantity, unit_price, total_price, supplier, purchase_date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [purchaseId3, activityId2, '小礼品', 50, 20, 1000, '礼品批发', '2024-07-15', 'pending', now, now]
  );

  const reviewId1 = uuidv4();
  const reviewId2 = uuidv4();

  await runQuery(
    `INSERT INTO invoice_reviews (id, activity_id, invoice_number, invoice_amount, invoice_date, vendor_name, status, reviewer, review_comment, reviewed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [reviewId1, activityId1, 'INV-2024-001', 3000, '2024-06-13', '综合供应商', 'approved', '审核员A', '票据齐全，符合规定', now, now, now]
  );

  await runQuery(
    `INSERT INTO invoice_reviews (id, activity_id, invoice_number, invoice_amount, invoice_date, vendor_name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [reviewId2, activityId2, 'INV-2024-002', 1000, '2024-07-16', '礼品批发', 'pending', now, now]
  );

  const supplementId1 = uuidv4();

  await runQuery(
    `INSERT INTO supplement_requests (id, review_id, request_type, description, status, requested_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [supplementId1, reviewId2, 'missing_invoice', '缺少购物小票，请补充上传', 'pending', '审核员B', now, now]
  );

  const paymentId1 = uuidv4();

  await runQuery(
    `INSERT INTO payment_progress (id, activity_id, request_id, amount, status, payment_method, transaction_id, paid_at, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [paymentId1, activityId1, 'PAY-REQ-001', 3000, 'completed', 'bank_transfer', 'TXN-2024-0615-001', '2024-06-15T10:00:00Z', '财务', now, now]
  );

  const logTypes = [
    { type: 'create', target: 'budget', targetId: budgetId1, operator: 'admin', details: '创建计算机协会2024年度预算' },
    { type: 'create', target: 'activity', targetId: activityId1, operator: '张三', details: '提交编程大赛活动申请' },
    { type: 'approve', target: 'activity', targetId: activityId1, operator: '审核员A', details: '审批通过编程大赛活动' },
    { type: 'create', target: 'purchase', targetId: purchaseId1, operator: '张三', details: '添加奖杯奖牌采购项' },
    { type: 'approve', target: 'invoice', targetId: reviewId1, operator: '审核员A', details: '审核通过票据' },
    { type: 'payment', target: 'payment', targetId: paymentId1, operator: '财务', details: '完成支付' },
    { type: 'reject', target: 'activity', targetId: activityId3, operator: '审核员B', details: '预算不足，驳回迎新晚会申请' },
  ];

  for (const log of logTypes) {
    await runQuery(
      `INSERT INTO operation_logs (operation_type, target_type, target_id, operator, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [log.type, log.target, log.targetId, log.operator, log.details, now]
    );
  }

  console.log('数据初始化完成！');
  console.log('创建的样例数据:');
  console.log('- 2个社团预算');
  console.log('- 4个活动申请 (approved/reviewing/rejected/pending - 展示四种状态)');
  console.log('- 3个采购明细');
  console.log('- 2个票据审核');
  console.log('- 1个补资料请求');
  console.log('- 1个支付记录');
  console.log('- 7条操作日志');
  
  process.exit(0);
}

initData().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
