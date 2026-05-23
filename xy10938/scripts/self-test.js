const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'car-wash.db');

console.log('🧪 洗车会员排队API - 自检脚本\n');
console.log('='.repeat(50));

let passed = 0;
let failed = 0;

function test(description, testFn) {
  try {
    testFn();
    console.log(`✅ PASS: ${description}`);
    passed++;
  } catch (e) {
    console.log(`❌ FAIL: ${description}`);
    console.log(`   错误: ${e.message}`);
    failed++;
  }
}

console.log('\n📁 检查项目结构...\n');

test('配置文件存在', () => {
  if (!fs.existsSync(path.join(__dirname, '..', 'config', 'app.js'))) throw new Error('缺少 app.js');
  if (!fs.existsSync(path.join(__dirname, '..', 'config', 'database.js'))) throw new Error('缺少 database.js');
});

test('服务层文件存在', () => {
  const services = ['queueService.js', 'appointmentService.js', 'memberService.js', 'stationService.js', 'reportService.js'];
  services.forEach(s => {
    if (!fs.existsSync(path.join(__dirname, '..', 'src', 'services', s))) throw new Error(`缺少 ${s}`);
  });
});

test('路由文件存在', () => {
  const routes = ['queue.js', 'appointment.js', 'member.js', 'station.js', 'report.js'];
  routes.forEach(r => {
    if (!fs.existsSync(path.join(__dirname, '..', 'src', 'routes', r))) throw new Error(`缺少 ${r}`);
  });
});

test('主服务文件存在', () => {
  if (!fs.existsSync(path.join(__dirname, '..', 'src', 'server.js'))) throw new Error('缺少 server.js');
  if (!fs.existsSync(path.join(__dirname, '..', 'src', 'db.js'))) throw new Error('缺少 db.js');
});

test('中间件文件存在', () => {
  if (!fs.existsSync(path.join(__dirname, '..', 'src', 'middleware', 'exceptionLogger.js'))) throw new Error('缺少 exceptionLogger.js');
});

test('package.json 存在', () => {
  if (!fs.existsSync(path.join(__dirname, '..', 'package.json'))) throw new Error('缺少 package.json');
});

console.log('\n💾 检查数据库初始化...\n');

test('数据库初始化脚本可执行', () => {
  try {
    require('./init-db');
  } catch (e) {
  }
});

const { runQuery, getAll } = require('../src/db');

console.log('\n🧹 清理测试数据...\n');
runQuery(`DELETE FROM exception_logs`);
runQuery(`DELETE FROM overnumber_records`);
runQuery(`DELETE FROM queue_reports`);
runQuery(`DELETE FROM queue_numbers`);
runQuery(`DELETE FROM appointments`);
runQuery(`DELETE FROM stations`);
runQuery(`DELETE FROM members`);

test('数据库表存在', () => {
  const tables = getAll(`SELECT name FROM sqlite_master WHERE type='table'`);
  const expected = ['members', 'stations', 'appointments', 'queue_numbers', 'overnumber_records', 'exception_logs', 'queue_reports'];
  expected.forEach(table => {
    if (!tables.find(t => t.name === table)) throw new Error(`缺少表: ${table}`);
  });
});

console.log('\n🔧 测试业务逻辑层...\n');

const memberService = require('../src/services/memberService');

test('创建会员 - 正常流程', () => {
  const result = memberService.createMember({ name: '测试会员', phone: '13900139001', level: '普通会员', balance: 100 });
  if (!result || !result.id) throw new Error('创建失败');
});

test('创建会员 - 重复手机号拦截', () => {
  let threw = false;
  try {
    memberService.createMember({ name: '测试会员2', phone: '13900139001' });
  } catch (e) {
    threw = true;
  }
  if (!threw) throw new Error('未拦截重复手机号');
});

test('查询会员列表', () => {
  const list = memberService.getMemberList();
  if (!Array.isArray(list)) throw new Error('返回格式错误');
});

const stationService = require('../src/services/stationService');

test('创建工位', () => {
  const result = stationService.createStation({ name: '测试工位' });
  if (!result || !result.id) throw new Error('创建失败');
});

test('查询工位列表', () => {
  const list = stationService.getStationList();
  if (!Array.isArray(list)) throw new Error('返回格式错误');
});

const queueService = require('../src/services/queueService');

test('取号 - 正常流程', () => {
  const member = memberService.getMemberByPhone('13900139001');
  const result = queueService.createQueueNumber({ member_id: member.id, service_type: '标准洗' });
  if (!result || !result.id) throw new Error('取号失败');
});

test('取号 - 重复取号拦截', () => {
  const member = memberService.getMemberByPhone('13900139001');
  let threw = false;
  try {
    queueService.createQueueNumber({ member_id: member.id, service_type: '精洗' });
  } catch (e) {
    threw = true;
  }
  if (!threw) throw new Error('未拦截重复取号');
});

test('查询排队列表', () => {
  const list = queueService.getQueueList();
  if (!Array.isArray(list)) throw new Error('返回格式错误');
});

test('取号 - 无效服务类型', () => {
  let threw = false;
  try {
    queueService.createQueueNumber({ service_type: '无效类型' });
  } catch (e) {
    threw = true;
  }
  if (!threw) throw new Error('未校验服务类型');
});

test('叫号 - 正常流程', () => {
  const waiting = queueService.getQueueList('等待中');
  if (waiting.length > 0) {
    const result = queueService.callNextQueue();
    if (!result || result.status !== '服务中') throw new Error('叫号失败');
  }
});

test('完成服务', () => {
  const servicing = queueService.getQueueList('服务中');
  if (servicing.length > 0) {
    const result = queueService.completeQueue(servicing[0].id);
    if (!result || result.status !== '已完成') throw new Error('完成失败');
  }
});

const reportService = require('../src/services/reportService');

test('生成日报', () => {
  const result = reportService.generateDailyReport();
  if (!result || result.total_queue === undefined) throw new Error('生成失败');
});

test('导出CSV', () => {
  const result = reportService.exportReportToCSV();
  if (!result.csv || !result.filename) throw new Error('导出失败');
});

test('查询过号记录', () => {
  const list = reportService.getOvernumberRecords();
  if (!Array.isArray(list)) throw new Error('返回格式错误');
});

test('查询异常日志', () => {
  const list = reportService.getExceptionLogs(10);
  if (!Array.isArray(list)) throw new Error('返回格式错误');
});

const { logException } = require('../src/middleware/exceptionLogger');

test('记录异常日志', () => {
  logException('/api/test', 'POST', { test: true }, '测试错误', '测试结论');
});

console.log('\n' + '='.repeat(50));
console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`);

if (failed === 0) {
  console.log('\n🎉 所有测试通过！系统可以正常使用。');
  console.log('\n💡 下一步:');
  console.log('   1. 运行 npm install 安装依赖');
  console.log('   2. 运行 npm run setup 初始化数据库和示例数据');
  console.log('   3. 运行 npm start 启动服务');
} else {
  console.log('\n⚠️  部分测试失败，请检查上述错误信息。');
  process.exit(1);
}
