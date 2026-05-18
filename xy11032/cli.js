#!/usr/bin/env node

const 借用服务 = require('./src/services/lending-service');
const 校验服务 = require('./src/services/validation-service');
const 导出服务 = require('./src/services/export-service');
const db = require('./src/database/db');

async function main() {
  const 命令 = process.argv[2];

  switch (命令) {
    case 'check':
      console.log('正在执行借还一致性检查...\n');
      const 检查结果 = await 校验服务.检查借还一致性();
      console.log(JSON.stringify(检查结果, null, 2));
      break;

    case 'borrow':
      const 借用参数 = {
        器械编号: process.argv[3] || 'QXB-2024-005',
        借用人工号: 'D001',
        借用人姓名: '张医生',
        借用科室: '口腔修复科',
        借用用途: '常规检查治疗'
      };
      console.log('登记借用...\n');
      console.log(JSON.stringify(await 借用服务.登记借用(借用参数), null, 2));
      break;

    case 'return':
      const 归还参数 = {
        记录编号: parseInt(process.argv[3]) || 1,
        器械编号: 'QXB-2024-001',
        归还人工号: 'D001',
        归还人姓名: '张医生'
      };
      console.log('登记归还...\n');
      console.log(JSON.stringify(await 借用服务.登记归还(归还参数), null, 2));
      break;

    case 'export':
      const 格式 = process.argv[3] || 'json';
      console.log(`正在导出数据 (${格式}格式)...\n`);
      if (格式 === 'csv') {
        const csvData = await 导出服务.导出CSV();
        console.log(csvData);
      } else {
        console.log(await 导出服务.导出JSON());
      }
      break;

    case 'stats':
      console.log('统计概览...\n');
      const 借用中 = await db.prepare(`SELECT COUNT(*) as count FROM 器械档案 WHERE 当前状态 = '借用中'`).get();
      const 在库 = await db.prepare(`SELECT COUNT(*) as count FROM 器械档案 WHERE 当前状态 = '在库'`).get();
      console.log(JSON.stringify({ 借用中: 借用中.count, 在库: 在库.count }, null, 2));
      break;

    case 'list':
      console.log('借还明细列表...\n');
      const 记录 = await 导出服务.查询借还明细();
      console.log(JSON.stringify(记录, null, 2));
      break;

    default:
      console.log(`
牙科器材库器械借用归还系统 - 命令行工具

使用方法:
  node cli.js <命令> [参数]

可用命令:
  check           - 执行借还一致性检查
  borrow [编号]    - 登记器械借用
  return [记录号] - 登记器械归还
  export [格式]   - 导出数据 (json/csv)
  stats           - 统计概览
  list            - 列出借还明细

示例:
  node cli.js check
  node cli.js borrow QXB-2024-005
  node cli.js export csv
`);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('执行出错:', err);
  process.exit(1);
});
