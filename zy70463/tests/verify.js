const mongoose = require('mongoose');
const Reservation = require('../src/models/Reservation');
const PurchaseInquiry = require('../src/models/PurchaseInquiry');
const reservationService = require('../src/services/reservationService');
const inquiryService = require('../src/services/inquiryService');
const config = require('../src/config');

async function connectDB() {
  await mongoose.connect('mongodb://localhost:27017/resource_reservation_test');
  console.log('数据库连接成功');
}

async function clearData() {
  await Reservation.deleteMany({});
  await PurchaseInquiry.deleteMany({});
  console.log('测试数据已清除');
}

async function createTestReservations() {
  console.log('\n=== 创建测试预留记录 ===');
  
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
  console.log('正常预留创建成功:', result1.reservation.reservationNo);
  console.log('冲突数量:', result1.conflicts.length);
  
  await reservationService.approveReservation(result1.reservation._id, {
    approver: '李四',
    comment: '审批通过'
  });
  console.log('正常预留已审批');
  
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
  console.log('\n时间重叠的预留创建成功:', result2.reservation.reservationNo);
  console.log('检测到冲突数量:', result2.conflicts.length);
  
  if (result2.conflicts.length > 0) {
    console.log('\n=== 冲突详情 ===');
    result2.conflicts.forEach((conflict, index) => {
      console.log(`\n冲突 ${index + 1}:`);
      console.log('  被占用资源:', conflict.reservationNo);
      console.log('  申请人:', conflict.applicant);
      console.log('  部门:', conflict.applicantDepartment);
      console.log('  用途:', conflict.purpose);
      console.log('  重叠窗口:', conflict.overlappedWindow.start, '-', conflict.overlappedWindow.end);
      console.log('  释放计划:', conflict.releasePlan);
      console.log('  描述:', conflict.description);
    });
  }
  
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
  console.log('\n到期未释放的预留创建成功:', result3.reservation.reservationNo);
  
  await reservationService.approveReservation(result3.reservation._id, {
    approver: '孙七',
    comment: '演练审批'
  });
  console.log('到期预留已审批');
  
  return {
    normalId: result1.reservation._id,
    overlappingId: result2.reservation._id,
    expiredId: result3.reservation._id
  };
}

async function testConflictDetection(reservationIds) {
  console.log('\n=== 测试冲突检测 API ===');
  
  const conflicts = await reservationService.getConflicts(reservationIds.overlappingId);
  console.log('查询到冲突数量:', conflicts.length);
  
  const windowConflicts = await reservationService.checkConflictsByTimeWindow(
    new Date('2026-06-01T10:00:00'),
    new Date('2026-06-01T13:00:00'),
    [{ name: 'environment', value: 'production' }]
  );
  console.log('按时间窗口查询冲突数量:', windowConflicts.length);
}

async function testOccupancyProof(reservationIds) {
  console.log('\n=== 测试占用证明导出 ===');
  
  const proof = await reservationService.generateOccupancyProof(reservationIds.normalId);
  console.log('占用证明生成成功:');
  console.log('  预留编号:', proof.reservationNo);
  console.log('  申请人:', proof.applicant);
  console.log('  占用窗口:', proof.drillWindow.start, '-', proof.drillWindow.end);
  console.log('  审批人:', proof.approval ? proof.approval.approver : '未审批');
  console.log('  审批时间:', proof.approval ? proof.approval.approvedAt : 'N/A');
  console.log('  释放状态:', proof.release ? '已释放' : '未释放');
}

async function testRelease(reservationIds) {
  console.log('\n=== 测试提前释放 ===');
  
  const released = await reservationService.releaseReservation(reservationIds.expiredId, {
    releasedBy: '管理员',
    reason: '演练提前完成'
  });
  
  console.log('释放成功，当前状态:', released.status);
  console.log('释放人:', released.release.releasedBy);
  console.log('释放时间:', released.release.releasedAt);
  console.log('释放原因:', released.release.reason);
}

async function testPurchaseInquiry() {
  console.log('\n=== 测试采购询价单备注入库 ===');
  
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
  console.log('询价单创建成功:', inquiry.inquiryNo);
  
  await inquiryService.addItemRemark(inquiry._id, 1, '需要预装CentOS 7操作系统');
  console.log('行号1备注添加成功');
  
  await inquiryService.addItemRemark(inquiry._id, 2, '需要远程管理卡');
  console.log('行号2备注添加成功');
  
  await inquiryService.updateOverallRemark(inquiry._id, '本次采购为年度预算内项目，需在6月底前完成');
  console.log('整体备注更新成功');
  
  const item = await inquiryService.getItemByLineNumber(inquiry._id, 1);
  console.log('\n按行号查询结果:');
  console.log('  行号:', item.lineNumber);
  console.log('  品名:', item.itemName);
  console.log('  人工备注:', item.manualRemark);
  
  const report = await inquiryService.generateInquiryReport(inquiry._id);
  console.log('\n询价单报告生成成功，包含备注的明细:');
  report.items.forEach(item => {
    console.log(`  行${item.lineNumber}: ${item.itemName} - 备注: ${item.manualRemark || '无'}`);
  });
  console.log('  整体备注:', report.overallRemark);
}

async function main() {
  try {
    await connectDB();
    await clearData();
    
    const reservationIds = await createTestReservations();
    await testConflictDetection(reservationIds);
    await testOccupancyProof(reservationIds);
    await testRelease(reservationIds);
    await testPurchaseInquiry();
    
    console.log('\n=== 所有测试完成 ===');
    
  } catch (err) {
    console.error('测试失败:', err);
  } finally {
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  }
}

main();
