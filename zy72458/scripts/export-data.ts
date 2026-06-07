#!/usr/bin/env tsx
/**
 * 复盘脚本：导出数据
 * 使用方法：npx tsx scripts/export-data.ts [输出路径]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportService } from '../api/services/exportService.js';
import { seedInitialData } from '../api/data/seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const outputPath = process.argv[2] || path.resolve(__dirname, `../data/export_${Date.now()}.json`);

  console.log('='.repeat(60));
  console.log('菜市场摊位外溢治理 - 数据导出脚本');
  console.log('='.repeat(60));
  console.log();

  await seedInitialData();
  console.log('✓ 数据初始化完成');
  console.log();

  console.log('正在导出数据...');
  const result = await exportService.exportAll('命令行脚本');

  fs.writeFileSync(outputPath, JSON.stringify(result.data, null, 2), 'utf-8');

  console.log(`✓ 导出完成，共 ${result.count} 条记录`);
  console.log(`✓ 输出路径：${outputPath}`);
  console.log(`✓ 导出时间：${new Date(result.exportTime).toLocaleString('zh-CN')}`);
  console.log();
  console.log('='.repeat(60));
}

main().catch(console.error);
