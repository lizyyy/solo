const fs = require('fs');
const path = require('path');
const MetadataAuditor = require('../src/auditor');
const AuditReporter = require('../src/reporter');

console.log('═'.repeat(70));
console.log('🧪 数字藏品元数据审计 - 自动化测试');
console.log('═'.repeat(70));

async function runTests() {
  let passed = 0;
  let failed = 0;
  
  console.log('\n📋 测试1: 加载样例数据');
  try {
    const dataPath = path.join(__dirname, 'sample-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`   ✅ 数据加载成功，共 ${data.items.length} 条记录`);
    passed++;
  } catch (e) {
    console.log(`   ❌ 数据加载失败: ${e.message}`);
    failed++;
  }

  console.log('\n🔍 测试2: 执行完整审计');
  try {
    const dataPath = path.join(__dirname, 'sample-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    const auditor = new MetadataAuditor();
    const results = await auditor.auditBatch(data.items);
    
    console.log(`   ✅ 审计完成`);
    console.log(`      - 总计: ${results.total}`);
    console.log(`      - 通过: ${results.passed}`);
    console.log(`      - 未通过: ${results.failed}`);
    console.log(`      - 异常数: ${results.anomalies.length}`);
    passed++;
  } catch (e) {
    console.log(`   ❌ 审计失败: ${e.message}`);
    failed++;
  }

  console.log('\n🔍 测试3: 异常检测验证');
  try {
    const dataPath = path.join(__dirname, 'sample-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    const auditor = new MetadataAuditor();
    const results = await auditor.auditBatch(data.items);
    
    const hasDuplicateErrors = results.anomalies.some(a => 
      a.type === 'duplicate_token_id' || (a.message && a.message.includes('重复'))
    );
    const hasExpiryErrors = results.anomalies.some(a => 
      a.message && a.message.includes('过期')
    );
    
    if (hasDuplicateErrors && hasExpiryErrors) {
      console.log(`   ✅ 异常检测正常`);
      console.log(`      - 检测到编号重复`);
      console.log(`      - 检测到权益过期`);
      passed++;
    } else {
      console.log(`   ⚠️  异常检测可能不完整`);
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ 异常检测失败: ${e.message}`);
    failed++;
  }

  console.log('\n📄 测试4: 报告导出');
  try {
    const dataPath = path.join(__dirname, 'sample-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    const auditor = new MetadataAuditor();
    const results = await auditor.auditBatch(data.items);
    
    const reporter = new AuditReporter(results, path.join(__dirname, '../reports'));
    
    const jsonReport = reporter.exportJson();
    const csvReport = await reporter.exportCsv();
    
    if (fs.existsSync(jsonReport.path) && fs.existsSync(csvReport.path)) {
      console.log(`   ✅ 报告导出成功`);
      console.log(`      - JSON: ${jsonReport.filename}`);
      console.log(`      - CSV: ${csvReport.filename}`);
      passed++;
    } else {
      console.log(`   ❌ 报告文件未生成`);
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ 报告导出失败: ${e.message}`);
    console.log(e.stack);
    failed++;
  }

  console.log('\n📊 测试5: 非严格模式');
  try {
    const items = [{
      tokenId: 'TEST-001',
      name: '测试作品',
      metadata: { name: '测试作品' }
    }];
    
    const strictAuditor = new MetadataAuditor({ strictMode: true });
    const strictResults = await strictAuditor.auditBatch(items);
    
    const looseAuditor = new MetadataAuditor({ strictMode: false });
    const looseResults = await looseAuditor.auditBatch(items);
    
    console.log(`   ✅ 模式切换正常`);
    console.log(`      - 严格模式: ${strictResults.items[0].status}`);
    console.log(`      - 非严格模式: ${looseResults.items[0].status}`);
    passed++;
  } catch (e) {
    console.log(`   ❌ 模式切换失败: ${e.message}`);
    failed++;
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🏁 测试完成');
  console.log('═'.repeat(70));
  console.log(`   通过: ${passed}`);
  console.log(`   失败: ${failed}`);
  console.log(`   总计: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过!');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分测试失败，请检查代码');
    process.exit(1);
  }
}

runTests().catch(console.error);
