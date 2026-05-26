import { initDatabase, runQuery } from '../database';
import { createRetestRule } from '../services/retestRuleService';
import { importSampleCsv, importInspectionJson } from '../services/importService';
import * as fs from 'fs';
import * as path from 'path';

async function seed() {
  console.log('开始初始化数据库...');
  await initDatabase();

  console.log('\n正在创建复检规则...');
  
  const rules = [
    {
      rule_code: 'RETEST001',
      rule_name: '农药残留超标复检',
      item_code: 'P001',
      fail_threshold: '0.1',
      retest_count: 1,
      retest_window_hours: 24,
      action_on_fail: 'review' as const,
      description: '有机磷农药残留超标时需在24小时内完成复检',
      is_active: true,
    },
    {
      rule_code: 'RETEST002',
      rule_name: '重金属铅超标复检',
      item_code: 'H001',
      fail_threshold: '0.1',
      retest_count: 2,
      retest_window_hours: 48,
      action_on_fail: 'supplement' as const,
      description: '重金属铅超标时需在48小时内完成复检，复检2次',
      is_active: true,
    },
    {
      rule_code: 'RETEST003',
      rule_name: '通用不合格复检',
      item_code: null as any,
      fail_threshold: null as any,
      retest_count: 1,
      retest_window_hours: 24,
      action_on_fail: 'review' as const,
      description: '通用不合格项复检规则',
      is_active: true,
    },
  ];

  for (const rule of rules) {
    try {
      const { id, created_at, ...ruleData } = rule as any;
      await createRetestRule(ruleData);
      console.log(`  ✓ 创建规则: ${rule.rule_code} - ${rule.rule_name}`);
    } catch (e) {
      console.log(`  ! 规则已存在或创建失败: ${rule.rule_code} - ${(e as Error).message}`);
    }
  }

  console.log('\n正在导入样品CSV...');
  const csvPath = path.join(__dirname, '../../samples/sample_csv.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const csvResult = await importSampleCsv(csvContent, 'sample_csv.csv', 'system');
  console.log(`  ✓ 导入完成: ${csvResult.samples.length} 条样品记录, ${csvResult.errors.length} 个错误`);

  console.log('\n正在导入检测项目JSON...');
  const jsonPath = path.join(__dirname, '../../samples/inspection_data.json');
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const jsonResult = await importInspectionJson(jsonContent, 'inspection_data.json', 'system');
  console.log(`  ✓ 导入完成: ${jsonResult.items.length} 条检测记录, ${jsonResult.errors.length} 个错误`);

  console.log('\n示例数据初始化完成！');
  console.log(`  样品CSV导入ID: ${csvResult.importRecord.id}`);
  console.log(`  检测JSON导入ID: ${jsonResult.importRecord.id}`);
  console.log('\n现在可以运行测试脚本: npm test');
  console.log('或启动服务器: npm run dev');
}

seed().catch(console.error);
