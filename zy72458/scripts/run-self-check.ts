#!/usr/bin/env tsx
/**
 * 复盘脚本：运行自检
 * 使用方法：npx tsx scripts/run-self-check.ts
 */

import { selfCheckService } from '../api/services/selfCheckService.js';
import { seedInitialData } from '../api/data/seedData.js';

async function main() {
  console.log('='.repeat(60));
  console.log('菜市场摊位外溢治理 - 自检脚本');
  console.log('='.repeat(60));
  console.log();

  await seedInitialData();
  console.log('✓ 数据初始化完成');
  console.log();

  console.log('正在运行四项自检...');
  console.log();

  const results = await selfCheckService.runAllChecks('命令行脚本');

  results.forEach(result => {
    const statusIcon = result.status === 'pass' ? '✓' : result.status === 'warning' ? '⚠' : '✗';
    const statusColor = result.status === 'pass' ? '\x1b[32m' : result.status === 'warning' ? '\x1b[33m' : '\x1b[31m';
    console.log(`${statusColor}${statusIcon}\x1b[0m ${result.checkName}`);
    console.log(`   ${result.message}`);
    if (result.details.length > 0) {
      console.log(`   发现 ${result.details.length} 个问题：`);
      result.details.slice(0, 3).forEach((d, i) => {
        console.log(`     - ${JSON.stringify(d).slice(0, 80)}...`);
      });
      if (result.details.length > 3) {
        console.log(`     ... 还有 ${result.details.length - 3} 个问题`);
      }
    }
    console.log();
  });

  console.log('='.repeat(60));
  console.log('自检完成');
  console.log('='.repeat(60));
}

main().catch(console.error);
