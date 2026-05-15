const reservationService = require('./src/services/reservationServiceStandalone');
const inquiryService = require('./src/services/inquiryServiceStandalone');

let passCount = 0;
let failCount = 0;

function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printSection(title) {
  console.log(`\n  ${title}`);
  console.log('  ' + '-'.repeat(50));
}

function test(name, fn) {
  try {
    fn();
    console.log(`    ✅ ${name}`);
    passCount++;
  } catch (error) {
    console.log(`    ❌ ${name}`);
    console.log(`       错误: ${error.message}`);
    failCount++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

async function runTests() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(15) + '资源预留器 - 核心功能验证' + ' '.repeat(17) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  reservationService.clearAllData();

  let reservationIds = {};

  printHeader('一、创建预留测试');

  printSection('1. 创建第一条正常预留');
  const normalReservation = {
    applicant: '张三',
    applicantDepartment: '技术部',
    purpose: '系统性能压测',
    pressureTestResource: {
      cpu: 8,
      memory: 16,
      memoryUnit: 'GB',
      instances: 4,
      description: '高性能服务器'
    },
    machineLabels: [
      { name: 'environment', value: 'production' },
      { name: 'zone', value: 'beijing' }
    ],
    drillWindow: {
      start: new Date('2026-06-01T09:00:00'),
      end: new Date('2026-06-01T12:00:00')
    }
  };

  const result1 = await reservationService.createReservation(normalReservation);
  reservationIds.normal = result1.reservation._id;

  test('预留编号生成正确', () => {
    assert(result1.reservation.reservationNo.startsWith('RES'), '编号格式错误');
  });
  test('申请人信息正确', () => {
    assert(result1.reservation.applicant === '张三', '申请人错误');
  });
  test('初始状态为待审批', () => {
    assert(result1.reservation.status === 'pending', '状态错误');
  });
  test('第一条预留无冲突', () => {
    assert(result1.conflicts.length === 0, '不应有冲突');
  });

  console.log(`     预留编号: ${result1.reservation.reservationNo}`);
  console.log(`     演练窗口: 09:00 - 12:00`);

  printSection('2. 审批第一条预留');
  const approved = await reservationService.approveReservation(reservationIds.normal, {
    approver: '李四',
    comment: '审批通过，同意使用'
  });

  test('审批后状态变为已批准', () => {
    assert(approved.status === 'approved', '审批状态错误');
  });
  test('审批人信息正确记录', () => {
    assert(approved.approval.approver === '李四', '审批人错误');
  });

  printSection('3. 创建时间重叠的预留（检测冲突）');
  const overlappingReservation = {
    applicant: '王五',
    applicantDepartment: '测试部',
    purpose: '接口压力测试',
    pressureTestResource: {
      cpu: 4,
      memory: 8,
      memoryUnit: 'GB',
      instances: 2,
      description: '标准服务器'
    },
    machineLabels: [
      { name: 'environment', value: 'production' },
      { name: 'zone', value: 'beijing' }
    ],
    drillWindow: {
      start: new Date('2026-06-01T11:00:00'),
      end: new Date('2026-06-01T14:00:00')
    }
  };

  const result2 = await reservationService.createReservation(overlappingReservation);
  reservationIds.overlapping = result2.reservation._id;

  test('检测到资源冲突', () => {
    assert(result2.conflicts.length > 0, '应检测到冲突');
  });
  test('冲突信息包含被占用预留编号', () => {
    assert(result2.conflicts[0].reservationNo, '缺少冲突预留编号');
  });
  test('冲突信息包含重叠窗口', () => {
    assert(result2.conflicts[0].overlappedWindow, '缺少重叠窗口');
  });

  console.log(`     冲突数量: ${result2.conflicts.length}`);
  console.log(`     被占用预留: ${result2.conflicts[0].reservationNo}`);
  console.log(`     申请人: ${result2.conflicts[0].applicant}`);
  console.log(`     重叠窗口: ${result2.conflicts[0].overlappedWindow.start.toISOString().substr(11, 5)} - ${result2.conflicts[0].overlappedWindow.end.toISOString().substr(11, 5)}`);
  console.log(`     释放计划: ${result2.conflicts[0].releasePlan}`);
  console.log(`     冲突描述: ${result2.conflicts[0].description}`);

  printSection('4. 创建到期未释放的预留');
  const expiredReservation = {
    applicant: '赵六',
    applicantDepartment: '运维部',
    purpose: '故障演练',
    pressureTestResource: {
      cpu: 16,
      memory: 32,
      memoryUnit: 'GB',
      instances: 8,
      description: '高性能集群'
    },
    machineLabels: [
      { name: 'environment', value: 'staging' },
      { name: 'zone', value: 'shanghai' }
    ],
    drillWindow: {
      start: new Date('2026-05-01T09:00:00'),
      end: new Date('2026-05-01T12:00:00')
    }
  };

  const result3 = await reservationService.createReservation(expiredReservation);
  reservationIds.expired = result3.reservation._id;

  await reservationService.approveReservation(reservationIds.expired, {
    approver: '孙七',
    comment: '演练审批'
  });

  test('到期预留状态为已批准', () => {
    const r = await reservationService.getReservationById(reservationIds.expired);
    assert(r.status === 'approved', '状态应为已批准');
  });

  printHeader('二、冲突查询测试');

  printSection('1. 通过预留ID查询冲突');
  const conflicts = await reservationService.getConflicts(reservationIds.overlapping);
  test('查询到冲突数量正确', () => {
    assert(conflicts.length === 1, '冲突数量错误');
  });

  printSection('2. 通过时间窗口检测冲突');
  const windowConflicts = await reservationService.checkConflictsByTimeWindow(
    new Date('2026-06-01T10:00:00'),
    new Date('2026-06-01T13:00:00'),
    [{ name: 'environment', value: 'production' }]
  );
  test('时间窗口检测到冲突', () => {
    assert(windowConflicts.length > 0, '应检测到冲突');
  });

  printHeader('三、资源释放测试');

  printSection('1. 提前释放资源');
  const released = await reservationService.releaseReservation(reservationIds.expired, {
    releasedBy: '管理员',
    reason: '演练提前完成'
  });

  test('释放后状态变为已释放', () => {
    assert(released.status === 'released', '释放状态错误');
  });
  test('释放人信息正确记录', () => {
    assert(released.release.releasedBy === '管理员', '释放人错误');
  });
  test('释放原因正确记录', () => {
    assert(released.release.reason === '演练提前完成', '释放原因错误');
  });

  console.log(`     释放时间: ${released.release.releasedAt.toISOString()}`);

  printHeader('四、占用证明导出测试');

  printSection('1. 生成占用证明');
  const proof = await reservationService.generateOccupancyProof(reservationIds.normal);

  test('占用证明包含预留编号', () => {
    assert(proof.reservationNo, '缺少预留编号');
  });
  test('占用证明包含演练窗口', () => {
    assert(proof.drillWindow.start && proof.drillWindow.end, '缺少演练窗口');
  });
  test('占用证明包含审批信息', () => {
    assert(proof.approval && proof.approval.approver, '缺少审批信息');
  });

  console.log(`     预留编号: ${proof.reservationNo}`);
  console.log(`     申请人: ${proof.applicant}`);
  console.log(`     部门: ${proof.applicantDepartment}`);
  console.log(`     用途: ${proof.purpose}`);
  console.log(`     窗口: ${proof.drillWindow.start.toISOString().substr(0, 16)} - ${proof.drillWindow.end.toISOString().substr(0, 16)}`);
  console.log(`     审批人: ${proof.approval.approver}`);
  console.log(`     审批时间: ${proof.approval.approvedAt.toISOString().substr(0, 16)}`);
  console.log(`     状态: ${proof.status}`);
  console.log(`     证明生成时间: ${proof.generatedAt.toISOString().substr(0, 16)}`);

  printSection('2. 导出为 JSON 格式（内存演示）');
  const jsonProof = JSON.stringify(proof, null, 2);
  test('JSON导出成功', () => {
    assert(jsonProof.length > 0, 'JSON导出失败');
  });
  console.log(`     JSON 大小: ${jsonProof.length} 字符`);

  printHeader('五、采购询价单备注测试');

  printSection('1. 创建询价单');
  const inquiryData = {
    title: '2026年Q2服务器采购',
    applicant: '采购专员',
    applicantDepartment: '采购部',
    items: [
      {
        lineNumber: 1,
        itemName: '高性能服务器',
        specification: '16核32GB',
        quantity: 10,
        unit: '台',
        estimatedPrice: 50000
      },
      {
        lineNumber: 2,
        itemName: '标准服务器',
        specification: '8核16GB',
        quantity: 20,
        unit: '台',
        estimatedPrice: 30000
      },
      {
        lineNumber: 3,
        itemName: '存储服务器',
        specification: '4核8GB 4TB',
        quantity: 5,
        unit: '台',
        estimatedPrice: 40000
      }
    ]
  };

  const inquiry = await inquiryService.createInquiry(inquiryData);
  const inquiryId = inquiry._id;

  test('询价单编号生成正确', () => {
    assert(inquiry.inquiryNo.startsWith('INQ'), '询价单编号格式错误');
  });
  test('询价单包含3条明细', () => {
    assert(inquiry.items.length === 3, '明细数量错误');
  });

  console.log(`     询价单编号: ${inquiry.inquiryNo}`);

  printSection('2. 添加行备注');
  await inquiryService.addItemRemark(inquiryId, 1, '需要预装CentOS 7操作系统');
  await inquiryService.addItemRemark(inquiryId, 2, '需要远程管理卡，支持IPMI');

  test('行号1备注正确添加', async () => {
    const item = await inquiryService.getItemByLineNumber(inquiryId, 1);
    assert(item.manualRemark === '需要预装CentOS 7操作系统', '备注内容错误');
  });
  test('行号2备注正确添加', async () => {
    const item = await inquiryService.getItemByLineNumber(inquiryId, 2);
    assert(item.manualRemark === '需要远程管理卡，支持IPMI', '备注内容错误');
  });

  printSection('3. 添加整体备注');
  await inquiryService.updateOverallRemark(inquiryId, '本次采购为年度预算内项目，需在6月底前完成交付验收');

  printSection('4. 按行号查询');
  const item1 = await inquiryService.getItemByLineNumber(inquiryId, 1);
  console.log(`     行号: ${item1.lineNumber}`);
  console.log(`     品名: ${item1.itemName}`);
  console.log(`     规格: ${item1.specification}`);
  console.log(`     数量: ${item1.quantity} ${item1.unit}`);
  console.log(`     人工备注: ${item1.manualRemark}`);

  printSection('5. 生成询价单报告');
  const report = await inquiryService.generateInquiryReport(inquiryId);

  test('报告包含整体备注', () => {
    assert(report.overallRemark, '缺少整体备注');
  });
  test('报告明细包含行备注', () => {
    assert(report.items[0].manualRemark, '明细缺少备注');
  });

  console.log(`     询价单: ${report.inquiryNo}`);
  console.log(`     整体备注: ${report.overallRemark}`);
  report.items.forEach(item => {
    console.log(`     行${item.lineNumber}: ${item.itemName} - ${item.manualRemark || '无备注'}`);
  });

  printHeader('六、冲突来源解释验证');

  printSection('验证三条测试数据的状态');
  const allReservations = await reservationService.getAllReservations();
  console.log(`     总预留数: ${allReservations.length}`);
  allReservations.forEach(r => {
    console.log(`       ${r.reservationNo} - ${r.applicant} - ${r.status}`);
  });

  test('正常预留无冲突', async () => {
    const conflicts = await reservationService.getConflicts(reservationIds.normal);
    assert(conflicts.length === 0, '正常预留不应有冲突');
  });

  test('重叠预留正确解释冲突来源', async () => {
    const conflicts = await reservationService.getConflicts(reservationIds.overlapping);
    assert(conflicts.length === 1, '应检测到1个冲突');
    assert(conflicts[0].applicant === '张三', '冲突来源申请人错误');
    assert(conflicts[0].applicantDepartment === '技术部', '冲突来源部门错误');
  });

  printHeader('测试总结');

  console.log(`\n  总测试项: ${passCount + failCount}`);
  console.log(`  通过: ${passCount} 项 ✅`);
  console.log(`  失败: ${failCount} 项 ❌`);

  if (failCount === 0) {
    console.log('\n  🎉 所有核心功能验证通过！');
    console.log('  ✅ 创建预留');
    console.log('  ✅ 冲突检测（时间重叠+标签匹配）');
    console.log('  ✅ 审批流程');
    console.log('  ✅ 提前释放');
    console.log('  ✅ 占用证明导出');
    console.log('  ✅ 采购询价单备注入库');
    console.log('  ✅ 按行号查询备注');
    console.log('  ✅ 冲突来源解释');
  } else {
    console.log('\n  ⚠️  部分测试未通过，请检查代码');
  }

  console.log('\n' + '═'.repeat(60) + '\n');

  return failCount === 0;
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
}).then(success => {
  process.exit(success ? 0 : 1);
});
