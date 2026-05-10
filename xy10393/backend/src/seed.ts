import { initializeDatabase, dbRun } from './database';
import eventService from './services';

function clearData() {
  return Promise.all([
    dbRun('DELETE FROM approval_comments'),
    dbRun('DELETE FROM finish_records'),
    dbRun('DELETE FROM supplies'),
    dbRun('DELETE FROM dropouts'),
    dbRun('DELETE FROM checkins'),
    dbRun('DELETE FROM equipment_checks'),
    dbRun('DELETE FROM riders'),
    dbRun('DELETE FROM checkpoints')
  ]);
}

async function seed() {
  await initializeDatabase();
  
  console.log('清空旧数据...');
  await clearData();

  console.log('创建签到点...');
  const start = await eventService.addCheckpoint({
    name: '起点-人民广场',
    orderIndex: 0,
    location: '上海市黄浦区人民广场',
    isStart: true,
    isFinish: false
  });

  const cp1 = await eventService.addCheckpoint({
    name: 'CP1-外滩',
    orderIndex: 1,
    location: '上海市黄浦区外滩',
    isStart: false,
    isFinish: false
  });

  const cp2 = await eventService.addCheckpoint({
    name: 'CP2-东方明珠',
    orderIndex: 2,
    location: '上海市浦东新区东方明珠',
    isStart: false,
    isFinish: false
  });

  const cp3 = await eventService.addCheckpoint({
    name: 'CP3-世博园',
    orderIndex: 3,
    location: '上海市浦东新区世博园',
    isStart: false,
    isFinish: false
  });

  const finish = await eventService.addCheckpoint({
    name: '终点-徐汇滨江',
    orderIndex: 4,
    location: '上海市徐汇区徐汇滨江',
    isStart: false,
    isFinish: true
  });

  console.log('注册骑手...');
  
  const rider1 = await eventService.registerRider({
    name: '张明',
    phone: '13800138001',
    bibNumber: 1001,
    team: '闪电车队',
    emergencyContact: '张父',
    emergencyPhone: '13900139001'
  });

  const rider2 = await eventService.registerRider({
    name: '李华',
    phone: '13800138002',
    bibNumber: 1002,
    team: '美利达车队',
    emergencyContact: '李母',
    emergencyPhone: '13900139002'
  });

  const rider3 = await eventService.registerRider({
    name: '王芳',
    phone: '13800138003',
    bibNumber: 1003,
    team: '捷安特车队',
    emergencyContact: '王姐',
    emergencyPhone: '13900139003'
  });

  const rider4 = await eventService.registerRider({
    name: '赵强',
    phone: '13800138004',
    bibNumber: 1004,
    team: '崔克车队',
    emergencyContact: '赵哥',
    emergencyPhone: '13900139004'
  });

  const rider5 = await eventService.registerRider({
    name: '周明',
    phone: '13800138005',
    bibNumber: 1005,
    team: '个人参赛',
    emergencyContact: '周妻',
    emergencyPhone: '13900139005'
  });

  console.log('场景1: 张明 - 正常完赛');
  await eventService.recordEquipmentCheck({
    riderId: rider1.id,
    items: [
      { name: '头盔', status: 'ok' },
      { name: '前后灯', status: 'ok' },
      { name: '反光条', status: 'ok' },
      { name: '维修工具', status: 'ok' }
    ],
    overallResult: 'passed',
    checkerName: '陈检',
    comments: '装备齐全，状态良好'
  });
  await eventService.recordCheckin({ riderId: rider1.id, checkpointId: start.id, checkedBy: '张义工' });
  await eventService.recordCheckin({ riderId: rider1.id, checkpointId: cp1.id, checkedBy: '李义工' });
  await eventService.recordSupply({ riderId: rider1.id, supplyType: 'course', checkpointId: cp1.id, collectedBy: '王义工' });
  await eventService.recordCheckin({ riderId: rider1.id, checkpointId: cp2.id, checkedBy: '赵义工' });
  await eventService.recordCheckin({ riderId: rider1.id, checkpointId: cp3.id, checkedBy: '孙义工' });
  await eventService.recordCheckin({ riderId: rider1.id, checkpointId: finish.id, checkedBy: '周义工' });
  await eventService.recordFinish({ riderId: rider1.id, recordedBy: '吴裁判' });
  await eventService.recordSupply({ riderId: rider1.id, supplyType: 'finish', collectedBy: '郑义工' });

  console.log('场景2: 李华 - 装备缺失（未通过装备检查，不能出发）');
  const eqCheck2 = await eventService.recordEquipmentCheck({
    riderId: rider2.id,
    items: [
      { name: '头盔', status: 'ok' },
      { name: '前后灯', status: 'missing', notes: '尾灯缺失' },
      { name: '反光条', status: 'ok' },
      { name: '维修工具', status: 'ok' }
    ],
    overallResult: 'failed',
    checkerName: '陈检',
    comments: '尾灯缺失，需补齐后重新检查'
  });
  await eventService.addApprovalComment({
    relatedType: 'equipment_check',
    relatedId: eqCheck2.id,
    action: '装备检查审批',
    decision: 'rejected',
    comments: '根据活动安全规定，尾灯为强制装备，必须配备。建议骑手返回取装备后重新检查。',
    madeBy: '陈检'
  });

  console.log('场景3: 王芳 - 漏签到（缺少CP2签到，不能直接完赛）');
  await eventService.recordEquipmentCheck({
    riderId: rider3.id,
    items: [
      { name: '头盔', status: 'ok' },
      { name: '前后灯', status: 'ok' },
      { name: '反光条', status: 'ok' },
      { name: '维修工具', status: 'ok' }
    ],
    overallResult: 'passed',
    checkerName: '陈检',
    comments: '装备齐全'
  });
  await eventService.recordCheckin({ riderId: rider3.id, checkpointId: start.id, checkedBy: '张义工' });
  await eventService.recordCheckin({ riderId: rider3.id, checkpointId: cp1.id, checkedBy: '李义工' });
  await eventService.recordCheckin({ riderId: rider3.id, checkpointId: cp3.id, checkedBy: '孙义工' });

  console.log('场景4: 赵强 - 途中退赛（在CP2退赛，不能领取完赛补给）');
  const eqCheck4 = await eventService.recordEquipmentCheck({
    riderId: rider4.id,
    items: [
      { name: '头盔', status: 'ok' },
      { name: '前后灯', status: 'ok' },
      { name: '反光条', status: 'damaged', notes: '反光条有轻微破损但仍可用' },
      { name: '维修工具', status: 'ok' }
    ],
    overallResult: 'passed',
    checkerName: '陈检',
    comments: '反光条轻微破损，不影响使用，通过'
  });
  await eventService.addApprovalComment({
    relatedType: 'equipment_check',
    relatedId: eqCheck4.id,
    action: '装备检查审批',
    decision: 'approved',
    comments: '反光条虽有轻微破损，但反光效果仍然存在，不构成安全隐患，予以通过。',
    madeBy: '陈检'
  });
  await eventService.recordCheckin({ riderId: rider4.id, checkpointId: start.id, checkedBy: '张义工' });
  await eventService.recordCheckin({ riderId: rider4.id, checkpointId: cp1.id, checkedBy: '李义工' });
  const dropout4 = await eventService.recordDropout({
    riderId: rider4.id,
    checkpointId: cp2.id,
    reason: '身体不适',
    comments: '骑行途中感到头晕恶心，选择退赛。已联系急救人员检查，无大碍。',
    recordedBy: '赵义工'
  });
  await eventService.addApprovalComment({
    relatedType: 'dropout',
    relatedId: dropout4.id,
    action: '退赛登记确认',
    decision: 'approved',
    comments: '骑手主诉头晕恶心，现场血压测量正常，建议休息后自行离开。已联系家属确认。',
    madeBy: '钱医护'
  });

  console.log('场景5: 周明 - 等待装备检查（初始状态，用于演示操作流程）');

  console.log('\n=== 样例数据创建完成 ===');
  const riders = await eventService.getRiders();
  console.log('骑手列表:');
  riders.forEach(r => {
    console.log(`  #${r.bibNumber} ${r.name} - ${r.status}`);
  });
  console.log('\n签到点:');
  const checkpoints = await eventService.getCheckpoints();
  checkpoints.forEach(cp => {
    console.log(`  [${cp.orderIndex}] ${cp.name} ${cp.isStart ? '(起点)' : ''}${cp.isFinish ? '(终点)' : ''}`);
  });
  const finishRecords = await eventService.getFinishRecords();
  const dropouts = await eventService.getDropouts();
  console.log('\n完赛人数:', finishRecords.length);
  console.log('退赛人数:', dropouts.length);
}

seed();
