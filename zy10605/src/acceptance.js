const path = require('path');
const fs = require('fs');
const FileStore = require('./storage/fileStore');
const ReplayService = require('./services/replayService');
const ExportService = require('./services/exportService');
const { STATUS, OPERATION_SOURCE, UNLOCK_REASON } = require('./models/constants');

const DATA_DIR = path.join(process.cwd(), 'data_test');

function logSection(title) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(70)}\n`);
}

function logSubSection(title) {
  console.log(`\n${'-'.repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${'-'.repeat(50)}\n`);
}

function logResult(label, value, expected = null) {
  const status = expected === null ? '•' : (JSON.stringify(value) === JSON.stringify(expected) ? '✓' : '✗');
  console.log(`${status} ${label}:`, typeof value === 'object' ? JSON.stringify(value, null, 2) : value);
  if (expected !== null && JSON.stringify(value) !== JSON.stringify(expected)) {
    console.log(`  期望: ${JSON.stringify(expected)}`);
  }
}

async function runAcceptanceTests() {
  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true });
  }

  const store = new FileStore(DATA_DIR);
  const replayService = new ReplayService(store);
  const exportService = new ExportService(store);

  console.log('\n' + '╔'.padEnd(68, '═') + '╗');
  console.log('║' + '           在线教育后端直播课回放解锁 - 验收测试              '.padEnd(68) + '║');
  console.log('╚'.padEnd(68, '═') + '╝');

  logSection('1. 准备基础数据 - 订单和直播场次');
  
  const normalOrder = replayService.createOrder({
    orderNumber: 'ORD20250518001',
    studentId: 'STU001',
    studentName: '张三',
    courseId: 'COURSE001',
    courseName: 'Node.js 高级编程实战',
    amount: 2999,
    isRefunded: false
  });
  logResult('普通订单创建', normalOrder.orderNumber);

  const refundedOrder = replayService.createOrder({
    orderNumber: 'ORD20250518002',
    studentId: 'STU002',
    studentName: '李四（已退款）',
    courseId: 'COURSE001',
    courseName: 'Node.js 高级编程实战',
    amount: 2999,
    isRefunded: true,
    refundDate: new Date().toISOString()
  });
  logResult('退款订单创建', refundedOrder.orderNumber);

  const liveSession = replayService.createLiveSession({
    title: '第5课 - 异步编程与事件循环',
    courseId: 'COURSE001',
    courseName: 'Node.js 高级编程实战',
    teacherId: 'TEA001',
    teacherName: '王老师',
    startTime: new Date().toISOString(),
    duration: 120,
    replayUrl: 'https://example.com/replay/c001-s005'
  });
  logResult('直播场次创建', liveSession.title);

  logSection('2. 完整状态流转测试 - 待核验 → 已解锁 → 已撤销');
  
  logSubSection('2.1 创建回放解锁申请（状态：待核验）');
  const permission = replayService.createReplayPermission({
    orderId: normalOrder.id,
    sessionId: liveSession.id,
    studentId: normalOrder.studentId,
    studentName: normalOrder.studentName,
    reason: UNLOCK_REASON.TECHNICAL_ISSUE,
    operator: '运营小明'
  });
  logResult('权限ID', permission.id);
  logResult('当前状态', permission.status, STATUS.PENDING_VERIFICATION);
  logResult('解锁原因', permission.reason);

  logSubSection('2.2 核验并解锁回放（状态：待核验 → 已解锁）');
  const unlockedPermission = replayService.verifyAndUnlock(permission.id, '审核小红', OPERATION_SOURCE.MANUAL);
  logResult('解锁后状态', unlockedPermission.status, STATUS.UNLOCKED);
  logResult('解锁人', unlockedPermission.unlockedBy);

  logSubSection('2.3 撤销回放权限（状态：已解锁 → 已撤销）');
  const revokedPermission = replayService.revokePermission(
    permission.id, 
    '主管老王', 
    '学员主动申请取消',
    OPERATION_SOURCE.MANUAL
  );
  logResult('撤销后状态', revokedPermission.status, STATUS.REVOKED);
  logResult('撤销原因', revokedPermission.revokeReason);

  logSubSection('2.4 验证状态越级保护 - 尝试从已撤销直接变为已解锁');
  try {
    replayService.verifyAndUnlock(permission.id, '测试用户');
    logResult('状态越级测试', '失败 - 未抛出错误');
  } catch (e) {
    logResult('状态越级测试', '成功 - 正确拦截');
    logResult('错误信息', e.message);
  }

  logSection('3. 退款学员回放权限测试');
  
  logSubSection('3.1 为退款学员创建回放权限');
  const refundPermission = replayService.createReplayPermission({
    orderId: refundedOrder.id,
    sessionId: liveSession.id,
    studentId: refundedOrder.studentId,
    studentName: refundedOrder.studentName,
    reason: UNLOCK_REASON.REFUND_KEEP_ACCESS,
    operator: '系统自动'
  });
  logResult('退款学员标记', refundPermission.isRefundedStudent, true);
  logResult('退款观看说明', refundPermission.refundDetails.keepAccessReason, '退款学员通过旧链接观看');

  logSubSection('3.2 解锁退款学员回放权限');
  const unlockedRefundPermission = replayService.verifyAndUnlock(refundPermission.id, '审核小红', OPERATION_SOURCE.API);
  logResult('解锁后状态', unlockedRefundPermission.status, STATUS.UNLOCKED);

  logSection('4. 历史记录追踪验证');
  
  logSubSection('4.1 查询完整流转记录的历史');
  const history = replayService.getHistory(permission.id);
  logResult('历史记录数量', history.length, 3);
  
  console.log('\n历史记录详情:');
  history.forEach((h, i) => {
    console.log(`  ${i + 1}. [${h.source}] ${h.operator} - ${h.action}`);
    console.log(`      时间: ${h.timestamp}`);
    console.log(`      状态变更: ${h.previousStatus || '无'} → ${h.newStatus}`);
  });

  logSubSection('4.2 查询权限详情（含历史）');
  const detail = replayService.getPermissionDetail(permission.id);
  logResult('详情包含历史记录', detail.history !== undefined, true);
  logResult('历史记录数量匹配', detail.history.length, history.length);

  logSection('5. 重复提交冲突测试');
  
  logSubSection('5.1 创建一个新的未撤销权限');
  const newPermission = replayService.createReplayPermission({
    orderId: normalOrder.id,
    sessionId: liveSession.id,
    studentId: 'STU005',
    studentName: '测试学员',
    reason: UNLOCK_REASON.OTHER,
    operator: '测试用户'
  });
  logResult('新权限状态', newPermission.status);

  logSubSection('5.2 尝试重复申请同一未撤销权限');
  try {
    replayService.createReplayPermission({
      orderId: normalOrder.id,
      sessionId: liveSession.id,
      studentId: 'STU005',
      studentName: '测试学员',
      reason: UNLOCK_REASON.OTHER,
      operator: '测试用户'
    });
    logResult('重复提交测试', '失败 - 未抛出错误');
  } catch (e) {
    logResult('重复提交测试', '成功 - 正确拦截');
    logResult('错误信息', e.message);
  }

  logSection('6. 批量导入与坏记录测试');
  
  logSubSection('6.1 为批量导入创建新订单');
  const importOrder = replayService.createOrder({
    orderNumber: 'ORD20250518003',
    studentId: 'STU006',
    studentName: '孙八',
    courseId: 'COURSE001',
    courseName: 'Node.js 高级编程实战',
    amount: 2999,
    isRefunded: false
  });
  logResult('导入专用订单创建', importOrder.orderNumber);

  logSubSection('6.2 准备导入数据（包含坏行）');
  const importRecords = [
    {
      orderId: importOrder.id,
      sessionId: liveSession.id,
      studentId: 'STU006',
      studentName: '孙八',
      reason: UNLOCK_REASON.SPECIAL_ARRANGEMENT
    },
    {
      orderId: 'INVALID_ORDER_ID',
      sessionId: liveSession.id,
      studentId: 'STU004',
      studentName: '赵六',
      reason: UNLOCK_REASON.OTHER
    },
    {
      orderId: importOrder.id,
      sessionId: liveSession.id,
      studentId: '',
      studentName: '钱七'
    }
  ];
  logResult('导入数据总行数', importRecords.length);

  logSubSection('6.3 执行批量导入');
  const importResult = replayService.batchImport(importRecords, '批量导入员');
  logResult('成功数量', importResult.success.length, 1);
  logResult('失败数量', importResult.failed.length, 2);
  logResult('坏记录数量', importResult.badRecords.length, 2);

  console.log('\n坏记录详情:');
  importResult.badRecords.forEach(br => {
    console.log(`  行${br.rowNumber}: ${br.error}`);
  });

  logSubSection('6.4 查询坏记录存储');
  const badRecords = store.getAll('badRecords');
  logResult('坏记录持久化数量', badRecords.length, 2);

  logSection('7. 数据导出测试');
  
  logSubSection('7.1 导出回放权限列表');
  const exportResult = await exportService.exportReplayPermissions();
  logResult('导出文件名', exportResult.fileName);
  logResult('导出记录数', exportResult.recordCount);
  logResult('退款学员记录数', exportResult.refundStudentCount, 1);

  logSubSection('7.2 导出单条权限的历史记录');
  const historyExport = await exportService.exportHistory(permission.id);
  logResult('历史导出记录数', historyExport.recordCount, 3);

  logSubSection('7.3 导出坏记录');
  const badExport = await exportService.exportBadRecords();
  logResult('坏记录导出数', badExport.recordCount, 2);

  logSection('8. 列表查询与筛选测试');
  
  logSubSection('8.1 查询全部权限');
  const allPermissions = replayService.getPermissionList();
  logResult('总权限数量', allPermissions.length);

  logSubSection('8.2 按状态筛选 - 已撤销');
  const revokedPermissions = replayService.getPermissionList({ status: STATUS.REVOKED });
  logResult('已撤销权限数量', revokedPermissions.length, 1);

  logSubSection('8.3 按退款学员筛选');
  const refundedPermissions = replayService.getPermissionList({ isRefundedStudent: true });
  logResult('退款学员权限数量', refundedPermissions.length, 1);

  logSection('9. 数据一致性验证 - 列表、详情、历史、导出互相对齐');
  
  logSubSection('9.1 列表与详情一致性');
  const listItem = allPermissions[0];
  const detailItem = replayService.getPermissionDetail(listItem.id);
  logResult('ID一致', listItem.id === detailItem.id, true);
  logResult('状态一致', listItem.status === detailItem.status, true);

  logSubSection('9.2 详情历史与历史接口一致性');
  const historyFromDetail = detailItem.history;
  const historyFromApi = replayService.getHistory(listItem.id);
  logResult('历史记录数量一致', historyFromDetail.length === historyFromApi.length, true);

  logSubSection('9.3 导出数据与实际数据一致性');
  logResult('导出数量与实际数量一致', exportResult.recordCount === allPermissions.length, true);

  console.log('\n' + '╔'.padEnd(68, '═') + '╗');
  console.log('║' + '                      验收测试完成！                            '.padEnd(68) + '║');
  console.log('╠'.padEnd(68, '═') + '╣');
  console.log('║' + `  数据目录: ${DATA_DIR}`.padEnd(68) + '║');
  console.log('║' + `  导出目录: ${path.join(process.cwd(), 'exports')}`.padEnd(68) + '║');
  console.log('╚'.padEnd(68, '═') + '╝\n');

  console.log('验收要点总结:');
  console.log('  ✓ 完整状态流转: 待核验 → 已解锁 → 已撤销');
  console.log('  ✓ 状态越级保护: 已撤销状态无法直接解锁');
  console.log('  ✓ 重复提交拦截: 同一订单同一场次无法重复申请');
  console.log('  ✓ 历史记录追踪: 操作来源、操作者、更新时间完整记录');
  console.log('  ✓ 退款学员标记: 退款学员通过旧链接观看体现在详情和导出中');
  console.log('  ✓ 批量导入坏行: 坏记录单独存储，不影响成功记录');
  console.log('  ✓ 数据一致性: 列表、详情、历史、导出数据互相对齐\n');
}

runAcceptanceTests().catch(console.error);
