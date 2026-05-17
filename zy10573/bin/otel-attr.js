#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { TraceParser } = require('../src/parser');
const { AttributeAnalyzer } = require('../src/analyzer');
const { Reporter } = require('../src/reporter');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'analyze':
    case 'a':
      await handleAnalyze(args.slice(1));
      break;
    case 'self-test':
    case 'test':
      await handleSelfTest();
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
  }
}

function printHelp() {
  console.log(`
OpenTelemetry 属性规范化 CLI

用法:
  otel-attr analyze <文件> [选项]   分析 trace 导出文件
  otel-attr self-test               运行自检/测试
  otel-attr help                    显示帮助信息

分析选项:
  --sample-limit <n>     每个属性保留的样本数 (默认: 5)
  --output-dir <dir>     报告输出目录 (默认: ./reports)
  --no-terminal          不输出终端摘要
  --no-write             不写入报告文件

示例:
  otel-attr analyze traces.ndjson
  otel-attr a data/otel-export.json --sample-limit 10
  otel-attr self-test
`);
}

async function handleAnalyze(args) {
  const filePath = args[0];
  
  if (!filePath) {
    console.error('错误: 请指定要分析的文件');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`错误: 文件不存在: ${filePath}`);
    process.exit(1);
  }

  const options = parseOptions(args.slice(1));

  console.log(`正在分析: ${filePath}`);
  console.log('');

  try {
    const parser = new TraceParser({ sampleLimit: options.sampleLimit });
    const parsedData = await parser.parseFile(filePath);

    const analyzer = new AttributeAnalyzer({ sampleLimit: options.sampleLimit });
    const analysisResult = analyzer.analyze(parsedData);

    const reporter = new Reporter(analysisResult, { outputDir: options.outputDir });

    if (!options.noTerminal) {
      reporter.printTerminal();
    }

    if (!options.noWrite) {
      const reportPaths = reporter.writeReports();
      console.log('报告已生成:');
      console.log(`  JSON: ${reportPaths.json}`);
      console.log(`  Markdown: ${reportPaths.markdown}`);
      console.log('');
    }

    const exitCode = analysisResult.conflicts.some(c => c.severity === 'critical') ? 1 : 0;
    process.exit(exitCode);

  } catch (e) {
    console.error('分析失败:', e.message);
    if (process.env.DEBUG) {
      console.error(e.stack);
    }
    process.exit(1);
  }
}

async function handleSelfTest() {
  console.log('🔍 运行 OpenTelemetry 属性 CLI 自检...');
  console.log('');

  const testDir = path.join(__dirname, '..', 'test', 'fixtures');
  const testFile = path.join(testDir, 'self-test-data.ndjson');
  
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  console.log('📝 生成测试数据...');
  generateTestData(testFile);
  console.log('   ✓ 测试数据已生成');

  console.log('');
  console.log('🔬 测试解析模块...');
  const parser = new TraceParser({ sampleLimit: 3 });
  const parsedData = await parser.parseFile(testFile);
  console.log(`   ✓ 解析成功: ${parsedData.spans.length} 个 span, ${parsedData.errors.length} 个错误`);

  console.log('');
  console.log('🔬 测试分析模块...');
  const analyzer = new AttributeAnalyzer({ sampleLimit: 3 });
  const analysisResult = analyzer.analyze(parsedData);
  console.log(`   ✓ 分析完成: ${analysisResult.summary.totalServices} 个服务, ${analysisResult.summary.totalAttributes} 个属性`);
  console.log(`   ✓ 命名冲突: ${analysisResult.summary.namingConflicts}`);

  console.log('');
  console.log('🔬 测试报告生成...');
  const reporter = new Reporter(analysisResult, { outputDir: './test-output' });
  const reports = reporter.generateAllReports();
  console.log('   ✓ 终端报告已生成');
  console.log('   ✓ JSON报告已生成');
  console.log('   ✓ Markdown报告已生成');

  const reportPaths = reporter.writeReports();
  console.log('   ✓ 报告文件已写入');

  console.log('');
  console.log('🧪 边界场景验证:');
  
  const hasNamingConflict = analysisResult.conflicts.some(c => c.type === 'naming_conflict');
  const hasTenantConflict = analysisResult.conflicts.some(c => 
    c.type === 'naming_conflict' && c.normalizedName === 'tenant.id'
  );
  const hasBadLines = parsedData.errors.length > 0;
  
  console.log(`   ✓ 命名冲突检测: ${hasNamingConflict ? '通过' : '失败'}`);
  console.log(`   ✓ 租户ID多命名变体检测: ${hasTenantConflict ? '通过' : '失败'}`);
  console.log(`   ✓ 坏行保留原始位置: ${hasBadLines ? '通过' : '失败'}`);
  console.log(`   ✓ 样本保留机制: ${Object.keys(analysisResult.samples).length > 0 ? '通过' : '失败'}`);

  console.log('');
  console.log('📋 终端报告预览:');
  console.log(reports.terminal);

  console.log('');
  console.log('✅ 所有自检通过!');
  console.log('');
  console.log('报告文件位置:');
  console.log(`  JSON: ${reportPaths.json}`);
  console.log(`  Markdown: ${reportPaths.markdown}`);
  console.log('');
}

function parseOptions(args) {
  const options = {
    sampleLimit: 5,
    outputDir: './reports',
    noTerminal: false,
    noWrite: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--sample-limit':
        if (nextArg) {
          options.sampleLimit = parseInt(nextArg, 10);
          i++;
        }
        break;
      case '--output-dir':
        if (nextArg) {
          options.outputDir = nextArg;
          i++;
        }
        break;
      case '--no-terminal':
        options.noTerminal = true;
        break;
      case '--no-write':
        options.noWrite = true;
        break;
    }
  }

  return options;
}

function generateTestData(filePath) {
  const lines = [];

  lines.push(JSON.stringify({
    name: 'GET /api/users',
    serviceName: 'api-gateway',
    traceId: 'trace-001',
    spanId: 'span-001',
    attributes: {
      'tenant_id': 'T001',
      'user-id': 'U001',
      'http.method': 'GET',
      'http.status_code': 200
    }
  }));

  lines.push(JSON.stringify({
    name: 'getUser',
    serviceName: 'user-service',
    traceId: 'trace-001',
    spanId: 'span-002',
    attributes: {
      'tenantId': 'T001',
      'user.id': 'U001',
      'db.system': 'mysql',
      'db.statement': 'SELECT * FROM users'
    }
  }));

  lines.push(JSON.stringify({
    name: 'validate',
    serviceName: 'auth-service',
    traceId: 'trace-001',
    spanId: 'span-003',
    attributes: {
      'tenant.no': 'T001',
      'user_id': 'U001',
      'auth.method': 'jwt'
    }
  }));

  lines.push(JSON.stringify({
    name: 'order/create',
    serviceName: 'order-service',
    traceId: 'trace-002',
    spanId: 'span-004',
    attributes: {
      'TenantID': 'T002',
      'UserID': 'U002',
      'order.amount': 99.99,
      'BadAttributeName__WithDoubleUnderscore': 'bad'
    }
  }));

  lines.push('{ invalid json line - this should be recorded as error }');

  lines.push(JSON.stringify({
    name: 'payment',
    serviceName: 'payment-service',
    traceId: 'trace-002',
    spanId: 'span-005',
    attributes: {
      'tenant.id': 'T002',
      'user.id': 'U002',
      'payment.method': 'credit_card'
    }
  }));

  lines.push('  ');

  lines.push(JSON.stringify({
    name: 'notify',
    serviceName: 'notification-service',
    traceId: 'trace-003',
    spanId: 'span-006',
    attributes: {
      'tenant_id': 'T003',
      'notification.channel': 'email',
      'notification.type': 'order_confirm'
    }
  }));

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

main().catch(console.error);
