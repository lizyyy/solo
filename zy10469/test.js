const { ProtoParser, SnapshotManager, CompatibilityChecker, ReportGenerator } = require('./src');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'proto-compat-output');

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

console.log('=== 测试 Proto 解析器 ===');
const parser = new ProtoParser();
const data1 = parser.parse('test-v1.proto');
console.log('消息数量:', data1.messages.length);
data1.messages.forEach(m => {
  console.log(`  - ${m.fullName}: ${m.fields.size} 个字段`);
});

console.log('\n=== 测试快照管理器 ===');
const snapshotManager = new SnapshotManager(outputDir);
const snapshot = snapshotManager.createSnapshot(data1, 'v1');
console.log('快照已创建:', snapshot.path);

const loadedSnapshot = snapshotManager.loadSnapshot('v1');
console.log('快照已加载, 消息数:', loadedSnapshot.messages.length);

console.log('\n=== 测试兼容性检查器 ===');
const checker = new CompatibilityChecker();

const data2 = parser.parse('test-v2.proto');
const result = checker.check(loadedSnapshot, data2);

console.log('兼容:', result.isCompatible);
console.log('错误数:', result.summary.errors);
console.log('警告数:', result.summary.warnings);
console.log('信息数:', result.summary.infos);

console.log('\n问题详情:');
result.issues.forEach(issue => {
  console.log(`  [${issue.type.toUpperCase()}] ${issue.code}: ${issue.message}`);
});

console.log('\n=== 测试报告生成器 ===');
const reportGenerator = new ReportGenerator(outputDir);
const jsonReport = reportGenerator.generateJsonReport(result, data2, loadedSnapshot);
const mdReport = reportGenerator.generateMarkdownReport(result, data2, loadedSnapshot);

console.log('JSON 报告:', jsonReport.path);
console.log('Markdown 报告:', mdReport.path);

console.log('\n=== 完成 ===');
