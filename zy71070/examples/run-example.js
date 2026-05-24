#!/usr/bin/env node

const path = require('path');
const { runConfigTrace } = require('../src/index');

async function main() {
  console.log('=== 运行配置合并轨迹示例 ===\n');

  const options = {
    default: path.join(__dirname, 'default.json'),
    env: path.join(__dirname, 'env.json'),
    tenant: path.join(__dirname, 'tenant.json'),
    output: path.join(__dirname, '..', 'output'),
    arrayMerge: 'replace',
    caseSensitive: false,
    format: 'all',
    color: true,
    silent: false
  };

  console.log('示例1: 完整合并分析');
  console.log('配置文件:');
  console.log('  - 默认:', options.default);
  console.log('  - 环境:', options.env);
  console.log('  - 租户:', options.tenant);
  console.log();

  const exitCode = await runConfigTrace(options);

  console.log('\n=== 示例2: 追踪特定键路径 ===');
  console.log('追踪: database.host\n');

  const options2 = {
    ...options,
    keyPath: 'database.host',
    format: 'terminal',
    silent: false
  };

  await runConfigTrace(options2);

  console.log('\n=== 示例3: 数组合并模式演示 (concat) ===');

  const options3 = {
    ...options,
    arrayMerge: 'concat',
    format: 'terminal',
    silent: false,
    keyPath: 'allowedOrigins'
  };

  await runConfigTrace(options3);

  console.log('\n=== 示例运行完成 ===');
  console.log('退出码:', exitCode);
}

main().catch(console.error);
