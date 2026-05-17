#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const YamlParser = require('../lib/yaml-parser');
const ProbeAnalyzer = require('../lib/probe-analyzer');

const testOutputDir = path.join(__dirname, '..', 'test-output', 'test-run');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function runTest(name, testFn) {
  process.stdout.write(`  ${name}... `);
  try {
    testFn();
    console.log('\x1b[32m✓ PASS\x1b[0m');
    return true;
  } catch (e) {
    console.log('\x1b[31m✗ FAIL\x1b[0m');
    console.log(`    ${e.message}`);
    return false;
  }
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log('                  K8s 探针策略 CLI - 测试套件');
console.log('══════════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

// ============================================================
// Test 1: 正常 YAML 文件解析
// ============================================================
console.log('📋 模块级测试: YAML 解析器');

ensureDir(testOutputDir);

passed += runTest('正常 YAML 文件完整解析', () => {
  const parser = new YamlParser();
  const result = parser.parseFile(path.join(__dirname, '..', 'test-data', 'normal', 'deployment-prod.yaml'));
  
  if (result.documents.length < 1) throw new Error('未解析到任何文档');
  if (!result.success) throw new Error('文件应标记为成功');
  
  const deployment = result.documents.find(d => d.kind === 'Deployment');
  if (!deployment) throw new Error('未找到 Deployment');
  if (deployment.containers.length !== 1) throw new Error('应找到 1 个容器');
});

// ============================================================
// Test 2: 脏数据 YAML 文件容错解析 - 核心修复验证
// ============================================================
passed += runTest('脏数据文件部分解析 - 前半段有效内容保留', () => {
  const parser = new YamlParser();
  const result = parser.parseFile(path.join(__dirname, '..', 'test-data', 'dirty', 'broken-syntax.yaml'));
  
  if (result.documents.length === 0) throw new Error('应至少解析到部分有效文档');
  if (!result.partialSuccess) throw new Error('应标记为部分成功');
  
  const deployment = result.documents.find(d => d.kind === 'Deployment');
  if (!deployment) throw new Error('应找到 Deployment（前半段有效）');
  if (deployment.containers.length !== 1) throw new Error('应找到 1 个容器');
  if (result.errors.length === 0) throw new Error('应记录解析错误');
});

passed += runTest('脏数据探针阈值正确检测', () => {
  const parser = new YamlParser();
  const parsed = parser.parseInput(path.join(__dirname, '..', 'test-data', 'dirty', 'broken-syntax.yaml'));
  
  const analyzer = new ProbeAnalyzer();
  const analysis = analyzer.analyze(parsed);
  
  const thresholdErrors = analysis.issues.filter(i => i.type === 'THRESHOLD_VIOLATION');
  if (thresholdErrors.length < 4) throw new Error('应检测到 4 个阈值超限（999/600/120/50）');
});

// ============================================================
// Test 3: 坏行位置保留
// ============================================================
passed += runTest('坏行原始位置信息保留', () => {
  const parser = new YamlParser();
  const result = parser.parseFile(path.join(__dirname, '..', 'test-data', 'dirty', 'broken-syntax.yaml'));
  
  if (result.errors.length === 0) throw new Error('应记录解析错误');
  
  for (const error of result.errors) {
    if (error.line === undefined) throw new Error('缺少行号信息');
    if (!error.message) throw new Error('缺少错误消息');
  }
});

// ============================================================
// Test 4: CLI 入口可用性
// ============================================================
console.log('\n📋 CLI 集成测试');

passed += runTest('CLI --help 可用', () => {
  try {
    const output = execSync('node src/index.js --help', { encoding: 'utf8', cwd: path.join(__dirname, '..') });
    if (!output.includes('K8s')) throw new Error('帮助输出异常');
  } catch (e) {
    throw new Error(`CLI 执行失败: ${e.message}`);
  }
});

// ============================================================
// Test 5: 退出码验证
// ============================================================
passed += runTest('正常数据退出码为 0 或 1（无错误为 0，有警告为 1）', () => {
  const normalPath = path.join(__dirname, '..', 'test-data', 'normal', 'deployment-dev.yaml');
  try {
    execSync(`node src/index.js "${normalPath}" -q -o "${testOutputDir}"`, { 
      encoding: 'utf8', 
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
  } catch (e) {
    if (e.status !== 0 && e.status !== 1) {
      throw new Error(`退出码异常: ${e.status}`);
    }
  }
});

passed += runTest('脏数据退出码为 1（有错误）', () => {
  const dirtyPath = path.join(__dirname, '..', 'test-data', 'dirty', 'broken-syntax.yaml');
  let exitCode;
  try {
    execSync(`node src/index.js "${dirtyPath}" -q -o "${testOutputDir}"`, { 
      encoding: 'utf8', 
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    exitCode = 0;
  } catch (e) {
    exitCode = e.status;
  }
  if (exitCode !== 1) throw new Error(`脏数据应返回退出码 1，实际为 ${exitCode}`);
});

// ============================================================
// Test 6: 报告产物验证
// ============================================================
console.log('\n📋 报告产物验证');

passed += runTest('生成 JSON 和 Markdown 两种报告', () => {
  const jsonPath = path.join(testOutputDir, 'probe-report.json');
  const mdPath = path.join(testOutputDir, 'probe-report.md');
  
  if (!fs.existsSync(jsonPath)) throw new Error('JSON 报告未生成');
  if (!fs.existsSync(mdPath)) throw new Error('Markdown 报告未生成');
});

passed += runTest('JSON 和 Markdown 报告内容一致性', () => {
  const jsonPath = path.join(testOutputDir, 'probe-report.json');
  const mdPath = path.join(testOutputDir, 'probe-report.md');
  
  const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const mdContent = fs.readFileSync(mdPath, 'utf8');
  
  if (jsonContent.summary.totalContainers === undefined) {
    throw new Error('JSON 缺少容器统计');
  }
  
  if (!mdContent.includes('探针配置统计')) {
    throw new Error('Markdown 报告内容不完整');
  }
  
  const mdContainerMatch = mdContent.match(/LivenessProbe.*?(\d+).*?%/);
  if (!mdContainerMatch) {
    throw new Error('Markdown 应包含 LivenessProbe 统计');
  }
});

passed += runTest('报告包含解析错误记录（坏行信息）', () => {
  const parser = new YamlParser();
  parser.parseFile(path.join(__dirname, '..', 'test-data', 'dirty', 'broken-syntax.yaml'));
  
  if (parser.errors.length === 0) throw new Error('解析器应记录错误');
});

// ============================================================
// Test 7: 目录处理
// ============================================================
console.log('\n📋 目录处理测试');

passed += runTest('整个 dirty 目录处理 - 部分成功文件统计正确', () => {
  const parser = new YamlParser();
  const result = parser.parseDirectory(path.join(__dirname, '..', 'test-data', 'dirty'));
  
  if (result.totalFiles !== 2) throw new Error(`应找到 2 个文件，实际 ${result.totalFiles}`);
  if (result.successfulFiles !== 2) throw new Error(`2 个文件都应部分/完全成功，实际 ${result.successfulFiles}`);
});

// ============================================================
// 测试总结
// ============================================================
console.log('\n══════════════════════════════════════════════════════════════');
console.log('                            测试总结');
console.log('══════════════════════════════════════════════════════════════\n');
console.log(`  通过: ${passed} 项`);
console.log(`  失败: ${failed} 项`);
console.log(`  总计: ${passed + failed} 项`);
console.log('');

if (failed === 0) {
  console.log('\x1b[32m✅ 所有测试通过！\x1b[0m\n');
  process.exit(0);
} else {
  console.log('\x1b[31m❌ 部分测试失败，请检查上述错误信息\x1b[0m\n');
  process.exit(1);
}
