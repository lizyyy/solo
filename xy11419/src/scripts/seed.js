const db = require('../database/store');
const BatchService = require('../services/batchService');
const OrderService = require('../services/orderService');
const TaskService = require('../services/taskService');
const { ORDER_STATUS, MERGE_STRATEGIES, TASK_STATUS, FAIL_TYPES, BATCH_STATUS } = require('../utils/constants');

const adminUser = { id: 'admin_001', name: '张管理员', role: 'admin' };
const pmUser = { id: 'pm_001', name: '李项目经理', role: 'project_manager' };
const dispatcherUser = { id: 'disp_001', name: '王调度员', role: 'dispatcher' };
const techUser = { id: 'tech_001', name: '赵维修', role: 'technician' };
const auditorUser = { id: 'aud_001', name: '孙审计员', role: 'auditor' };

const users = [adminUser, pmUser, dispatcherUser, techUser, auditorUser];

function seed() {
  console.log('开始初始化样例数据...\n');
  
  db.reset();
  
  users.forEach(u => db.insert('users', u));
  console.log(`✓ 已创建 ${users.length} 个测试用户`);
  
  const batch1 = BatchService.createBatch({
    batch_no: 'BATCH-2024-001',
    source_type: 'system_import',
    source_name: '住户报修系统',
    description: '正常批次：2024年5月第一周住户报修',
    merge_strategy: MERGE_STRATEGIES.APPEND,
    status: BATCH_STATUS.COMPLETED
  }, adminUser);
  
  const orders1 = [
    { order_no: 'WO20240501001', resident_name: '陈业主', resident_phone: '13800001111', building: '1号楼', unit: '2单元', room: '301', repair_type: 'plumbing', description: '厨房水龙头漏水', priority: 'high', actual_cost: 85 },
    { order_no: 'WO20240501002', resident_name: '刘住户', resident_phone: '13900002222', building: '3号楼', unit: '1单元', room: '502', repair_type: 'electrical', description: '客厅吊灯不亮', priority: 'normal', actual_cost: 120 },
    { order_no: 'WO20240501003', resident_name: '王居民', resident_phone: '13700003333', building: '5号楼', unit: '3单元', room: '101', repair_type: 'door', description: '入户门锁故障', priority: 'high', actual_cost: 280 }
  ];
  
  const result1 = BatchService.importOrders(batch1.id, orders1, adminUser);
  console.log(`✓ 批次1（正常）：${result1.created.length} 单导入完成`);
  
  const batch1Orders = db.findAll('work_orders', { batch_id: batch1.id });
  
  batch1Orders.forEach((order, idx) => {
    OrderService.transitionStatus(order.id, ORDER_STATUS.SUBMITTED, dispatcherUser, '调度员提交');
    OrderService.assignOrder(order.id, techUser, dispatcherUser);
    OrderService.transitionStatus(order.id, ORDER_STATUS.IN_PROGRESS, techUser, '开始维修');
    OrderService.transitionStatus(order.id, ORDER_STATUS.PENDING_REVIEW, techUser, '维修完成，待验收');
    OrderService.transitionStatus(order.id, ORDER_STATUS.COMPLETED, dispatcherUser, '验收通过');
    
    BatchService.addMaterial(order.id, { material_name: idx === 0 ? '水龙头阀芯' : idx === 1 ? 'LED灯泡' : '门锁总成', quantity: 1, unit_price: idx === 0 ? 35 : idx === 1 ? 25 : 180 });
    BatchService.addEvidence(batch1.id, order.id, { type: 'resident_screenshot', file_name: `报修截图_${order.order_no}.jpg`, description: '住户微信报修截图' }, adminUser);
    BatchService.addEvidence(batch1.id, order.id, { type: 'technician_receipt', file_name: `回执_${order.order_no}.jpg`, description: '维修师傅现场回执' }, adminUser);
  });
  
  console.log(`✓ 批次1工单已完成全部流程，含证据和材料记录`);
  
  const batch2 = BatchService.createBatch({
    batch_no: 'BATCH-2024-002',
    source_type: 'paper_scan',
    source_name: '门店交接纸',
    description: '待复核批次：门店交接单扫描导入，需人工复核',
    merge_strategy: MERGE_STRATEGIES.OVERWRITE,
    status: BATCH_STATUS.PROCESSING
  }, dispatcherUser);
  
  const orders2 = [
    { order_no: 'WO20240502001', resident_name: '张业主', resident_phone: '13600004444', building: '2号楼', unit: '2单元', room: '403', repair_type: 'window', description: '阳台窗户密封条老化', priority: 'low', estimated_cost: 150 },
    { order_no: 'WO20240502002', resident_name: '李住户', resident_phone: '13500005555', building: '4号楼', unit: '1单元', room: '202', repair_type: 'appliance', description: '空调不制冷', priority: 'high', estimated_cost: 300 },
    { order_no: 'WO20240502003', resident_name: '', resident_phone: '', building: '6号楼', unit: '', room: '', repair_type: 'general', description: '公共区域灯不亮（房号缺失）', priority: 'normal' }
  ];
  
  const result2 = BatchService.importOrders(batch2.id, orders2, dispatcherUser);
  console.log(`\n✓ 批次2（待复核）：${result2.created.length} 单导入完成`);
  
  const batch2Orders = db.findAll('work_orders', { batch_id: batch2.id });
  
  OrderService.transitionStatus(batch2Orders[0].id, ORDER_STATUS.SUBMITTED, dispatcherUser, '提交待派单');
  OrderService.transitionStatus(batch2Orders[0].id, ORDER_STATUS.SECOND_CONFIRMATION, pmUser, '窗户维修需确认是否在维保期内，待二次确认');
  
  OrderService.transitionStatus(batch2Orders[1].id, ORDER_STATUS.SUBMITTED, dispatcherUser, '提交待派单');
  OrderService.transitionStatus(batch2Orders[1].id, ORDER_STATUS.REJECTED, pmUser, '空调维修需业主联系品牌售后，非物业维修范围，驳回');
  
  OrderService.transitionStatus(batch2Orders[2].id, ORDER_STATUS.SUBMITTED, dispatcherUser, '提交待复核');
  
  BatchService.addEvidence(batch2.id, batch2Orders[0].id, { type: 'paper_form', file_name: '交接纸_扫描件_001.pdf', description: '门店交接单扫描件' }, dispatcherUser);
  
  console.log(`✓ 批次2：1单二次确认、1单驳回、1单待复核`);
  
  const batch3 = BatchService.createBatch({
    batch_no: 'BATCH-2024-003',
    source_type: 'material_form',
    source_name: '材料领用表',
    description: '无法处理批次：数据缺失严重，已取消',
    merge_strategy: MERGE_STRATEGIES.IGNORE,
    status: BATCH_STATUS.CANCELLED
  }, auditorUser);
  
  const orders3 = [
    { order_no: 'WO20240503001', resident_name: '', resident_phone: '', building: '', unit: '', room: '', repair_type: 'unknown', description: '', priority: 'normal' }
  ];
  
  const result3 = BatchService.importOrders(batch3.id, orders3, auditorUser);
  console.log(`\n✓ 批次3（无法处理）：${result3.created.length} 单导入完成`);
  
  const batch3Orders = db.findAll('work_orders', { batch_id: batch3.id });
  batch3Orders.forEach(order => {
    OrderService.transitionStatus(order.id, ORDER_STATUS.CANCELLED, auditorUser, '数据缺失，无法识别报修信息，取消工单');
  });
  
  TaskService.createTask('batch_import', batch3.id, 'batch', { batch_no: batch3.batch_no });
  TaskService.createTask('ocr_parse', batch3Orders[0].id, 'order', { source: 'material_form' });
  
  const tasks = db.findAll('async_tasks');
  
  TaskService.startTask(tasks[0].id);
  TaskService.failTask(tasks[0].id, new Error('Network timeout - 连接材料系统超时'));
  
  TaskService.startTask(tasks[1].id);
  TaskService.failTask(tasks[1].id, new Error('无法识别的材料编号格式'));
  TaskService.failTask(tasks[1].id, new Error('无法识别的材料编号格式'));
  TaskService.failTask(tasks[1].id, new Error('无法识别的材料编号格式'));
  
  console.log(`✓ 批次3：关联失败任务（等待重试、永久失败各1个）`);
  
  OrderService.updateOrder(batch1Orders[0].id, { resident_phone: '13800009999' }, pmUser, '业主更换联系电话');
  
  console.log(`\n✓ 已添加敏感字段变更记录（联系电话修改）`);
  
  console.log('\n========== 样例数据初始化完成 ==========');
  console.log('  批次总数:', db.findAll('batches').length);
  console.log('  工单总数:', db.findAll('work_orders').length);
  console.log('  证据总数:', db.findAll('evidences').length);
  console.log('  材料记录:', db.findAll('materials').length);
  console.log('  状态流转:', db.findAll('status_transitions').length);
  console.log('  审计记录:', db.findAll('audit_logs').length);
  console.log('  异步任务:', db.findAll('async_tasks').length);
  console.log('==========================================');
}

seed();
