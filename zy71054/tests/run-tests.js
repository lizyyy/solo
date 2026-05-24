#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEST_DIR = __dirname;
const OUTPUT_DIR = path.join(TEST_DIR, 'test-output');
const CLI_PATH = path.join(__dirname, '..', 'src', 'cli.js');

let passed = 0;
let failed = 0;
const results = [];

function runTest(name, fn) {
  console.log(`\n🧪 测试: ${name}`);
  try {
    fn();
    console.log(`   ✅ 通过`);
    passed++;
    results.push({ name, status: 'pass' });
  } catch (error) {
    console.log(`   ❌ 失败: ${error.message}`);
    failed++;
    results.push({ name, status: 'fail', error: error.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
}

function assertFileContains(filePath, content) {
  assertFileExists(filePath);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  if (!fileContent.includes(content)) {
    throw new Error(`文件不包含期望内容: ${content}`);
  }
}

function cli(args, options = {}) {
  const cmd = `node ${CLI_PATH} ${args}`;
  try {
    return {
      stdout: execSync(cmd, { encoding: 'utf-8', cwd: options.cwd || TEST_DIR, ...options }),
      code: 0
    };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      code: error.status
    };
  }
}

function cleanup() {
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('='.repeat(60));
console.log('CSV Fixer CLI 测试套件');
console.log('='.repeat(60));

cleanup();

runTest('CLI --help 正常显示帮助信息', () => {
  const result = cli('--help');
  assert(result.code === 0, '退出码应为 0');
  assert(result.stdout.includes('Usage:'), '应包含 Usage 信息');
  assert(result.stdout.includes('list-encodings'), '应包含 list-encodings 命令');
  assert(result.stdout.includes('detect'), '应包含 detect 命令');
});

runTest('list-encodings 命令正常输出', () => {
  const result = cli('list-encodings');
  assert(result.code === 0, '退出码应为 0');
  assert(result.stdout.includes('UTF-8'), '应列出 UTF-8');
  assert(result.stdout.includes('GBK'), '应列出 GBK');
});

runTest('detect 命令检测 UTF-8 文件', () => {
  const result = cli(`detect ${path.join(TEST_DIR, 'sample-utf8.csv')}`);
  assert(result.code === 0, '退出码应为 0');
  assert(result.stdout.includes('UTF-8'), '应检测到 UTF-8');
  assert(result.stdout.includes('分隔符'), '应检测分隔符');
});

runTest('detect 命令检测 GBK 文件', () => {
  const result = cli(`detect ${path.join(TEST_DIR, 'sample-gbk.csv')}`);
  assert(result.code === 0, '退出码应为 0');
  assert(result.stdout.includes('GBK'), '应检测到 GBK');
});

runTest('处理正常 UTF-8 CSV 文件', () => {
  const output = path.join(OUTPUT_DIR, 'utf8-test');
  const result = cli(`${path.join(TEST_DIR, 'sample-utf8.csv')} -o ${output}`);
  assert(result.code === 0, '退出码应为 0');
  assertFileExists(path.join(output, 'sample-utf8.fixed.csv'));
  assertFileExists(path.join(output, 'sample-utf8.report.json'));
  assertFileExists(path.join(output, 'sample-utf8.report.md'));
});

runTest('处理 GBK 编码文件并正确转码', () => {
  const output = path.join(OUTPUT_DIR, 'gbk-test');
  cli(`${path.join(TEST_DIR, 'sample-gbk.csv')} -o ${output}`);
  const fixedCsv = path.join(output, 'sample-gbk.fixed.csv');
  assertFileContains(fixedCsv, '笔记本电脑');
});

runTest('处理含坏行的文件', () => {
  const output = path.join(OUTPUT_DIR, 'bad-rows-test');
  cli(`${path.join(TEST_DIR, 'sample-with-bad-rows.csv')} -o ${output}`);
  assertFileExists(path.join(output, 'sample-with-bad-rows.bad-records.csv'));
  const badRecords = fs.readFileSync(path.join(output, 'sample-with-bad-rows.bad-records.csv'), 'utf-8');
  assert(badRecords.includes('4'), '应包含行号 4');
  assert(badRecords.includes('column_count_mismatch'), '应包含错误类型');
});

runTest('保留坏记录选项 (-k)', () => {
  const output = path.join(OUTPUT_DIR, 'keep-bad-test');
  cli(`${path.join(TEST_DIR, 'sample-with-bad-rows.csv')} -o ${output} -k`);
  const fixedCsv = fs.readFileSync(path.join(output, 'sample-with-bad-rows.fixed.csv'), 'utf-8');
  const lines = fixedCsv.trim().split('\n');
  assert(lines.length === 8, '应有 8 行（1 表头 + 7 数据行）');
});

runTest('重复表头自动重命名', () => {
  const output = path.join(OUTPUT_DIR, 'dup-header-test');
  cli(`${path.join(TEST_DIR, 'sample-duplicate-headers.csv')} -o ${output}`);
  const fixedCsv = fs.readFileSync(path.join(output, 'sample-duplicate-headers.fixed.csv'), 'utf-8');
  const headerLine = fixedCsv.split('\n')[0];
  assert(headerLine.includes('name_1'), '应自动重命名重复表头 name_1');
  assert(headerLine.includes('email_1'), '应自动重命名重复表头 email_1');
});

runTest('--no-json 不生成 JSON 报告', () => {
  const output = path.join(OUTPUT_DIR, 'no-json-test');
  cli(`${path.join(TEST_DIR, 'sample-utf8.csv')} -o ${output} --no-json`);
  assert(!fs.existsSync(path.join(output, 'sample-utf8.report.json')), '不应生成 JSON 报告');
  assertFileExists(path.join(output, 'sample-utf8.report.md'));
});

runTest('--no-markdown 不生成 Markdown 报告', () => {
  const output = path.join(OUTPUT_DIR, 'no-md-test');
  cli(`${path.join(TEST_DIR, 'sample-utf8.csv')} -o ${output} --no-markdown`);
  assert(!fs.existsSync(path.join(output, 'sample-utf8.report.md')), '不应生成 Markdown 报告');
  assertFileExists(path.join(output, 'sample-utf8.report.json'));
});

runTest('--no-csv 不生成 CSV 输出', () => {
  const output = path.join(OUTPUT_DIR, 'no-csv-test');
  cli(`${path.join(TEST_DIR, 'sample-utf8.csv')} -o ${output} --no-csv`);
  assert(!fs.existsSync(path.join(output, 'sample-utf8.fixed.csv')), '不应生成 CSV 输出');
  assertFileExists(path.join(output, 'sample-utf8.report.json'));
});

runTest('--no-header 处理无表头文件', () => {
  const output = path.join(OUTPUT_DIR, 'no-header-test');
  const noHeaderCsv = path.join(OUTPUT_DIR, 'no-header-input.csv');
  fs.writeFileSync(noHeaderCsv, '1,2,3\n4,5,6\n7,8,9\n');
  cli(`${noHeaderCsv} -o ${output} --no-header`);
  const fixedCsv = fs.readFileSync(path.join(output, 'no-header-input.fixed.csv'), 'utf-8');
  const lines = fixedCsv.trim().split('\n');
  assert(lines.length === 3, '无表头时应输出 3 行数据');
  assert(lines[0].includes('1,2,3'), '第一行应是数据 1,2,3');
  assert(lines[1].includes('4,5,6'), '第二行应是数据 4,5,6');
});

runTest('表头别名映射', () => {
  const output = path.join(OUTPUT_DIR, 'alias-test');
  cli(`${path.join(TEST_DIR, 'sample-with-bad-rows.csv')} -o ${output} -a ${path.join(TEST_DIR, 'header-aliases.json')}`);
  const report = JSON.parse(fs.readFileSync(path.join(output, 'sample-with-bad-rows.report.json'), 'utf-8'));
  assert(report.headers.final.includes('order_id'), '应应用表头别名 order_id');
  assert(report.headers.final.includes('customer_name'), '应应用表头别名 customer_name');
});

runTest('文件不存在返回正确退出码', () => {
  const result = cli('/nonexistent/path/file.csv');
  assert(result.code === 1, '文件不存在时退出码应为 1');
});

runTest('坏记录文件包含原始行内容', () => {
  const output = path.join(OUTPUT_DIR, 'bad-raw-test');
  cli(`${path.join(TEST_DIR, 'sample-with-bad-rows.csv')} -o ${output}`);
  const badRecords = fs.readFileSync(path.join(output, 'sample-with-bad-rows.bad-records.csv'), 'utf-8');
  assert(badRecords.includes('ORD003,广州电子科技公司,坏行缺少字段'), '坏记录应包含原始行内容');
});

console.log('\n' + '='.repeat(60));
console.log('📊 测试结果汇总');
console.log('='.repeat(60));
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${failed}`);
console.log(`📈 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n❌ 失败的测试:');
  results.filter(r => r.status === 'fail').forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
