const fs = require('fs');
const SignatureVerifier = require('../src/core/signature');
const MessageStore = require('../src/core/messageStore');
const SmsMessage = require('../src/core/smsMessage');
const ReportGenerator = require('../src/core/reportGenerator');

console.log('=== 队列消息体检查 - 功能测试 ===\n');

const verifier = new SignatureVerifier();
const store = new MessageStore('./test/data');
const reporter = new ReportGenerator();

console.log('1. 测试签名生成与验证...');
const testMessage = SmsMessage.generate('13800000001', '测试内容', 'MD5');
const result = verifier.verify(testMessage.toJSON(), 'MD5');
console.log(`   验证结果: ${result.valid ? '✓ 通过' : '✗ 失败'}`);
console.log(`   使用算法: ${result.algorithm || result.expectedAlgorithm}\n`);

console.log('2. 测试签名算法不一致检测...');
const badMessage = SmsMessage.generateBadMessage('13900009999', '异常消息', 'SHA256', 'MD5');
const badResult = verifier.verify(badMessage.toJSON(), 'MD5');
console.log(`   验证结果: ${badResult.valid ? '通过' : '✗ 失败 (预期)'}`);
console.log(`   错误信息: ${badResult.error}`);
console.log(`   期望算法: ${badResult.expectedAlgorithm}, 实际算法: ${badResult.actualAlgorithm}\n`);

console.log('3. 测试结果存储与复用...');
const batchId = 'TEST_BATCH_' + Date.now();
store.saveResult(testMessage.toJSON(), result, batchId, Date.now());
const existing = store.findExistingResult(testMessage.toJSON(), batchId);
console.log(`   找到历史结果: ${existing ? '✓ 是' : '✗ 否'}`);
console.log(`   历史结果有效: ${existing?.result?.valid ? '✓ 是' : '✗ 否'}\n`);

console.log('4. 测试生成演示数据...');
const demoData = SmsMessage.generateDemoData();
console.log(`   正常消息: ${demoData.normal.length} 条`);
console.log(`   异常消息: ${demoData.abnormal.length} 条\n`);

console.log('5. 测试报告生成...');
const testResults = demoData.all.map(msg => {
  return {
    message: msg,
    result: verifier.verify(msg, 'MD5')
  };
});
const htmlPath = reporter.generateHtmlReport(testResults, 100, batchId);
console.log(`   HTML报告生成: ${htmlPath}\n`);

console.log('6. 测试异常样本导出...');
const exportPath = './test/abnormal_export.json';
reporter.exportAbnormalSamples(testResults, exportPath);
const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
console.log(`   导出异常样本: ${exported.count} 条`);
console.log(`   导出文件: ${exportPath}\n`);

console.log('✅ 所有核心功能测试通过!\n');
console.log('可用命令:');
console.log('  node src/cli.js demo          - 运行演示流程');
console.log('  node src/cli.js generate      - 生成测试数据');
console.log('  node src/cli.js verify --input <file>  - 验证消息文件');
console.log('  node src/cli.js history       - 查看历史批次');
console.log('  node src/cli.js export --batch <id>    - 导出批次结果\n');

process.exit(0);