const fs = require('fs');
const path = require('path');
const { closeDatabase } = require('../src/storage/database');
const lineService = require('../src/services/lineService');
const studentService = require('../src/services/studentService');
const driverService = require('../src/services/driverService');
const diversionService = require('../src/services/diversionService');
const notificationService = require('../src/services/notificationService');
const exportService = require('../src/services/exportService');

const TEST_DB_PATH = path.join(__dirname, '../data/schoolbus.db');

function cleanup() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    if (fs.existsSync(TEST_DB_PATH + '-wal')) {
      fs.unlinkSync(TEST_DB_PATH + '-wal');
    }
    if (fs.existsSync(TEST_DB_PATH + '-shm')) {
      fs.unlinkSync(TEST_DB_PATH + '-shm');
    }
  } catch (e) {
  }
}

const tests = [];
const results = { passed: 0, failed: 0 };

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFalse(condition, message) {
  if (condition) {
    throw new Error(message);
  }
}

test('1. 创建线路和站点', async () => {
  const result1 = lineService.createLine('L1', '一号线', '城东方向');
  assertTrue(result1.success, '创建L1线路应成功');

  const result2 = lineService.createLine('L1', '重复线路');
  assertFalse(result2.success, '创建重复线路应失败');

  const result3 = lineService.addStopToLine('L1', 'S1', '东门站', '东门路口', 1);
  assertTrue(result3.success, '添加站点S1应成功');

  const result4 = lineService.addStopToLine('L1', 'S2', '南门站', '南门路口', 2);
  assertTrue(result4.success, '添加站点S2应成功');

  const result5 = lineService.addStopToLine('L1', 'S3', '西门站', '西门路口', 3);
  assertTrue(result5.success, '添加站点S3应成功');
});

test('2. 创建学生并分配到线路', async () => {
  const result1 = studentService.createStudent('S001', '小明', '一年级', '一班');
  assertTrue(result1.success, '创建小明应成功');

  const result2 = studentService.createStudent('S002', '小红', '一年级', '一班');
  assertTrue(result2.success, '创建小红应成功');

  const result3 = studentService.createStudent('S003', '小刚', '二年级', '二班');
  assertTrue(result3.success, '创建小刚应成功');

  const result4 = studentService.assignStudentToLine('S001', 'L1', 'S1');
  assertTrue(result4.success, '分配小明到S1应成功');

  const result5 = studentService.assignStudentToLine('S002', 'L1', 'S2');
  assertTrue(result5.success, '分配小红到S2应成功');

  const result6 = studentService.assignStudentToLine('S003', 'L1', 'S3');
  assertTrue(result6.success, '分配小刚到S3应成功');
});

test('3. 添加家长联系人', async () => {
  const result1 = studentService.addParent('S001', '明父', '13800138001', '父亲');
  assertTrue(result1.success, '添加小明父亲应成功');

  const result2 = studentService.addParent('S001', '明母', '13800138002', '母亲');
  assertTrue(result2.success, '添加小明母亲应成功');

  const result3 = studentService.addParent('S002', '红父', '13800138003', '父亲');
  assertTrue(result3.success, '添加小红父亲应成功');

  const result4 = studentService.addParent('S003', '刚父', '13800138004', '父亲');
  assertTrue(result4.success, '添加小刚父亲应成功');
});

test('4. 同一学生在两条线路的情况', async () => {
  const result1 = lineService.createLine('L2', '二号线', '城西方向');
  assertTrue(result1.success, '创建L2线路应成功');

  lineService.addStopToLine('L2', 'W1', '西站', '西路1号', 1);
  lineService.addStopToLine('L2', 'W2', '北站', '北路1号', 2);

  const result2 = studentService.assignStudentToLine('S001', 'L2', 'W1');
  assertTrue(result2.success, '小明分配到L2应成功');
  assertTrue(result2.warning !== undefined, '应有跨线路警告');

  const details = studentService.getStudentDetails('S001');
  assertTrue(details.lines.length === 2, '小明应该在2条线路上');
});

test('5. 创建司机和排班', async () => {
  const result1 = driverService.createDriver('D01', '张司机', '13900139001', '京A12345');
  assertTrue(result1.success, '创建张司机应成功');

  const result2 = driverService.createDriver('D02', '李司机', '13900139002', '京A67890');
  assertTrue(result2.success, '创建李司机应成功');

  const result3 = driverService.createShift('AM', '早班', '07:00', '09:00');
  assertTrue(result3.success, '创建早班应成功');

  const result4 = driverService.createShift('PM', '晚班', '16:00', '18:00');
  assertTrue(result4.success, '创建晚班应成功');

  const result5 = driverService.assignDriverToLine('D01', 'L1', 'AM', '2026-05-01');
  assertTrue(result5.success, '分配张司机到L1早班应成功');

  const result6 = driverService.assignDriverToLine('D02', 'L1', 'PM', '2026-05-01');
  assertTrue(result6.success, '分配李司机到L1晚班应成功');
});

test('6. 创建请假记录', async () => {
  const result1 = studentService.addLeave('S003', '2026-05-11', '生病请假');
  assertTrue(result1.success, '小刚请假应成功');

  const result2 = studentService.addLeave('S003', '2026-05-11', '重复请假');
  assertFalse(result2.success, '同一天重复请假应失败');
});

test('7. 创建临时改线（幂等性测试）', async () => {
  const changes = [
    { lineCode: 'L1', originalStopCode: 'S1', newStopCode: 'S2', isSkipped: false },
    { lineCode: 'L1', originalStopCode: 'S3', newStopCode: null, isSkipped: true }
  ];

  const result1 = diversionService.createDiversion('2026-05-11', '道路施工', changes);
  assertTrue(result1.success, '第一次创建改线应成功');
  assertFalse(result1.isDuplicate, '第一次不应是重复');
  assertTrue(result1.diversionLines.length === 2, '应有2条站点变更');

  const result2 = diversionService.createDiversion('2026-05-11', '道路施工', changes);
  assertTrue(result2.success, '重复执行相同内容应成功');
  assertTrue(result2.isDuplicate, '应识别为重复');

  const differentChanges = [
    { lineCode: 'L1', originalStopCode: 'S1', newStopCode: 'S3', isSkipped: false }
  ];
  const result3 = diversionService.createDiversion('2026-05-11', '不同原因', differentChanges);
  assertFalse(result3.success, '不同内容的改线应失败');
});

test('8. 生成通知（请假学生不应收到通知）', async () => {
  const result1 = diversionService.generateNotifications('2026-05-11');
  assertTrue(result1.success, '生成通知应成功');
  assertFalse(result1.isDuplicate, '第一次生成不应是重复');

  assertTrue(result1.skippedBecauseOfLeave.length >= 1, '应有请假的学生被跳过');

  const result2 = diversionService.generateNotifications('2026-05-11');
  assertTrue(result2.success, '重复生成应成功');
  assertTrue(result2.isDuplicate, '应识别为重复生成');
});

test('9. 生成三种版本的通知', async () => {
  const driverNotif = notificationService.generateDriverNotification('2026-05-11');
  assertTrue(driverNotif !== null, '应能生成司机版通知');
  assertTrue(driverNotif.driverNotifications.length > 0, '应有司机通知');

  const teacherNotif = notificationService.generateTeacherNotification('2026-05-11');
  assertTrue(teacherNotif !== null, '应能生成老师版通知');
  assertTrue(teacherNotif.summary.totalLines > 0, '应有线路汇总');
  assertTrue(teacherNotif.summary.totalLeaves === 1, '应有1条请假记录');

  const formattedDriver = notificationService.formatDriverNotification(driverNotif);
  assertTrue(formattedDriver.length > 0, '司机版通知应能格式化');

  const formattedTeacher = notificationService.formatTeacherNotification(teacherNotif);
  assertTrue(formattedTeacher.length > 0, '老师版通知应能格式化');

  const formattedParent = notificationService.formatParentNotifications('2026-05-11');
  assertTrue(formattedParent.length > 0, '家长版通知应能格式化');
});

test('10. 检查站点被删除（停用）但有学生的警告', async () => {
  const consistency = lineService.checkLineConsistency('L1');
  assertTrue(consistency.valid, '线路一致性检查应通过');

  const lines = lineService.listLines();
  const l1 = lines.find(l => l.code === 'L1');

  const details = lineService.getLineDetails('L1');
  const s1Stop = details.stops.find(s => s.code === 'S1');

  const stopRepo = require('../src/storage/stopRepository');
  stopRepo.updateStop(s1Stop.id, { isActive: false });

  const consistency2 = lineService.checkLineConsistency('L1');
  assertTrue(consistency2.warnings.length > 0, '应有关于已停用站点有学生的警告');
});

test('11. 验证driver assign 幂等性（重复执行不重复插入）', async () => {
  const scheduleBefore = driverService.getDriverSchedule('2026-05-10');
  const countBefore = scheduleBefore.filter(a => a.driverName === '张司机' && a.shiftCode === 'AM').length;

  const result1 = driverService.assignDriverToLine('D01', 'L1', 'AM', '2026-05-10');
  assertTrue(result1.success, '第一次分配应成功');

  const scheduleAfter1 = driverService.getDriverSchedule('2026-05-10');
  const countAfter1 = scheduleAfter1.filter(a => a.driverName === '张司机' && a.shiftCode === 'AM').length;
  assertTrue(countAfter1 === countBefore + 1, '第一次分配后排班数应增加1');

  const result2 = driverService.assignDriverToLine('D01', 'L1', 'AM', '2026-05-10');
  assertFalse(result2.success, '重复分配应失败');
  assertTrue(result2.isDuplicate, '应标记为重复');

  const scheduleAfter2 = driverService.getDriverSchedule('2026-05-10');
  const countAfter2 = scheduleAfter2.filter(a => a.driverName === '张司机' && a.shiftCode === 'AM').length;
  assertTrue(countAfter2 === countAfter1, '重复分配后排班数应保持不变');
});

test('12. 验证student add-parent 幂等性（重复添加不变成2条）', async () => {
  const detailsBefore = studentService.getStudentDetails('S002');
  const countBefore = detailsBefore.parents.length;

  const result1 = studentService.addParent('S002', '红母', '13800138005', '母亲');
  assertTrue(result1.success, '第一次添加应成功');

  const detailsAfter1 = studentService.getStudentDetails('S002');
  const countAfter1 = detailsAfter1.parents.length;
  assertTrue(countAfter1 === countBefore + 1, '第一次添加后联系人数应增加1');

  const result2 = studentService.addParent('S002', '红母2号', '13800138005', '母亲');
  assertFalse(result2.success, '同电话重复添加应失败');
  assertTrue(result2.isDuplicate, '应标记为重复');

  const detailsAfter2 = studentService.getStudentDetails('S002');
  const countAfter2 = detailsAfter2.parents.length;
  assertTrue(countAfter2 === countAfter1, '重复添加后联系人数应保持不变');
});

test('13. 验证多家长时通知应为每个家长生成一条', async () => {
  const diversionRepo = require('../src/storage/diversionRepository');
  const diversion = diversionService.getDiversion('2026-05-11');

  const details = studentService.getStudentDetails('S001');
  const parentCount = details.parents.length;
  assertTrue(parentCount >= 2, '小明应有至少2个家长');

  const notifications = diversionRepo.getNotifications(diversion.id, 'parent');
  const xiaomingNotifications = notifications.filter(n => n.studentName === '小明');

  assertTrue(xiaomingNotifications.length === parentCount, '小明的通知数应等于家长数（2条）');

  const parentNames = xiaomingNotifications.map(n => n.parentName).sort();
  assertTrue(parentNames.includes('明父'), '应有发给明父的通知');
  assertTrue(parentNames.includes('明母'), '应有发给明母的通知');
});

test('14. 导出存档（包含多家长通知数据）', async () => {
  const exportDir = path.join(__dirname, '../exports');
  const result = exportService.exportDiversionArchive('2026-05-11', exportDir);
  assertTrue(result.success, '导出存档应成功');

  assertTrue(fs.existsSync(result.jsonPath), 'JSON存档文件应存在');
  assertTrue(fs.existsSync(result.textPath), 'TXT存档文件应存在');

  const jsonContent = JSON.parse(fs.readFileSync(result.jsonPath, 'utf-8'));
  assertTrue(jsonContent.date === '2026-05-11', '存档日期应正确');
  assertTrue(jsonContent.diversionLines.length > 0, '存档应有改线记录');
  assertTrue(jsonContent.leaves.length > 0, '存档应有请假记录');
  assertTrue(jsonContent.notifications.length > 0, '存档应有通知记录');

  const xiaomingNotifs = jsonContent.notifications.filter(n => n.studentName === '小明' && n.type === 'parent');
  assertTrue(xiaomingNotifs.length === 2, '存档中小明应有2条家长通知');
});

async function runTests() {
  cleanup();

  console.log('\n========================================');
  console.log('  校车临时改线通知 CLI 测试');
  console.log('========================================\n');

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✓ ${test.name}`);
      results.passed++;
    } catch (err) {
      console.log(`✗ ${test.name}`);
      console.log(`  ${err.message}`);
      results.failed++;
    }
  }

  console.log('\n========================================');
  console.log(`  测试结果: ${results.passed} 个通过, ${results.failed} 个失败`);
  console.log('========================================\n');

  closeDatabase();

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests();
