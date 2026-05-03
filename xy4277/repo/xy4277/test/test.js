const path = require('path');
const fs = require('fs');

const Scanner = require('../src/scanner');
const Parser = require('../src/parser');
const RulesEngine = require('../src/rules');
const Reporter = require('../src/reporter');

const TEST_DATA_DIR = path.join(__dirname, '..', 'examples', 'valid');
const INVALID_DATA_DIR = path.join(__dirname, '..', 'examples', 'invalid');

let passed = 0;
let failed = 0;
let errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   错误: ${error.message}`);
    failed++;
    errors.push({ test: name, error: error.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('\n🧪 素材授权交付核对器 - 单元测试');
console.log('========================================\n');

console.log('\n📁 测试 Scanner 模块');
console.log('--------------------');

test('Scanner 应该能正确扫描目录', () => {
  const scanner = new Scanner();
  const result = scanner.scan(TEST_DATA_DIR);
  
  assert(result.directory === TEST_DATA_DIR, '目录路径不匹配');
  assert(result.csvFiles.length >= 1, '应该找到至少一个CSV文件');
  assert(result.jsonFiles.length >= 1, '应该找到至少一个JSON文件');
  assert(result.edlFiles.length >= 1, '应该找到至少一个EDL文件');
});

test('Scanner 应该能正确选择文件', () => {
  const scanner = new Scanner();
  const scanResult = scanner.scan(TEST_DATA_DIR);
  const selected = scanner.selectFiles(scanResult);
  
  assert(selected.csv !== null, '应该选择CSV文件');
  assert(selected.json !== null, '应该选择JSON文件');
  assert(selected.edl !== null, '应该选择EDL文件');
  assert(Array.isArray(selected.media), '媒体文件应该是数组');
});

console.log('\n📄 测试 Parser 模块');
console.log('--------------------');

test('Parser 应该能正确解析CSV文件', () => {
  const scanner = new Scanner();
  const scanResult = scanner.scan(TEST_DATA_DIR);
  const selected = scanner.selectFiles(scanResult);
  
  const parser = new Parser();
  const result = parser.parseCSV(selected.csv);
  
  assert(result !== null, '解析结果不应为null');
  assert(result.materials.length > 0, '应该解析到至少一条素材记录');
  assert(result.materials[0].id !== undefined, '每条记录应该有ID');
  assert(parser.getErrors().length === 0, '解析不应有错误');
});

test('Parser 应该能正确解析JSON合同文件', () => {
  const scanner = new Scanner();
  const scanResult = scanner.scan(TEST_DATA_DIR);
  const selected = scanner.selectFiles(scanResult);
  
  const parser = new Parser();
  const result = parser.parseJSON(selected.json);
  
  assert(result !== null, '解析结果不应为null');
  assert(result.contracts.length > 0, '应该解析到至少一份合同');
  assert(result.contracts[0].materialId !== undefined, '每份合同应该有关联素材ID');
});

test('Parser 应该能正确解析EDL时间线文件', () => {
  const scanner = new Scanner();
  const scanResult = scanner.scan(TEST_DATA_DIR);
  const selected = scanner.selectFiles(scanResult);
  
  const parser = new Parser();
  const result = parser.parseEDL(selected.edl);
  
  assert(result !== null, '解析结果不应为null');
  assert(result.events.length > 0, '应该解析到至少一个事件');
  assert(result.events[0].id !== undefined, '每个事件应该有ID');
  assert(result.events[0].durationSeconds !== undefined, '每个事件应该有时长');
});

test('Parser 应该能识别有问题的CSV数据', () => {
  const scanner = new Scanner();
  const scanResult = scanner.scan(INVALID_DATA_DIR);
  
  const csvFile = scanResult.csvFiles.find(f => f.name.includes('有问题'));
  assert(csvFile !== undefined, '应该找到有问题的CSV文件');
  
  const parser = new Parser();
  parser.parseCSV(csvFile);
  
  const errors = parser.getErrors();
  assert(errors.length > 0, '应该解析到错误');
});

console.log('\n⚖️  测试 RulesEngine 模块');
console.log('--------------------');

test('RulesEngine 应该能正确检测授权过期', () => {
  const scanner = new Scanner();
  const scanResult = scanner.scan(INVALID_DATA_DIR);
  
  const selected = scanner.selectFiles(scanResult, {
    csvFile: scanResult.csvFiles.find(f => f.name.includes('有问题'))?.fullPath,
    jsonFile: scanResult.jsonFiles.find(f => f.name.includes('有问题'))?.fullPath,
    edlFile: scanResult.edlFiles.find(f => f.name.includes('有问题'))?.fullPath
  });
  
  const parser = new Parser();
  const parsedData = {
    materialList: selected.csv ? parser.parseCSV(selected.csv) : null,
    authData: selected.json ? parser.parseJSON(selected.json) : null,
    edlData: selected.edl ? parser.parseEDL(selected.edl) : null
  };
  
  const rules = new RulesEngine();
  const validation = rules.validate(parsedData, []);
  
  const violations = rules.getViolations();
  const hasExpired = violations.some(v => v.code === 'AUTH_EXPIRED');
  
  assert(hasExpired, '应该检测到已过期的授权');
});

test('RulesEngine 应该能正确检测缺少授权', () => {
  const scanner = new Scanner();
  const scanResult = scanner.scan(INVALID_DATA_DIR);
  
  const selected = scanner.selectFiles(scanResult, {
    csvFile: scanResult.csvFiles.find(f => f.name.includes('有问题'))?.fullPath,
    jsonFile: scanResult.jsonFiles.find(f => f.name.includes('有问题'))?.fullPath,
    edlFile: scanResult.edlFiles.find(f => f.name.includes('有问题'))?.fullPath
  });
  
  const parser = new Parser();
  const parsedData = {
    materialList: selected.csv ? parser.parseCSV(selected.csv) : null,
    authData: selected.json ? parser.parseJSON(selected.json) : null,
    edlData: selected.edl ? parser.parseEDL(selected.edl) : null
  };
  
  const rules = new RulesEngine();
  rules.validate(parsedData, []);
  
  const violations = rules.getViolations();
  const hasMissingAuth = violations.some(v => v.code === 'MISSING_AUTH');
  
  assert(hasMissingAuth, '应该检测到缺少授权的素材');
});

test('RulesEngine 应该能正确计算风险等级', () => {
  const scanner = new Scanner();
  const scanResult = scanner.scan(INVALID_DATA_DIR);
  
  const selected = scanner.selectFiles(scanResult, {
    csvFile: scanResult.csvFiles.find(f => f.name.includes('有问题'))?.fullPath,
    jsonFile: scanResult.jsonFiles.find(f => f.name.includes('有问题'))?.fullPath,
    edlFile: scanResult.edlFiles.find(f => f.name.includes('有问题'))?.fullPath
  });
  
  const parser = new Parser();
  const parsedData = {
    materialList: selected.csv ? parser.parseCSV(selected.csv) : null,
    authData: selected.json ? parser.parseJSON(selected.json) : null,
    edlData: selected.edl ? parser.parseEDL(selected.edl) : null
  };
  
  const rules = new RulesEngine();
  const validation = rules.validate(parsedData, []);
  
  assert(validation.summary.highestRisk !== undefined, '应该有最高风险等级');
  assert(validation.summary.violations > 0, '应该有违规记录');
});

console.log('\n📝 测试 Reporter 模块');
console.log('--------------------');

test('Reporter 应该能生成JSON报告', () => {
  const scanner = new Scanner();
  const scanResult = scanner.scan(TEST_DATA_DIR);
  const selected = scanner.selectFiles(scanResult);
  
  const parser = new Parser();
  const parsedData = {
    materialList: selected.csv ? parser.parseCSV(selected.csv) : null,
    authData: selected.json ? parser.parseJSON(selected.json) : null,
    edlData: selected.edl ? parser.parseEDL(selected.edl) : null
  };
  
  const rules = new RulesEngine();
  const validation = rules.validate(parsedData, selected.media);
  
  const reporter = new Reporter({ projectName: '测试项目' });
  const jsonReport = reporter.generateJSON(validation, parsedData, selected);
  
  assert(jsonReport.meta !== undefined, '应该有元数据');
  assert(jsonReport.meta.projectName === '测试项目', '项目名称应该匹配');
  assert(jsonReport.summary !== undefined, '应该有摘要');
  assert(Array.isArray(jsonReport.materials), '应该有序列化的素材列表');
});

test('Reporter 应该能生成Markdown报告', () => {
  const scanner = new Scanner();
  const scanResult = scanner.scan(TEST_DATA_DIR);
  const selected = scanner.selectFiles(scanResult);
  
  const parser = new Parser();
  const parsedData = {
    materialList: selected.csv ? parser.parseCSV(selected.csv) : null,
    authData: selected.json ? parser.parseJSON(selected.json) : null,
    edlData: selected.edl ? parser.parseEDL(selected.edl) : null
  };
  
  const rules = new RulesEngine();
  const validation = rules.validate(parsedData, selected.media);
  
  const reporter = new Reporter({ projectName: '测试项目' });
  const mdReport = reporter.generateMarkdown(validation, parsedData, selected);
  
  assert(typeof mdReport === 'string', '应该返回字符串');
  assert(mdReport.includes('# 测试项目'), '应该包含项目标题');
  assert(mdReport.includes('执行摘要'), '应该包含执行摘要');
});

test('Reporter 应该能导出文件', () => {
  const scanner = new Scanner();
  const scanResult = scanner.scan(TEST_DATA_DIR);
  const selected = scanner.selectFiles(scanResult);
  
  const parser = new Parser();
  const parsedData = {
    materialList: selected.csv ? parser.parseCSV(selected.csv) : null,
    authData: selected.json ? parser.parseJSON(selected.json) : null,
    edlData: selected.edl ? parser.parseEDL(selected.edl) : null
  };
  
  const rules = new RulesEngine();
  const validation = rules.validate(parsedData, selected.media);
  
  const outputDir = path.join(__dirname, 'output');
  const reporter = new Reporter({ projectName: '导出测试' });
  
  const jsonPath = path.join(outputDir, 'test-report.json');
  reporter.exportJSON(jsonPath, validation, parsedData, selected);
  
  assert(fs.existsSync(jsonPath), 'JSON报告文件应该存在');
  
  const mdPath = path.join(outputDir, 'test-report.md');
  reporter.exportMarkdown(mdPath, validation, parsedData, selected);
  
  assert(fs.existsSync(mdPath), 'Markdown报告文件应该存在');
  
  if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
  if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
  if (fs.existsSync(outputDir)) fs.rmdirSync(outputDir);
});

console.log('\n📊 测试结果汇总');
console.log('--------------------');
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${failed}`);

if (errors.length > 0) {
  console.log('\n❌ 失败的测试:');
  errors.forEach(e => {
    console.log(`   - ${e.test}: ${e.error}`);
  });
}

console.log('');

if (failed > 0) {
  process.exit(1);
}
