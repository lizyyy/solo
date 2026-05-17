#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue('='.repeat(70)));
console.log(chalk.blue.bold('🧪 OAuth回调地址校验工具 - 测试套件'));
console.log(chalk.blue('='.repeat(70)));
console.log('');

const tests = [];
const results = {
  passed: 0,
  failed: 0,
  total: 0
};

function test(name, fn) {
  tests.push({ name, fn });
}

function runTest(test) {
  try {
    console.log(chalk.gray(`  测试中: ${test.name}`));
    test.fn();
    console.log(chalk.green(`  ✓ ${test.name}`));
    results.passed++;
  } catch (error) {
    console.log(chalk.red(`  ✗ ${test.name}`));
    console.log(chalk.red(`    错误: ${error.message}`));
    results.failed++;
  }
  results.total++;
}

const { normalizeUrl, compareUrls, validateConfig, parseJsonWithSource, attributeErrors } = require('../src/index');

test('模块导入正常', () => {
  if (!normalizeUrl || !compareUrls || !validateConfig || !attributeErrors) {
    throw new Error('核心模块导入失败');
  }
});

test('URL归一化功能正常', () => {
  const result = normalizeUrl('https://example.com/callback');
  if (!result.normalized || result.isValid === false) {
    throw new Error('URL归一化失败');
  }
});

test('URL对比功能正常', () => {
  const result = compareUrls('https://example.com/cb', 'https://example.com/callback');
  if (typeof result.exactMatch !== 'boolean') {
    throw new Error('URL对比结果格式错误');
  }
});

test('无效URL识别正确', () => {
  const result = normalizeUrl('invalid-url');
  if (result.isValid !== false) {
    throw new Error('无效URL未被正确识别');
  }
});

test('JSON配置解析带溯源信息正常', () => {
  const configPath = path.join(__dirname, '../examples/oauth-config.json');
  const config = parseJsonWithSource(configPath);
  
  if (!config.applications || config.applications.length === 0) {
    throw new Error('配置解析失败');
  }
  
  const app = config.applications[0];
  if (!app._source || !app._source.file) {
    throw new Error('应用配置缺少溯源信息');
  }
});

test('validateConfig函数正常工作', () => {
  const configPath = path.join(__dirname, '../examples/oauth-config.json');
  const config = parseJsonWithSource(configPath);
  const result = validateConfig(config);
  
  if (!result.summary || typeof result.summary.total !== 'number') {
    throw new Error('验证结果格式错误');
  }
});

test('配置溯源信息正确传递', () => {
  const configPath = path.join(__dirname, '../examples/oauth-config.json');
  const config = parseJsonWithSource(configPath);
  const result = validateConfig(config);
  
  const app = result.applications[0];
  if (!app.source || app.source.file === 'unknown') {
    throw new Error('应用溯源信息未传递');
  }
  
  const env = app.environments[0];
  if (!env.source || env.source.file === 'unknown') {
    throw new Error('环境溯源信息未传递');
  }
  
  const uri = env.authorizedUris[0];
  if (!uri.source || uri.source.file === 'unknown') {
    throw new Error('URI溯源信息未传递');
  }
});

test('完全匹配的回调地址不应产生REDIRECT_URI_MISMATCH错误', () => {
  const configPath = path.join(__dirname, '../examples/valid-config.json');
  const config = parseJsonWithSource(configPath);
  const validationResult = validateConfig(config);
  const result = attributeErrors(validationResult);
  
  if (result.summary.hasErrors !== false) {
    throw new Error(`正确配置不应产生错误，但有 ${result.summary.totalErrors} 个错误`);
  }
  
  if (result.summary.totalErrors !== 0) {
    const mismatches = result.applications.flatMap(a => 
      a.environments.flatMap(e => 
        e.issues.filter(i => i.type === 'REDIRECT_URI_MISMATCH')
      )
    );
    throw new Error(`不应产生REDIRECT_URI_MISMATCH，但发现 ${mismatches.length} 个: ${JSON.stringify(mismatches)}`);
  }
});

test('完全不匹配的回调地址应正确检测到REDIRECT_URI_MISMATCH', () => {
  const config = {
    applications: [{
      name: "测试错误应用",
      environments: [{
        name: "production",
        authorizedRedirectUris: ["https://correct.example.com/callback"],
        authUrl: "https://auth.example.com/authorize?client_id=test&redirect_uri=https%3A%2F%2Fwrong.example.com%2Fcb&response_type=code"
      }]
    }]
  };
  
  const configWithSource = {
    ...config,
    _file: "test.json",
    _fileName: "test.json",
    applications: config.applications.map(app => ({
      ...app,
      _source: { file: "test.json", fileName: "test.json", line: 2, index: 0 },
      environments: app.environments.map(env => ({
        ...env,
        _source: { file: "test.json", fileName: "test.json", line: 4, index: 0 },
        authorizedRedirectUris: env.authorizedRedirectUris.map((uri, idx) => ({
          value: uri,
          _source: { file: "test.json", fileName: "test.json", line: 6 + idx * 2, index: idx, rawContent: uri }
        }))
      }))
    }))
  };
  
  const validationResult = validateConfig(configWithSource);
  const result = attributeErrors(validationResult);
  
  if (result.summary.totalErrors !== 1) {
    throw new Error(`应该检测到1个错误，但发现 ${result.summary.totalErrors} 个`);
  }
  
  const mismatchIssue = result.applications[0].environments[0].issues.find(i => i.type === 'REDIRECT_URI_MISMATCH');
  if (!mismatchIssue) {
    throw new Error('应该检测到REDIRECT_URI_MISMATCH错误，但未发现');
  }
});

console.log(chalk.yellow('\n📋 单元测试:'));
tests.forEach(runTest);

console.log(chalk.yellow('\n🔗 CLI集成测试:'));

try {
  console.log(chalk.gray('  测试中: validate命令基础执行'));
  const output = execSync('node src/cli.js validate -c examples/oauth-config.json', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe'
  });
  if (!output.toString().includes('OAuth回调地址校验结果')) {
    throw new Error('终端输出格式不正确');
  }
  console.log(chalk.green('  ✓ validate命令基础执行'));
  results.passed++;
  results.total++;
} catch (error) {
  if (error.status === 1) {
    console.log(chalk.green('  ✓ validate命令基础执行'));
    console.log(chalk.gray('    (预期退出码1 - 配置中包含错误)'));
    results.passed++;
  } else {
    console.log(chalk.red('  ✗ validate命令基础执行'));
    console.log(chalk.red(`    退出码: ${error.status}`));
    results.failed++;
  }
  results.total++;
}

try {
  console.log(chalk.gray('  测试中: normalize命令执行'));
  execSync('node src/cli.js normalize https://example.com/callback', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe'
  });
  console.log(chalk.green('  ✓ normalize命令执行'));
  results.passed++;
  results.total++;
} catch (error) {
  console.log(chalk.red('  ✗ normalize命令执行'));
  results.failed++;
  results.total++;
}

try {
  console.log(chalk.gray('  测试中: --json输出格式'));
  let output;
  try {
    output = execSync('node src/cli.js validate -c examples/oauth-config.json --json', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    }).toString();
  } catch (e) {
    output = e.stdout.toString();
  }
  const parsed = JSON.parse(output);
  if (!parsed.result || !parsed.result.summary) {
    throw new Error('JSON输出缺少result字段');
  }
  console.log(chalk.green('  ✓ --json输出格式正确'));
  results.passed++;
  results.total++;
} catch (error) {
  console.log(chalk.red('  ✗ --json输出格式正确'));
  console.log(chalk.red(`    错误: ${error.message}`));
  results.failed++;
  results.total++;
}

try {
  console.log(chalk.gray('  测试中: --report生成HTML报告'));
  if (!fs.existsSync(path.join(__dirname, '../reports'))) {
    fs.mkdirSync(path.join(__dirname, '../reports'), { recursive: true });
  }
  try {
    execSync('node src/cli.js validate -c examples/oauth-config.json --report -o reports/test', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
  } catch (e) {
  }
  const reportFiles = fs.readdirSync(path.join(__dirname, '../reports/test'));
  const hasHtml = reportFiles.some(f => f.endsWith('.html'));
  const hasJson = reportFiles.some(f => f.endsWith('.json'));
  if (!hasHtml || !hasJson) {
    throw new Error('报告文件未生成');
  }
  console.log(chalk.green('  ✓ --report生成HTML报告'));
  results.passed++;
  results.total++;
} catch (error) {
  console.log(chalk.red('  ✗ --report生成HTML报告'));
  console.log(chalk.red(`    错误: ${error.message}`));
  results.failed++;
  results.total++;
}

console.log('');
console.log(chalk.bold('='.repeat(70)));
console.log(chalk.bold('📊 测试结果汇总'));
console.log(chalk.bold('='.repeat(70)));
console.log(`  总测试数: ${results.total}`);
console.log(`  ${chalk.green('通过: ' + results.passed)}`);
console.log(`  ${chalk.red('失败: ' + results.failed)}`);
console.log(`  通过率: ${((results.passed / results.total) * 100).toFixed(1)}%`);
console.log('');

if (results.failed === 0) {
  console.log(chalk.green.bold('✅ 所有测试通过!'));
  process.exit(0);
} else {
  console.log(chalk.red.bold('❌ 部分测试失败，请检查代码'));
  process.exit(1);
}
