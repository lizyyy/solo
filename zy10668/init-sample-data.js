const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { REWORK_STATUSES, OPERATION_TYPES, generateReworkNo } = require('./utils');

const workOrders = [
  { id: uuidv4(), work_order_no: 'WO2024001', product_name: '电机组件A1', quantity: 100, status: 'production' },
  { id: uuidv4(), work_order_no: 'WO2024002', product_name: '电机组件A2', quantity: 150, status: 'production' },
  { id: uuidv4(), work_order_no: 'WO2024003', product_name: '控制器B1', quantity: 80, status: 'pending' },
  { id: uuidv4(), work_order_no: 'WO2024004', product_name: '传感器C1', quantity: 200, status: 'production' },
  { id: uuidv4(), work_order_no: 'WO2024005', product_name: '外壳D1', quantity: 120, status: 'completed' }
];

const processes = [
  { id: uuidv4(), process_code: 'PROC001', process_name: '焊接工序', sequence: 1 },
  { id: uuidv4(), process_code: 'PROC002', process_name: '组装工序', sequence: 2 },
  { id: uuidv4(), process_code: 'PROC003', process_name: '测试工序', sequence: 3 },
  { id: uuidv4(), process_code: 'PROC004', process_name: '包装工序', sequence: 4 }
];

const reworkReasons = [
  { id: uuidv4(), reason_code: 'REASON001', reason_name: '焊点不良', description: '焊接质量不合格' },
  { id: uuidv4(), reason_code: 'REASON002', reason_name: '装配偏差', description: '零件装配位置偏差' },
  { id: uuidv4(), reason_code: 'REASON003', reason_name: '功能异常', description: '功能测试不通过' },
  { id: uuidv4(), reason_code: 'REASON004', reason_name: '外观瑕疵', description: '外观存在划痕或瑕疵' }
];

const teams = [
  { id: uuidv4(), team_code: 'TEAM001', team_name: '焊接一班', leader: '张三' },
  { id: uuidv4(), team_code: 'TEAM002', team_name: '组装一班', leader: '李四' },
  { id: uuidv4(), team_code: 'TEAM003', team_name: '测试一班', leader: '王五' },
  { id: uuidv4(), team_code: 'TEAM004', team_name: '包装一班', leader: '赵六' }
];

function insertData() {
  console.log('开始初始化样例数据...');
  
  workOrders.forEach(wo => {
    db.run('INSERT INTO work_orders (id, work_order_no, product_name, quantity, status) VALUES (?, ?, ?, ?, ?)',
      [wo.id, wo.work_order_no, wo.product_name, wo.quantity, wo.status]);
  });
  console.log('✓ 工单数据已插入');
  
  processes.forEach(proc => {
    db.run('INSERT INTO processes (id, process_code, process_name, sequence) VALUES (?, ?, ?, ?)',
      [proc.id, proc.process_code, proc.process_name, proc.sequence]);
  });
  console.log('✓ 工序数据已插入');
  
  reworkReasons.forEach(reason => {
    db.run('INSERT INTO rework_reasons (id, reason_code, reason_name, description) VALUES (?, ?, ?, ?)',
      [reason.id, reason.reason_code, reason.reason_name, reason.description]);
  });
  console.log('✓ 返工原因数据已插入');
  
  teams.forEach(team => {
    db.run('INSERT INTO responsibility_teams (id, team_code, team_name, leader) VALUES (?, ?, ?, ?)',
      [team.id, team.team_code, team.team_name, team.leader]);
  });
  console.log('✓ 责任班组数据已插入');
  
  setTimeout(() => {
    createReworkTasks();
  }, 1000);
}

function createReworkTasks() {
  console.log('\n开始创建返工任务样例数据...');
  
  const task1Id = uuidv4();
  db.run(`INSERT INTO rework_tasks 
    (id, rework_no, work_order_id, process_id, rework_reason_id, responsibility_team_id, 
     quantity, status, remark, created_by, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task1Id, 
      generateReworkNo(),
      workOrders[0].id,
      processes[2].id,
      reworkReasons[2].id,
      teams[2].id,
      5,
      REWORK_STATUSES.PENDING_PRODUCTION,
      '功能测试失败，需要返工',
      '操作员A',
      new Date(Date.now() - 86400000 * 2).toISOString()
    ],
    () => {
      addHistory(task1Id, null, REWORK_STATUSES.PENDING_PRODUCTION, OPERATION_TYPES.CREATE, '操作员A', '创建返工任务');
      console.log('✓ 任务1: 待生产状态');
    }
  );
  
  const task2Id = uuidv4();
  db.run(`INSERT INTO rework_tasks 
    (id, rework_no, work_order_id, process_id, rework_reason_id, responsibility_team_id, 
     quantity, status, remark, created_by, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task2Id, 
      generateReworkNo(),
      workOrders[1].id,
      processes[0].id,
      reworkReasons[0].id,
      teams[0].id,
      3,
      REWORK_STATUSES.IN_REWORK,
      '焊点虚焊，正在返工',
      '操作员A',
      new Date(Date.now() - 86400000).toISOString()
    ],
    () => {
      addHistory(task2Id, null, REWORK_STATUSES.PENDING_PRODUCTION, OPERATION_TYPES.CREATE, '操作员A', '创建返工任务');
      addHistory(task2Id, REWORK_STATUSES.PENDING_PRODUCTION, REWORK_STATUSES.IN_REWORK, OPERATION_TYPES.START, '操作员B', '开始返工');
      console.log('✓ 任务2: 返工中状态');
    }
  );
  
  const task3Id = uuidv4();
  db.run(`INSERT INTO rework_tasks 
    (id, rework_no, work_order_id, process_id, rework_reason_id, responsibility_team_id, 
     quantity, status, remark, created_by, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task3Id, 
      generateReworkNo(),
      workOrders[2].id,
      processes[1].id,
      reworkReasons[1].id,
      teams[1].id,
      2,
      REWORK_STATUSES.PENDING_REVIEW,
      '返工完成，等待复检',
      '操作员B',
      new Date(Date.now() - 3600000 * 12).toISOString()
    ],
    () => {
      addHistory(task3Id, null, REWORK_STATUSES.PENDING_PRODUCTION, OPERATION_TYPES.CREATE, '操作员B', '创建返工任务');
      addHistory(task3Id, REWORK_STATUSES.PENDING_PRODUCTION, REWORK_STATUSES.IN_REWORK, OPERATION_TYPES.START, '操作员B', '开始返工');
      addHistory(task3Id, REWORK_STATUSES.IN_REWORK, REWORK_STATUSES.PENDING_REVIEW, OPERATION_TYPES.SUBMIT, '操作员B', '提交复检');
      console.log('✓ 任务3: 待复检状态');
    }
  );
  
  const task4Id = uuidv4();
  db.run(`INSERT INTO rework_tasks 
    (id, rework_no, work_order_id, process_id, rework_reason_id, responsibility_team_id, 
     quantity, status, remark, created_by, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task4Id, 
      generateReworkNo(),
      workOrders[0].id,
      processes[0].id,
      reworkReasons[0].id,
      teams[0].id,
      1,
      REWORK_STATUSES.REJECTED,
      '复检未通过，需要重新返工',
      '操作员A',
      new Date(Date.now() - 86400000 * 3).toISOString()
    ],
    () => {
      addHistory(task4Id, null, REWORK_STATUSES.PENDING_PRODUCTION, OPERATION_TYPES.CREATE, '操作员A', '创建返工任务');
      addHistory(task4Id, REWORK_STATUSES.PENDING_PRODUCTION, REWORK_STATUSES.IN_REWORK, OPERATION_TYPES.START, '操作员A', '开始返工');
      addHistory(task4Id, REWORK_STATUSES.IN_REWORK, REWORK_STATUSES.PENDING_REVIEW, OPERATION_TYPES.SUBMIT, '操作员A', '提交复检');
      addHistory(task4Id, REWORK_STATUSES.PENDING_REVIEW, REWORK_STATUSES.REJECTED, OPERATION_TYPES.REJECT, '质检员A', '复检未通过:焊点仍有问题');
      console.log('✓ 任务4: 已驳回状态');
    }
  );
  
  const task5Id = uuidv4();
  db.run(`INSERT INTO rework_tasks 
    (id, rework_no, work_order_id, process_id, rework_reason_id, responsibility_team_id, 
     quantity, status, remark, created_by, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task5Id, 
      generateReworkNo(),
      workOrders[4].id,
      processes[3].id,
      reworkReasons[3].id,
      teams[3].id,
      10,
      REWORK_STATUSES.COMPLETED,
      '返工完成，已通过复检',
      '操作员C',
      new Date(Date.now() - 86400000 * 5).toISOString()
    ],
    () => {
      addHistory(task5Id, null, REWORK_STATUSES.PENDING_PRODUCTION, OPERATION_TYPES.CREATE, '操作员C', '创建返工任务');
      addHistory(task5Id, REWORK_STATUSES.PENDING_PRODUCTION, REWORK_STATUSES.IN_REWORK, OPERATION_TYPES.START, '操作员C', '开始返工');
      addHistory(task5Id, REWORK_STATUSES.IN_REWORK, REWORK_STATUSES.PENDING_REVIEW, OPERATION_TYPES.SUBMIT, '操作员C', '提交复检');
      addHistory(task5Id, REWORK_STATUSES.PENDING_REVIEW, REWORK_STATUSES.COMPLETED, OPERATION_TYPES.REVIEW, '质检员A', '复检通过');
      console.log('✓ 任务5: 已完成状态 (完整流转)');
    }
  );
  
  const task6Id = uuidv4();
  db.run(`INSERT INTO rework_tasks 
    (id, rework_no, work_order_id, process_id, rework_reason_id, responsibility_team_id, 
     quantity, status, remark, manual_remark, is_manual_override, created_by, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task6Id, 
      generateReworkNo(),
      workOrders[3].id,
      processes[2].id,
      reworkReasons[2].id,
      teams[2].id,
      4,
      REWORK_STATUSES.CONFLICT,
      'MES系统与实际状态不一致',
      '人工检查确认返工已完成，因系统同步问题状态未更新，强制推进',
      1,
      '操作员D',
      new Date(Date.now() - 3600000 * 6).toISOString()
    ],
    () => {
      addHistory(task6Id, null, REWORK_STATUSES.PENDING_PRODUCTION, OPERATION_TYPES.CREATE, '操作员D', '创建返工任务');
      addHistory(task6Id, REWORK_STATUSES.PENDING_PRODUCTION, REWORK_STATUSES.IN_REWORK, OPERATION_TYPES.START, '操作员D', '开始返工');
      addHistory(task6Id, REWORK_STATUSES.IN_REWORK, REWORK_STATUSES.CONFLICT, OPERATION_TYPES.CONFLICT_RESOLVE, '系统管理员', '状态冲突: MES回写失败');
      console.log('✓ 任务6: 状态冲突 (人工备注处理)');
    }
  );
  
  setTimeout(() => {
    console.log('\n✅ 样例数据初始化完成!');
    console.log('数据摘要:');
    console.log('- 工单: 5条');
    console.log('- 工序: 4条');
    console.log('- 返工原因: 4条');
    console.log('- 责任班组: 4条');
    console.log('- 返工任务: 6条 (包含待生产、返工中、待复检、已驳回、已完成、冲突状态)');
    console.log('\n启动服务: npm start');
    process.exit(0);
  }, 2000);
}

function addHistory(taskId, fromStatus, toStatus, operationType, operator, remark) {
  const historyId = uuidv4();
  db.run(`INSERT INTO rework_status_history 
    (id, rework_task_id, from_status, to_status, operation_type, operator, remark, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      historyId,
      taskId,
      fromStatus,
      toStatus,
      operationType,
      operator,
      remark,
      new Date().toISOString()
    ]
  );
}

db.serialize(() => {
  db.run('DELETE FROM rework_status_history');
  db.run('DELETE FROM import_errors');
  db.run('DELETE FROM import_records');
  db.run('DELETE FROM rework_tasks');
  db.run('DELETE FROM work_orders');
  db.run('DELETE FROM processes');
  db.run('DELETE FROM rework_reasons');
  db.run('DELETE FROM responsibility_teams');
  
  console.log('已清理旧数据');
  insertData();
});
