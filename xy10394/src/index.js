#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

const program = new Command();

import { loadData, saveData, getSuppliers, getQualifications, getPurchaseOrders } from './storage.js';
import { importSuppliers, importQualifications, importPurchaseOrders } from './import.js';
import { checkAllRisks, getRiskSummary, filterRisksByLevel, filterRisksByType } from './riskCheck.js';
import { generateTextReport, generateJSONReport, displayRisksByLevel } from './report.js';
import { registerRenewal, getPendingRenewals, getRenewalHistory } from './renewal.js';
import { searchSuppliers, searchQualifications, searchPurchaseOrders } from './search.js';

program
  .name('sq-cli')
  .description('供应商资质到期管理 CLI 工具')
  .version('1.0.0');

loadData();

program
  .command('import')
  .description('导入数据')
  .option('-s, --suppliers <file>', '导入供应商档案')
  .option('-q, --qualifications <file>', '导入资质清单')
  .option('-p, --purchase-orders <file>', '导入采购单')
  .action((options) => {
    let results = [];
    
    if (options.suppliers) {
      const result = importSuppliers(options.suppliers);
      results.push(`✓ 供应商: 导入 ${result.imported} 条`);
    }
    
    if (options.qualifications) {
      const result = importQualifications(options.qualifications);
      results.push(`✓ 资质: 导入 ${result.imported} 条`);
      if (result.errors.length > 0) {
        results.push(`  错误: ${result.errors.length} 条`);
        for (const err of result.errors) {
          results.push(`    - ${err.error}`);
        }
      }
    }
    
    if (options.purchaseOrders) {
      const result = importPurchaseOrders(options.purchaseOrders);
      results.push(`✓ 采购单: 导入 ${result.imported} 条`);
      if (result.errors.length > 0) {
        results.push(`  错误: ${result.errors.length} 条`);
      }
    }
    
    saveData();
    
    if (results.length === 0) {
      console.log('请指定要导入的文件类型，使用 --help 查看帮助');
      return;
    }
    
    console.log('\n' + results.join('\n') + '\n');
  });

program
  .command('check')
  .description('检查所有供应商资质风险')
  .option('--level <level>', '按风险等级筛选 (CRITICAL|HIGH|MEDIUM|LOW)')
  .option('--type <type>', '按风险类型筛选')
  .action((options) => {
    let risks = checkAllRisks();
    
    if (options.level) {
      risks = filterRisksByLevel(risks, options.level.toUpperCase());
    }
    
    if (options.type) {
      risks = filterRisksByType(risks, options.type);
    }
    
    const summary = getRiskSummary(risks);
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                     风险检查结果');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`总风险数: ${summary.total}`);
    console.log(`严重 (CRITICAL): ${summary.byLevel.CRITICAL}`);
    console.log(`高 (HIGH): ${summary.byLevel.HIGH}`);
    console.log(`中 (MEDIUM): ${summary.byLevel.MEDIUM}`);
    console.log(`低 (LOW): ${summary.byLevel.LOW}\n`);
    
    if (risks.length > 0) {
      console.log(displayRisksByLevel(risks));
    } else {
      console.log('✓ 没有发现风险项');
    }
    
    console.log('\n');
  });

program
  .command('list')
  .description('列出数据')
  .option('-s, --suppliers', '列出所有供应商')
  .option('-q, --qualifications', '列出所有资质')
  .option('-p, --purchase-orders', '列出所有采购单')
  .option('--search <query>', '搜索关键词')
  .action((options) => {
    if (options.suppliers) {
      let items = options.search ? searchSuppliers(options.search) : getSuppliers();
      console.log(`\n供应商列表 (${items.length} 条):`);
      console.log('─'.repeat(60));
      for (const s of items) {
        console.log(`[${s.code}] ${s.name} | ${s.contact || '-'} | ${s.phone || '-'}`);
      }
    }
    
    if (options.qualifications) {
      let items = options.search ? searchQualifications(options.search) : getQualifications();
      console.log(`\n资质列表 (${items.length} 条):`);
      console.log('─'.repeat(60));
      for (const q of items) {
        const supplier = getSuppliers().find(s => s.id === q.supplierId);
        console.log(`[${supplier?.name || '未知'}] ${q.type} | 版本:v${q.version} | 到期:${q.expiryDate || '-'} | ${q.certificateNumber || '-'}`);
      }
    }
    
    if (options.purchaseOrders) {
      let items = options.search ? searchPurchaseOrders(options.search) : getPurchaseOrders();
      console.log(`\n采购单列表 (${items.length} 条):`);
      console.log('─'.repeat(60));
      for (const po of items) {
        const supplier = getSuppliers().find(s => s.id === po.supplierId);
        console.log(`${po.orderNumber} | ${supplier?.name || '未知'} | ${po.orderDate} | ${po.amount || 0}元`);
      }
    }
    console.log('\n');
  });

program
  .command('renewal')
  .description('登记资质补交/更新')
  .requiredOption('-c, --supplier-code <code>', '供应商编码')
  .requiredOption('-t, --type <type>', '资质类型')
  .requiredOption('-e, --expiry <date>', '新到期日期 (yyyy-MM-dd)')
  .option('-n, --cert-number <num>', '新证书编号')
  .action((options) => {
    const result = registerRenewal(
      options.supplierCode,
      options.type,
      options.expiry,
      options.certNumber
    );
    
    if (result.success) {
      console.log(`\n✓ ${result.message}`);
      console.log(`  状态: ${result.status} (${result.daysLeft >= 0 ? `剩余 ${result.daysLeft} 天` : `已过期 ${Math.abs(result.daysLeft)} 天`})`);
    } else {
      console.log(`\n✗ ${result.error}`);
    }
    console.log('\n');
  });

program
  .command('pending')
  .description('查看待处理的资质更新')
  .action(() => {
    const pending = getPendingRenewals();
    
    console.log(`\n待处理的资质更新 (${pending.length} 条):`);
    console.log('─'.repeat(80));
    
    for (const item of pending) {
      const statusText = item.status === 'expired' 
        ? `已过期 ${Math.abs(item.daysLeft)} 天` 
        : `${item.daysLeft} 天后到期`;
      console.log(`[${item.supplierCode}] ${item.supplierName} | ${item.qualificationType} | ${statusText} | v${item.version}`);
    }
    
    if (pending.length === 0) {
      console.log('✓ 没有待处理的更新');
    }
    console.log('\n');
  });

program
  .command('history')
  .description('查看资质更新历史')
  .action(() => {
    const history = getRenewalHistory();
    
    console.log(`\n资质更新历史 (${history.length} 条):`);
    console.log('─'.repeat(80));
    
    for (const item of history) {
      console.log(`[${item.supplierCode}] ${item.supplierName} | ${item.qualificationType} | v${item.currentVersion}`);
      console.log(`  旧到期: ${item.oldExpiry} → 新到期: ${item.currentExpiry}`);
      if (item.remarks !== '-') {
        console.log(`  备注: ${item.remarks}`);
      }
    }
    
    if (history.length === 0) {
      console.log('暂无更新历史');
    }
    console.log('\n');
  });

program
  .command('report')
  .description('生成风险提醒报告')
  .option('-o, --output <file>', '输出文件路径')
  .option('-f, --format <format>', '输出格式 (text|json)', 'text')
  .action((options) => {
    const risks = checkAllRisks();
    
    if (options.format === 'json') {
      if (options.output) {
        const result = generateJSONReport(risks, options.output);
        console.log(`\n✓ JSON 报告已保存到: ${result.path}\n`);
      } else {
        const report = generateJSONReport(risks);
        console.log(JSON.stringify(report, null, 2));
      }
    } else {
      if (options.output) {
        const result = generateTextReport(risks, options.output);
        console.log(`\n✓ 文本报告已保存到: ${result.path}\n`);
      } else {
        const report = generateTextReport(risks);
        console.log(report);
      }
    }
  });

program
  .command('search')
  .description('搜索数据')
  .argument('<query>', '搜索关键词')
  .option('-s, --suppliers', '搜索供应商')
  .option('-q, --qualifications', '搜索资质')
  .option('-p, --purchase-orders', '搜索采购单')
  .action((query, options) => {
    if (options.suppliers || (!options.qualifications && !options.purchaseOrders)) {
      const results = searchSuppliers(query);
      console.log(`\n供应商搜索结果 (${results.length} 条):`);
      for (const s of results) {
        console.log(`  [${s.code}] ${s.name}`);
      }
    }
    
    if (options.qualifications || (!options.suppliers && !options.purchaseOrders)) {
      const results = searchQualifications(query);
      console.log(`\n资质搜索结果 (${results.length} 条):`);
      for (const q of results) {
        const supplier = getSuppliers().find(s => s.id === q.supplierId);
        console.log(`  [${supplier?.name || '未知'}] ${q.type} (到期:${q.expiryDate || '-'})`);
      }
    }
    
    if (options.purchaseOrders || (!options.suppliers && !options.qualifications)) {
      const results = searchPurchaseOrders(query);
      console.log(`\n采购单搜索结果 (${results.length} 条):`);
      for (const po of results) {
        console.log(`  ${po.orderNumber} (${po.orderDate})`);
      }
    }
    console.log('\n');
  });

program.parse(process.argv);
