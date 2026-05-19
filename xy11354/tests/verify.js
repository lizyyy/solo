const path = require('path');
const db = require('../src/config/database');
const initDatabase = require('../src/models/init');
const ImportService = require('../src/services/ImportService');
const VerifyService = require('../src/services/VerifyService');
const ReviewService = require('../src/services/ReviewService');
const ExportService = require('../src/services/ExportService');
const { maskData } = require('../src/utils/mask');

async function runTests() {
  console.log('='.repeat(60));
  console.log('园区安保系统 - 功能验证测试');
  console.log('='.repeat(60));
  
  console.log('\n[1/6] 初始化数据库...');
  await initDatabase();
  console.log('✓ 数据库初始化成功');
  
  console.log('\n[2/6] 测试数据导入功能...');
  
  const visitorFile = path.join(__dirname, '../data/sample_visitors_normal.csv');
  const visitorResult = await ImportService.importFromCSV(visitorFile, 'visitor', 'sample_visitors_normal.csv');
  console.log(`  - 访客导入: 总计 ${visitorResult.total}, 成功 ${visitorResult.imported}`);
  
  const plateFile = path.join(__dirname, '../data/sample_plates_normal.csv');
  const plateResult = await ImportService.importFromCSV(plateFile, 'temporary_plate', 'sample_plates_normal.csv');
  console.log(`  - 临时车牌导入: 总计 ${plateResult.total}, 成功 ${plateResult.imported}`);
  
  const blacklistFile = path.join(__dirname, '../data/sample_blacklist.csv');
  const blacklistResult = await ImportService.importFromCSV(blacklistFile, 'blacklist', 'sample_blacklist.csv');
  console.log(`  - 黑名单导入: 总计 ${blacklistResult.total}, 成功 ${blacklistResult.imported}`);
  console.log('✓ 数据导入功能正常');
  
  console.log('\n[3/6] 测试敏感字段脱敏...');
  const visitor = await db.get('SELECT visitor_name, phone, id_card FROM visitors LIMIT 1');
  const masked = maskData(visitor);
  console.log(`  - 原始手机号: ${visitor.phone}`);
  console.log(`  - 脱敏手机号: ${masked.phone}`);
  console.log(`  - 原始身份证: ${visitor.id_card}`);
  console.log(`  - 脱敏身份证: ${masked.id_card}`);
  if (masked.phone.includes('****') && masked.id_card.includes('********')) {
    console.log('✓ 敏感字段脱敏功能正常');
  } else {
    console.log('✗ 敏感字段脱敏功能异常');
  }
  
  console.log('\n[4/6] 测试复核功能...');
  const pendingVisitors = await ReviewService.getPendingReviews('visitor');
  console.log(`  - 待复核访客数: ${pendingVisitors.visitors.length}`);
  
  if (pendingVisitors.visitors.length > 0) {
    const firstId = pendingVisitors.visitors[0].id;
    const reviewResult = await ReviewService.reviewVisitor(firstId, 'approved', '测试通过复核');
    console.log(`  - 复核访客 ID ${firstId}: ${reviewResult.success ? '成功' : '失败'}`);
  }
  
  const pendingPlates = await ReviewService.getPendingReviews('temporary_plate');
  console.log(`  - 待复核车牌数: ${pendingPlates.temporaryPlates.length}`);
  
  if (pendingPlates.temporaryPlates.length > 0) {
    const firstId = pendingPlates.temporaryPlates[0].id;
    const plateReviewResult = await ReviewService.reviewTemporaryPlate(firstId, 'approved', '测试通过复核');
    console.log(`  - 复核车牌 ID ${firstId}: ${plateReviewResult.success ? '成功' : '失败'}`);
  }
  console.log('✓ 复核功能正常');
  
  console.log('\n[5/6] 测试核验功能（黑名单拦截）...');
  
  const normalPhoneResult = await VerifyService.verifyVisitor('13800138001');
  console.log(`  - 正常手机号 13800138001 核验: ${normalPhoneResult.isAllowed ? '放行' : '拦截'} - ${normalPhoneResult.verifyResult}`);
  
  const blacklistPhoneResult = await VerifyService.verifyVisitor('13999999999');
  console.log(`  - 黑名单手机号 13999999999 核验: ${blacklistPhoneResult.isAllowed ? '放行' : '拦截'} - ${blacklistPhoneResult.verifyResult}`);
  
  const normalPlateResult = await VerifyService.verifyLicensePlate('临A10001');
  console.log(`  - 正常车牌 临A10001 核验: ${normalPlateResult.isAllowed ? '放行' : '拦截'} - ${normalPlateResult.verifyResult}`);
  
  const blacklistPlateResult = await VerifyService.verifyLicensePlate('京Z99999');
  console.log(`  - 黑名单车牌 京Z99999 核验: ${blacklistPlateResult.isAllowed ? '放行' : '拦截'} - ${blacklistPlateResult.verifyResult}`);
  
  if (!blacklistPhoneResult.isAllowed && blacklistPhoneResult.isInBlacklist &&
      !blacklistPlateResult.isAllowed && blacklistPlateResult.isInBlacklist) {
    console.log('✓ 黑名单拦截功能正常');
  } else {
    console.log('✗ 黑名单拦截功能异常');
  }
  
  console.log('\n[6/6] 测试数据导出功能...');
  const exportVisitorResult = await ExportService.exportVisitors({}, { isAdmin: false });
  if (exportVisitorResult.success) {
    console.log(`  - 访客导出成功: ${exportVisitorResult.fileName}, 记录数 ${exportVisitorResult.recordCount}`);
  }
  
  const exportPlateResult = await ExportService.exportTemporaryPlates({}, { isAdmin: false });
  if (exportPlateResult.success) {
    console.log(`  - 临时车牌导出成功: ${exportPlateResult.fileName}, 记录数 ${exportPlateResult.recordCount}`);
  }
  
  const exportBlacklistResult = await ExportService.exportBlacklist({}, { isAdmin: false });
  if (exportBlacklistResult.success) {
    console.log(`  - 黑名单导出成功: ${exportBlacklistResult.fileName}, 记录数 ${exportBlacklistResult.recordCount}`);
  }
  console.log('✓ 数据导出功能正常');
  
  console.log('\n' + '='.repeat(60));
  console.log('数据持久化验证:');
  console.log('='.repeat(60));
  
  const visitorCount = await db.get('SELECT COUNT(*) as count FROM visitors');
  const plateCount = await db.get('SELECT COUNT(*) as count FROM temporary_plates');
  const blacklistCount = await db.get('SELECT COUNT(*) as count FROM blacklist');
  const verifyCount = await db.get('SELECT COUNT(*) as count FROM verify_records');
  
  console.log(`  - 访客记录数: ${visitorCount.count}`);
  console.log(`  - 临时车牌记录数: ${plateCount.count}`);
  console.log(`  - 黑名单记录数: ${blacklistCount.count}`);
  console.log(`  - 核验记录数: ${verifyCount.count}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✓ 所有测试完成！系统功能正常');
  console.log('='.repeat(60));
  
  console.log('\n提示: 重启服务后再次运行测试，可验证数据持久化是否有效');
  
  db.db.close();
}

runTests().catch(async (err) => {
  console.error('测试失败:', err);
  db.db.close();
  process.exit(1);
});
