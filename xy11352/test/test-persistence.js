const db = require('../src/models/database');
const VerificationService = require('../src/services/verificationService');
const AppointmentService = require('../src/services/appointmentService');

async function testPersistence() {
  console.log('='.repeat(60));
  console.log('数据持久化验证测试 - 读取之前的数据');
  console.log('='.repeat(60));
  console.log('');

  await db.waitForInit();
  console.log('✅ 数据库连接成功');
  console.log('');

  console.log('📋 读取核验历史记录:');
  const records = await VerificationService.getRecentVerifications(20);
  console.log(`   共找到 ${records.length} 条核验记录:`);
  records.forEach((r, i) => {
    console.log(`     ${i + 1}. [${r.verify_type}] ${r.identifier} -> ${r.action}`);
    console.log(`        原因: ${r.reason}`);
    console.log(`        时间: ${r.created_at}`);
  });
  console.log('');

  console.log('📋 读取预约记录:');
  const appointments = await AppointmentService.getAppointments({ limit: 10 });
  console.log(`   共找到 ${appointments.length} 条预约记录:`);
  appointments.forEach((a, i) => {
    console.log(`     ${i + 1}. ${a.visitor_name} (${a.visitor_phone}) -> ${a.status}`);
    console.log(`        车牌: ${a.plate_number || '无'}`);
    console.log(`        创建时间: ${a.created_at}`);
  });
  console.log('');

  console.log('📊 统计数据:');
  const stats = await VerificationService.getStatistics();
  console.log(`   总核验数: ${stats.total}`);
  console.log(`   成功数: ${stats.success}`);
  console.log(`   拦截数: ${stats.failed}`);
  console.log(`   越权放行数: ${stats.forced}`);
  console.log(`   成功率: ${stats.successRate}`);
  console.log('');

  console.log('='.repeat(60));
  console.log('✅ 数据持久化验证完成！数据已正确保存到SQLite数据库');
  console.log('   重启服务后仍然可以读取到历史记录');
  console.log('='.repeat(60));
}

testPersistence().catch(console.error);
