#!/usr/bin/env tsx
/**
 * 复盘脚本：导入示例数据
 * 使用方法：npx tsx scripts/import-sample.ts
 */

import { complaintService } from '../api/services/complaintService.js';
import { seedInitialData } from '../api/data/seedData.js';
import { ImportComplaintDto } from '../shared/types.js';

const sampleData: ImportComplaintDto[] = [
  {
    complaintNo: 'TS-2026-SAMPLE-01',
    originalRowNo: 101,
    residentOpinionSummary: '菜市场入口处流动摊贩堵塞人行道',
    residentOpinionOriginal: '我们家住在菜市场旁边，每天上下班都要经过那个路口，最近流动摊贩越来越多，把人行道都占满了，行人只能走非机动车道，太危险了。尤其是早上送孩子的时候，人挤人车挤车的，真担心出事。',
  },
  {
    complaintNo: 'TS-2026-SAMPLE-02',
    originalRowNo: 102,
    residentOpinionSummary: '水产摊位污水排放到路面',
  },
];

async function main() {
  console.log('='.repeat(60));
  console.log('菜市场摊位外溢治理 - 导入示例数据脚本');
  console.log('='.repeat(60));
  console.log();

  await seedInitialData();
  console.log('✓ 数据初始化完成');
  console.log();

  console.log('正在导入示例数据...');
  console.log();

  const result = await complaintService.importComplaints(sampleData, '命令行脚本');

  console.log(`导入完成：`);
  console.log(`  - 成功导入：${result.imported.length} 条`);
  console.log(`  - 重复记录：${result.duplicates.length} 条`);
  console.log();

  result.imported.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.complaintNo} - 原始行号: ${c.originalRowNo}`);
    console.log(`     状态: ${c.status}, 当前步骤: 第${c.currentStep}步`);
    console.log(`     居民意见有原文: ${c.residentOpinion.hasOriginal ? '是' : '否'}`);
    console.log();
  });

  console.log('='.repeat(60));
  console.log('导入完成。现在可以启动服务器查看效果：');
  console.log('  npm run dev');
  console.log('='.repeat(60));
}

main().catch(console.error);
