const readline = require('readline');
const db = require('../database/store');
const BatchService = require('../services/batchService');
const OrderService = require('../services/orderService');
const TaskService = require('../services/taskService');
const ReportService = require('../services/reportService');
const { ORDER_STATUS, MERGE_STRATEGIES } = require('../utils/constants');

const adminUser = { id: 'admin_001', name: '张管理员', role: 'admin' };
const pmUser = { id: 'pm_001', name: '李项目经理', role: 'project_manager' };
const dispatcherUser = { id: 'disp_001', name: '王调度员', role: 'dispatcher' };
const techUser = { id: 'tech_001', name: '赵维修', role: 'technician' };

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(q) {
  return new Promise(resolve => rl.question(q, resolve));
}

function printDivider(title = '') {
  console.log('\n' + '='.repeat(60));
  if (title) console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printOrderShort(order) {
  console.log(`  [${order.order_no}] ${order.resident_name} - ${order.repair_type} - ${order.status}`);
}

async function scenario1() {
  printDivider('场景1：查看项目经理关键指标视图');
  const view = ReportService.getProjectManagerView();
  console.log('\n【总体概览】');
  console.log(`  总工单量: ${view.overview.total_orders}`);
  console.log(`  完成率: ${view.overview.completion_rate}`);
  console.log(`  总成本: ¥${view.overview.total_cost}`);
  console.log('\n【失败任务（含去向说明）】');
  view.failed_tasks.forEach(t => {
    console.log(`  ${t.id.slice(0, 8)}... | ${t.fail_type} | ${t.destination}`);
    console.log(`    错误: ${t.last_error}`);
  });
  console.log('\n【敏感字段变更记录】');
  view.sensitive_field_changes.forEach(c => {
    console.log(`  ${c.created_at.slice(0, 16)} | ${c.changed_by_name}`);
    console.log(`    ${c.field_name}: ${c.old_value} → ${c.new_value} (${c.change_reason})`);
  });
}

async function scenario2() {
  printDivider('场景2：批次工作流 - 从草稿到完成');
  
  const batch = BatchService.createBatch({
    batch_no: 'BATCH-DEMO-001',
    source_type: 'system_import',
    source_name: '演示系统',
    description: '演示批次',
    merge_strategy: MERGE_STRATEGIES.APPEND
  }, dispatcherUser);
  console.log(`✓ 创建批次: ${batch.batch_no}`);
  
  const orders = [
    { order_no: 'WO-DEMO-001', resident_name: '演示业主1', resident_phone: '13800000001', building: '1号楼', room: '101', repair_type: 'plumbing', description: '水管漏水' }
  ];
  const result = BatchService.importOrders(batch.id, orders, dispatcherUser);
  console.log(`✓ 导入工单: ${result.created.length} 单`);
  
  const orderId = result.created[0].order_id;
  let order = OrderService.getOrderWithDetails(orderId);
  console.log(`  当前状态: ${order.status}`);
  
  console.log('\n【状态流转演示】');
  
  order = OrderService.transitionStatus(orderId, ORDER_STATUS.SUBMITTED, dispatcherUser, '调度员提交');
  console.log(`  → 提交: ${order.status}`);
  
  order = OrderService.assignOrder(orderId, techUser, dispatcherUser);
  console.log(`  → 派单: ${order.status} → ${order.assignee_name}`);
  
  order = OrderService.transitionStatus(orderId, ORDER_STATUS.IN_PROGRESS, techUser, '开始维修');
  console.log(`  → 开工: ${order.status}`);
  
  order = OrderService.transitionStatus(orderId, ORDER_STATUS.COMPLETED, dispatcherUser, '验收完成');
  console.log(`  → 完成: ${order.status}`);
  
  const history = ReportService.getChangeHistory(orderId);
  console.log('\n【完整变更历史】');
  history.forEach(h => {
    console.log(`  ${h.timestamp.slice(0, 19)} | ${h.operator}`);
    console.log(`    ${h.description} (${h.reason})`);
  });
}

async function scenario3() {
  printDivider('场景3：三种批次合并策略对比');
  
  const testData = { order_no: 'WO-MERGE-001', resident_name: '测试用户', building: '1号楼' };
  
  const strategies = [
    { name: '忽略 (IGNORE)', value: MERGE_STRATEGIES.IGNORE },
    { name: '覆盖 (OVERWRITE)', value: MERGE_STRATEGIES.OVERWRITE },
    { name: '追加 (APPEND)', value: MERGE_STRATEGIES.APPEND }
  ];
  
  for (const s of strategies) {
    console.log(`\n--- 策略: ${s.name} ---`);
    
    const batch = BatchService.createBatch({
      batch_no: `BATCH-${s.value.toUpperCase()}`,
      merge_strategy: s.value
    }, adminUser);
    
    BatchService.importOrders(batch.id, [testData], adminUser);
    console.log(`  首次导入: 创建1单`);
    
    const updateData = { ...testData, resident_phone: '13900000001', description: '新增备注' };
    const result = BatchService.importOrders(batch.id, [updateData], adminUser);
    
    const order = db.findOne('work_orders', { order_no: testData.order_no });
    console.log(`  二次导入: ${result.skipped.length}忽略, ${result.updated.length}更新`);
    console.log(`  当前数据: 电话=${order.resident_phone || '(空)'}, 描述=${order.description || '(空)'}`);
    
    db.remove('work_orders', order.id);
  }
}

async function scenario4() {
  printDivider('场景4：异步任务失败分级处理');
  
  console.log('\n【创建3个不同类型的失败任务】');
  
  const t1 = TaskService.createTask('data_import', 'test1', 'batch');
  const t2 = TaskService.createTask('ocr_parse', 'test2', 'order');
  const t3 = TaskService.createTask('sms_send', 'test3', 'order');
  
  TaskService.startTask(t1.id);
  TaskService.failTask(t1.id, new Error('Network timeout - 连接超时'));
  console.log(`  任务1: 网络超时 → 等待重试 (WAITING_RETRY)`);
  
  TaskService.startTask(t2.id);
  TaskService.failTask(t2.id, new Error('数据格式错误，无法解析'));
  TaskService.failTask(t2.id, new Error('数据格式错误，无法解析'));
  TaskService.failTask(t2.id, new Error('数据格式错误，无法解析'));
  console.log(`  任务2: 重试3次失败 → 永久失败 (PERMANENT)`);
  
  TaskService.startTask(t3.id);
  TaskService.failTask(t3.id, new Error('Invalid phone number format'));
  console.log(`  任务3: 格式错误 → 等待人工处理 (WAITING_MANUAL)`);
  
  console.log('\n【任务队列统计】');
  const stats = TaskService.getTaskQueueStats();
  console.log(`  等待重试: ${stats.waiting_retry}`);
  console.log(`  等待人工: ${stats.waiting_manual}`);
  console.log(`  永久失败: ${stats.permanent}`);
  
  console.log('\n【导出失败项（含去向）】');
  const failed = ReportService.exportFailedItems();
  failed.items.forEach(item => {
    console.log(`  ${item.task_type} | ${item.fail_type}`);
    console.log(`    错误: ${item.last_error}`);
    console.log(`    去向: ${item.destination}`);
  });
}

async function scenario5() {
  printDivider('场景5：敏感字段脱敏导出');
  
  const orders = db.findAll('work_orders').slice(0, 3);
  if (orders.length === 0) {
    console.log('请先运行 npm run seed 初始化数据');
    return;
  }
  
  console.log('\n【原始数据 vs 脱敏导出对比】');
  console.log('-' .repeat(60));
  
  const normalExport = ReportService.exportOrders({}, { desensitized: false });
  const maskedExport = ReportService.exportOrders({}, { desensitized: true });
  
  for (let i = 0; i < Math.min(3, normalExport.data.length); i++) {
    const n = normalExport.data[i];
    const m = maskedExport.data[i];
    console.log(`\n工单 ${n.order_no}:`);
    console.log(`  姓名: ${n.resident_name} → ${m.resident_name}`);
    console.log(`  电话: ${n.resident_phone} → ${m.resident_phone}`);
  }
  
  console.log(`\n✓ CSV导出可用: ${normalExport.csv_data ? '是' : '否'}`);
  console.log(`✓ 导出总条数: ${normalExport.total}`);
}

async function scenario6() {
  printDivider('场景6：批次证据链管理');
  
  const batches = db.findAll('batches').filter(b => b.total_orders > 0);
  if (batches.length === 0) {
    console.log('请先运行 npm run seed 初始化数据');
    return;
  }
  
  const batch = BatchService.getBatchWithDetails(batches[0].id);
  console.log(`\n批次: ${batch.batch_no} (${batch.source_name})`);
  console.log(`工单数量: ${batch.orders.length}`);
  console.log(`证据数量: ${batch.evidences.length}`);
  
  console.log('\n【证据清单】');
  batch.evidences.forEach(e => {
    console.log(`  [${e.type}] ${e.file_name}`);
    console.log(`    描述: ${e.description}`);
    console.log(`    上传人: ${e.uploaded_by_name} @ ${e.created_at.slice(0, 10)}`);
  });
  
  console.log('\n【材料领用】');
  const allMaterials = db.findAll('materials');
  batch.orders.forEach(order => {
    const materials = allMaterials.filter(m => m.order_id === order.id);
    if (materials.length > 0) {
      console.log(`\n  ${order.order_no}:`);
      materials.forEach(m => {
        console.log(`    - ${m.material_name} x${m.quantity} = ¥${m.total_price}`);
      });
    }
  });
}

async function scenario7() {
  printDivider('场景7：工单驳回与二次确认');
  
  const batch = BatchService.createBatch({
    batch_no: 'BATCH-REVIEW-001',
    source_type: 'paper_scan',
    source_name: '门店交接纸'
  }, dispatcherUser);
  
  const result = BatchService.importOrders(batch.id, [{
    order_no: 'WO-REVIEW-001',
    resident_name: '待复核用户',
    repair_type: 'appliance',
    description: '家电维修申请'
  }], dispatcherUser);
  
  const orderId = result.created[0].order_id;
  
  console.log('\n【流程演示】');
  
  let order = OrderService.transitionStatus(orderId, ORDER_STATUS.SUBMITTED, dispatcherUser, '提交审核');
  console.log(`  1. 提交: ${order.status}`);
  
  order = OrderService.transitionStatus(orderId, ORDER_STATUS.REJECTED, pmUser, '家电维修需确认是否在保修期内，驳回补充信息');
  console.log(`  2. 驳回: ${order.status} (原因: ${order.status})`);
  console.log(`     ${db.findAll('status_transitions', { order_id: orderId }).slice(-1)[0].reason}`);
  
  order = OrderService.transitionStatus(orderId, ORDER_STATUS.SUBMITTED, dispatcherUser, '补充保修卡照片后重新提交');
  console.log(`  3. 重提: ${order.status}`);
  
  order = OrderService.transitionStatus(orderId, ORDER_STATUS.SECOND_CONFIRMATION, pmUser, '已过保，需二次确认业主是否自费');
  console.log(`  4. 二次确认: ${order.status}`);
  console.log(`     ${db.findAll('status_transitions', { order_id: orderId }).slice(-1)[0].reason}`);
  
  console.log('\n【完整审批流时间线】');
  ReportService.getChangeHistory(orderId).forEach(h => {
    console.log(`  ${h.timestamp.slice(11, 19)} | ${h.operator.padEnd(6)} | ${h.description}`);
    console.log(`    原因: ${h.reason}`);
  });
}

async function scenario8() {
  printDivider('场景8：同一批次重复导入策略验证');
  
  const batch = BatchService.createBatch({
    batch_no: 'BATCH-REIMPORT-001',
    source_type: 'system_import',
    merge_strategy: MERGE_STRATEGIES.APPEND
  }, adminUser);
  
  const orders1 = [
    { order_no: 'WO-RPT-001', resident_name: '用户A', description: '原始描述' },
    { order_no: 'WO-RPT-002', resident_name: '用户B', description: '原始描述' }
  ];
  
  console.log('\n【第1次导入】');
  const r1 = BatchService.importOrders(batch.id, orders1, adminUser);
  console.log(`  新建: ${r1.created.length}, 更新: ${r1.updated.length}, 跳过: ${r1.skipped.length}`);
  
  console.log('\n【第2次导入（相同订单号）】');
  const orders2 = [
    { order_no: 'WO-RPT-001', resident_phone: '13800000001', description: '补充信息' },
    { order_no: 'WO-RPT-003', resident_name: '用户C', description: '新工单' }
  ];
  const r2 = BatchService.importOrders(batch.id, orders2, adminUser);
  console.log(`  新建: ${r2.created.length}, 更新: ${r2.updated.length}, 跳过: ${r2.skipped.length}`);
  
  const order1 = db.findOne('work_orders', { order_no: 'WO-RPT-001' });
  console.log(`\n【追加策略效果】`);
  console.log(`  WO-RPT-001 描述字段: ${order1.description}`);
  console.log(`  (原始描述; 补充信息)`);
  
  const orders = db.findAll('work_orders', { batch_id: batch.id });
  console.log(`\n【批次最终工单列表】`);
  orders.forEach(o => printOrderShort(o));
}

async function scenario9() {
  printDivider('场景9：失败任务恢复与人工处理');
  
  const summary = TaskService.getFailedTasksSummary();
  console.log(`\n【当前失败任务概览】`);
  console.log(`  总计: ${summary.total}`);
  console.log(`  等待重试: ${summary.by_fail_type.waiting_retry}`);
  console.log(`  等待人工: ${summary.by_fail_type.waiting_manual}`);
  console.log(`  永久失败: ${summary.by_fail_type.permanent}`);
  
  if (summary.tasks.length === 0) {
    console.log('\n无失败任务，请先运行场景4');
    return;
  }
  
  const waitingManual = summary.tasks.find(t => t.fail_type === 'waiting_manual');
  if (waitingManual) {
    console.log(`\n【人工处理任务: ${waitingManual.id.slice(0, 8)}...】`);
    console.log(`  类型: ${waitingManual.task_type}`);
    console.log(`  错误: ${waitingManual.last_error}`);
    TaskService.markAsManualHandled(waitingManual.id, adminUser, '已手动修复数据格式');
    console.log(`  ✓ 标记为人工处理完成`);
  }
  
  const waitingRetry = summary.tasks.find(t => t.fail_type === 'waiting_retry');
  if (waitingRetry) {
    console.log(`\n【重试任务: ${waitingRetry.id.slice(0, 8)}...】`);
    TaskService.retryTask(waitingRetry.id, adminUser);
    console.log(`  ✓ 已放回待处理队列等待重新执行`);
  }
  
  const newStats = TaskService.getTaskQueueStats();
  console.log(`\n【处理后统计】`);
  console.log(`  待处理: ${newStats.pending}, 已完成: ${newStats.completed}`);
}

async function scenario10() {
  printDivider('场景10：只读审计与报表导出');
  
  const orders = db.findAll('work_orders', { status: ORDER_STATUS.COMPLETED });
  if (orders.length > 0) {
    const orderId = orders[0].id;
    console.log(`\n【标记工单为只读审计状态】`);
    const order = OrderService.transitionStatus(orderId, ORDER_STATUS.AUDIT_ONLY, pmUser, '结案归档，标记为只读审计');
    console.log(`  ${orders[0].order_no}: ${order.status}`);
    console.log(`  此状态下不可再修改，只能查看和导出`);
  }
  
  console.log(`\n【项目经理视图 - 关键指标】`);
  const view = ReportService.getProjectManagerView();
  console.log(`  总工单: ${view.overview.total_orders}`);
  console.log(`  完成率: ${view.overview.completion_rate}`);
  console.log(`  总成本: ¥${view.overview.total_cost}`);
  
  console.log(`\n【按状态分布】`);
  Object.entries(view.by_status).forEach(([k, v]) => {
    if (v > 0) console.log(`  ${k.padEnd(20)}: ${v} 单`);
  });
  
  console.log(`\n【脱敏导出测试】`);
  const exportResult = ReportService.exportOrders({}, { desensitized: true });
  console.log(`  导出 ${exportResult.total} 条记录`);
  console.log(`  脱敏状态: ${exportResult.desensitized ? '已脱敏' : '未脱敏'}`);
  if (exportResult.csv_data) {
    console.log(`  CSV前200字符:`);
    console.log(`    ${exportResult.csv_data.slice(0, 200).replace(/\n/g, '\n    ')}...`);
  }
}

const scenarios = [
  { id: '1', name: '项目经理关键指标视图', fn: scenario1 },
  { id: '2', name: '批次工作流完整演示', fn: scenario2 },
  { id: '3', name: '三种合并策略对比', fn: scenario3 },
  { id: '4', name: '任务失败分级处理', fn: scenario4 },
  { id: '5', name: '敏感字段脱敏导出', fn: scenario5 },
  { id: '6', name: '批次证据链管理', fn: scenario6 },
  { id: '7', name: '工单驳回与二次确认', fn: scenario7 },
  { id: '8', name: '重复导入策略验证', fn: scenario8 },
  { id: '9', name: '失败任务恢复处理', fn: scenario9 },
  { id: '10', name: '只读审计与报表导出', fn: scenario10 },
  { id: '0', name: '运行全部场景', fn: async () => {
    for (const s of scenarios.slice(0, -1)) {
      await s.fn();
      await question('\n按回车继续下一个场景...');
    }
  }},
  { id: 'q', name: '退出', fn: async () => process.exit(0) }
];

async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     物业维修派单权限追责台账 API - 功能演示              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n请选择要运行的演示场景:\n');
  
  scenarios.forEach(s => {
    console.log(`  ${s.id}. ${s.name}`);
  });
  
  const answer = await question('\n请输入选项编号: ');
  const scenario = scenarios.find(s => s.id === answer.trim().toLowerCase());
  
  if (scenario) {
    await scenario.fn();
  } else {
    console.log('无效选项');
  }
  
  rl.close();
}

main().catch(err => {
  console.error(err);
  rl.close();
});
