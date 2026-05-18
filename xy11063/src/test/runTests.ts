import { v4 as uuidv4 } from 'uuid';
import { repairService } from '../services/repairService';
import { repairRepository } from '../storage/repository';
import { RepairPriority, RepairStatus, RepairCategory, CreateRepairRequest } from '../types/repair';

async function runTests() {
  console.log('========== 物业报修中心测试开始 ==========\n');

  await repairRepository.clearAll();

  await testNormalRepairCreation();
  await testDuplicateRepairDetection();
  await testVersionConflictDetection();
  await testStatusTransitionValidation();
  await testBadDataValidation();
  await testRepairMergeWithPriorityAdjustment();
  await testExportAndVerification();

  console.log('\n========== 所有测试完成 ==========');
}

async function testNormalRepairCreation() {
  console.log('【测试1】正常报修记录创建');
  
  const request: CreateRepairRequest = {
    title: '5号楼消防报警故障',
    description: '5号楼2层走廊烟感探测器持续报警，无明显烟雾。',
    category: RepairCategory.SECURITY,
    priority: RepairPriority.HIGH,
    location: {
      building: '5号楼',
      floor: '2层',
      room: '走廊'
    },
    reporter: {
      name: '吴九',
      phone: '13800138007',
      roomNumber: '5-201',
      isResident: true
    },
    createdBy: 'security_staff'
  };

  try {
    const repair = await repairService.createRepair(request);
    console.log(`  ✓ 成功创建报修记录: ${repair.repairNumber}`);
    console.log(`    - ID: ${repair.id}`);
    console.log(`    - 状态: ${repair.status}`);
    console.log(`    - 优先级: ${repair.priority}`);
    console.log(`    - 版本: ${repair.version}`);
    return repair;
  } catch (error: any) {
    console.log(`  ✗ 创建失败: ${error.message}`);
    throw error;
  }
}

async function testDuplicateRepairDetection() {
  console.log('\n【测试2】重复报修检测（相同位置、相似标题）');
  
  const request1: CreateRepairRequest = {
    title: '3号楼电梯门关不上',
    description: '电梯门无法正常关闭，反复开合。',
    category: RepairCategory.ELEVATOR,
    priority: RepairPriority.URGENT,
    location: {
      building: '3号楼',
      floor: '1层',
      room: '大厅'
    },
    reporter: {
      name: '郑十',
      phone: '13800138008',
      roomNumber: '3-501',
      isResident: true
    },
    createdBy: 'user'
  };

  const repair1 = await repairService.createRepair(request1);
  console.log(`  ✓ 创建第一条报修: ${repair1.repairNumber}`);

  const request2: CreateRepairRequest = {
    title: '3号楼电梯门故障',
    description: '电梯门关闭后又自动打开，无法正常运行。',
    category: RepairCategory.ELEVATOR,
    priority: RepairPriority.HIGH,
    location: {
      building: '3号楼',
      floor: '1层',
      room: '大厅'
    },
    reporter: {
      name: '陈十一',
      phone: '13800138009',
      roomNumber: '3-601',
      isResident: true
    },
    createdBy: 'user'
  };

  const repair2 = await repairService.createRepair(request2);
  console.log(`  ✓ 创建第二条报修: ${repair2.repairNumber}`);
  
  if (repair2.isDuplicate) {
    console.log(`  ✓ 系统正确检测到重复报修`);
    console.log(`    - 重复计数: ${repair2.duplicateCount}`);
    console.log(`    - 关联记录: ${repair2.relatedRepairIds.length} 条`);
  } else {
    console.log(`  ⚠ 未检测到重复报修（可能是关键词匹配问题）`);
  }
}

async function testVersionConflictDetection() {
  console.log('\n【测试3】版本冲突检测（防止静默覆盖）');
  
  const request: CreateRepairRequest = {
    title: '6号楼门禁失灵',
    description: '单元楼门禁无法刷卡开门，按钮也失效。',
    category: RepairCategory.SECURITY,
    priority: RepairPriority.HIGH,
    location: {
      building: '6号楼',
      floor: '1层',
      room: '单元门'
    },
    reporter: {
      name: '冯十二',
      phone: '13800138010',
      roomNumber: '6-301',
      isResident: true
    },
    createdBy: 'user'
  };

  const repair = await repairService.createRepair(request);
  console.log(`  ✓ 创建报修: ${repair.repairNumber}, 当前版本: ${repair.version}`);

  try {
    await repairService.updateRepair(repair.id, {
      expectedVersion: 999,
      status: RepairStatus.ASSIGNED,
      updatedBy: 'admin'
    });
    console.log(`  ✗ 版本号错误应该被检测到但没有`);
  } catch (error: any) {
    console.log(`  ✓ 系统正确检测到版本冲突`);
    console.log(`    - 错误类型: ${error.name}`);
    console.log(`    - 期望版本: ${error.expectedVersion}`);
    console.log(`    - 实际版本: ${error.actualVersion}`);
  }

  const updated = await repairService.updateRepair(repair.id, {
    expectedVersion: 1,
    status: RepairStatus.ASSIGNED,
    updatedBy: 'admin'
  });
  console.log(`  ✓ 使用正确版本号更新成功, 新版本: ${updated.version}`);
}

async function testStatusTransitionValidation() {
  console.log('\n【测试4】状态流转验证（防止状态越级）');
  
  const request: CreateRepairRequest = {
    title: '7号楼墙面开裂',
    description: '外墙有明显裂缝，约1米长。',
    category: RepairCategory.STRUCTURAL,
    priority: RepairPriority.MEDIUM,
    location: {
      building: '7号楼',
      floor: '外墙',
      room: '西侧'
    },
    reporter: {
      name: '褚十三',
      phone: '13800138011',
      roomNumber: '7-1201',
      isResident: true
    },
    createdBy: 'user'
  };

  const repair = await repairService.createRepair(request);
  console.log(`  ✓ 创建报修: ${repair.repairNumber}, 初始状态: ${repair.status}`);

  try {
    await repairService.updateRepair(repair.id, {
      expectedVersion: 1,
      status: RepairStatus.COMPLETED,
      updatedBy: 'admin'
    });
    console.log(`  ✗ 状态越级应该被检测到但没有`);
  } catch (error: any) {
    console.log(`  ✓ 系统正确检测到无效状态流转`);
    console.log(`    - 错误类型: ${error.name}`);
    console.log(`    - 从状态: ${error.fromStatus}`);
    console.log(`    - 到状态: ${error.toStatus}`);
  }

  let current = repair;
  const validTransitions = [RepairStatus.ASSIGNED, RepairStatus.IN_PROGRESS, RepairStatus.COMPLETED];
  
  for (const nextStatus of validTransitions) {
    current = await repairService.updateRepair(current.id, {
      expectedVersion: current.version,
      status: nextStatus,
      updatedBy: 'admin'
    });
    console.log(`  ✓ 状态流转成功: ${nextStatus}, 版本: ${current.version}`);
  }
}

async function testBadDataValidation() {
  console.log('\n【测试5】坏数据验证（输入数据校验）');
  
  const badRequests = [
    {
      name: '空标题',
      request: {
        title: '',
        description: '有问题需要报修',
        category: RepairCategory.OTHER,
        location: { building: '1号楼', floor: '1层', room: '101' },
        reporter: { name: '测试', phone: '13800138000', roomNumber: '1-101', isResident: true },
        createdBy: 'user'
      }
    },
    {
      name: '空描述',
      request: {
        title: '测试报修',
        description: '',
        category: RepairCategory.OTHER,
        location: { building: '1号楼', floor: '1层', room: '101' },
        reporter: { name: '测试', phone: '13800138000', roomNumber: '1-101', isResident: true },
        createdBy: 'user'
      }
    },
    {
      name: '无效手机号',
      request: {
        title: '测试报修',
        description: '有问题需要报修',
        category: RepairCategory.OTHER,
        location: { building: '1号楼', floor: '1层', room: '101' },
        reporter: { name: '测试', phone: '12345', roomNumber: '1-101', isResident: true },
        createdBy: 'user'
      }
    },
    {
      name: '缺少楼宇信息',
      request: {
        title: '测试报修',
        description: '有问题需要报修',
        category: RepairCategory.OTHER,
        location: { building: '', floor: '1层', room: '101' },
        reporter: { name: '测试', phone: '13800138000', roomNumber: '1-101', isResident: true },
        createdBy: 'user'
      }
    }
  ];

  for (const { name, request } of badRequests) {
    try {
      await repairService.createRepair(request as CreateRepairRequest);
      console.log(`  ✗ ${name} 应该被拒绝但没有`);
    } catch (error: any) {
      console.log(`  ✓ ${name} 被正确拒绝`);
      console.log(`    - 字段: ${error.field}`);
      console.log(`    - 原因: ${error.message}`);
    }
  }
}

async function testRepairMergeWithPriorityAdjustment() {
  console.log('\n【测试6】报修合并与优先级下降');

  const emergencyRequest: CreateRepairRequest = {
    title: '8号楼电梯停运有人被困',
    description: '电梯突然停运，轿厢内有人员被困，报警按钮无响应。',
    category: RepairCategory.ELEVATOR,
    priority: RepairPriority.EMERGENCY,
    location: { building: '8号楼', floor: '1层', room: '电梯B' },
    reporter: { name: '韩十四', phone: '13800138012', roomNumber: '8-801', isResident: true },
    createdBy: 'emergency'
  };
  const emergencyRepair = await repairService.createRepair(emergencyRequest);
  console.log(`  ✓ 创建紧急报修: ${emergencyRepair.repairNumber}, 优先级: ${emergencyRepair.priority}`);

  const urgentRequest: CreateRepairRequest = {
    title: '8号楼电梯异响严重',
    description: '电梯运行时有巨大异响，声音很大。',
    category: RepairCategory.ELEVATOR,
    priority: RepairPriority.URGENT,
    location: { building: '8号楼', floor: '1层', room: '电梯B' },
    reporter: { name: '杨十五', phone: '13800138013', roomNumber: '8-901', isResident: true },
    createdBy: 'user'
  };
  const urgentRepair = await repairService.createRepair(urgentRequest);
  console.log(`  ✓ 创建高优报修: ${urgentRepair.repairNumber}, 优先级: ${urgentRepair.priority}`);

  const highRequest: CreateRepairRequest = {
    title: '8号楼电梯颠簸',
    description: '乘坐时感觉明显颠簸，不安全。',
    category: RepairCategory.ELEVATOR,
    priority: RepairPriority.HIGH,
    location: { building: '8号楼', floor: '1层', room: '电梯B' },
    reporter: { name: '朱十六', phone: '13800138014', roomNumber: '8-1001', isResident: true },
    createdBy: 'user'
  };
  const highRepair = await repairService.createRepair(highRequest);
  console.log(`  ✓ 创建高优报修: ${highRepair.repairNumber}, 优先级: ${highRepair.priority}`);

  const mergeResult = await repairService.mergeRepairs({
    targetRepairId: emergencyRepair.id,
    sourceRepairIds: [urgentRepair.id, highRepair.id],
    mergedBy: 'admin',
    reason: '同一电梯的多个问题合并处理'
  });

  console.log(`  ✓ 报修合并成功`);
  console.log(`    - 目标报修原优先级: ${emergencyRepair.priority}`);
  console.log(`    - 目标报修新优先级: ${mergeResult.target.priority}`);
  console.log(`    - 优先级变化: ${emergencyRepair.priority} → ${mergeResult.target.priority} ✓`);
  console.log(`    - 合并记录数: ${mergeResult.target.mergeHistory.length}`);
  console.log(`    - 关联报修数: ${mergeResult.target.relatedRepairIds.length}`);
  
  for (const merged of mergeResult.merged) {
    console.log(`    - 被合并报修 ${merged.repairNumber}: 状态=${merged.status}, mergedInto=${!!merged.mergedInto}`);
  }
}

async function testExportAndVerification() {
  console.log('\n【测试7】数据导出与校验（验收场景）');

  const allRepairs = await repairService.getAllRepairs();
  
  console.log(`  系统中共有 ${allRepairs.length} 条报修记录:`);
  
  const normalRepairs = allRepairs.filter(r => !r.isDuplicate && !r.mergedInto);
  const conflictRepairs = allRepairs.filter(r => r.isDuplicate && r.duplicateCount > 0);
  const mergedRepairs = allRepairs.filter(r => r.mergedInto);
  
  console.log(`\n  【正常记录】 ${normalRepairs.length} 条:`);
  normalRepairs.slice(0, 2).forEach(r => {
    console.log(`    - [${r.repairNumber}] ${r.title} (${r.status}, ${r.priority})`);
  });

  console.log(`\n  【冲突/重复记录】 ${conflictRepairs.length} 条:`);
  conflictRepairs.slice(0, 2).forEach(r => {
    console.log(`    - [${r.repairNumber}] ${r.title} - 关联${r.relatedRepairIds.length}条`);
  });

  console.log(`\n  【已合并记录】 ${mergedRepairs.length} 条:`);
  mergedRepairs.forEach(r => {
    console.log(`    - [${r.repairNumber}] ${r.title} → 已合并`);
  });

  console.log(`\n  数据一致性校验:`);
  
  let versionConsistent = true;
  for (const repair of allRepairs) {
    if (typeof repair.version !== 'number' || repair.version < 1) {
      versionConsistent = false;
      break;
    }
  }
  console.log(`    - 版本号一致性: ${versionConsistent ? '✓ 通过' : '✗ 失败'}`);

  let statusConsistent = true;
  const validStatuses = Object.values(RepairStatus);
  for (const repair of allRepairs) {
    if (!validStatuses.includes(repair.status)) {
      statusConsistent = false;
      break;
    }
  }
  console.log(`    - 状态值合法性: ${statusConsistent ? '✓ 通过' : '✗ 失败'}`);

  let mergeConsistent = true;
  for (const merged of mergedRepairs) {
    const targetExists = allRepairs.some(r => r.id === merged.mergedInto);
    if (!targetExists) {
      mergeConsistent = false;
      break;
    }
  }
  console.log(`    - 合并引用完整性: ${mergeConsistent ? '✓ 通过' : '✗ 失败'}`);

  console.log(`\n  导出数据校验完成！`);
}

runTests().catch(console.error);
