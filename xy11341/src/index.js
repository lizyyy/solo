#!/usr/bin/env node

const { Command } = require('commander');
const importService = require('./services/importService');
const receiveService = require('./services/receiveService');
const returnService = require('./services/returnService');
const claimService = require('./services/claimService');
const exportService = require('./services/exportService');
const { getLogs } = require('./utils/audit');

const program = new Command();

program
  .name('warehouse')
  .description('家电售后仓管理CLI工具')
  .version('1.0.0');

program.command('import')
  .description('导入领件单CSV')
  .argument('<file>', 'CSV文件路径')
  .action(async (file) => {
    console.log(`开始导入: ${file}`);
    const result = await importService.importReceiveOrders(file);
    
    console.log('\n=== 导入结果 ===');
    console.log(`总计: ${result.total} 条`);
    console.log(`成功: ${result.success.length} 条`);
    console.log(`失败: ${result.failed.length} 条`);
    
    if (result.success.length > 0) {
      console.log('\n成功导入的单号:');
      result.success.forEach(s => console.log(`  - ${s.orderNo}`));
    }
    
    if (result.failed.length > 0) {
      console.log('\n失败记录:');
      result.failed.forEach(f => console.log(`  - ${f.orderNo}: ${f.error}`));
    }
  });

program.command('list-receive')
  .description('查询领件单')
  .option('--engineer <id>', '工程师ID')
  .option('--batch <no>', '批次号')
  .option('--pending-return', '旧件未返还')
  .option('--pending-claim', '待索赔')
  .action((options) => {
    const filters = {};
    if (options.engineer) filters.engineer_id = options.engineer;
    if (options.batch) filters.batch_no = options.batch;
    if (options.pendingReturn) filters.old_part_returned = false;
    if (options.pendingClaim) filters.claim_status = 'pending';

    const orders = receiveService.getReceiveOrders(filters);
    console.log(`\n找到 ${orders.length} 条记录:\n`);
    
    orders.forEach(order => {
      console.log(`单号: ${order.order_no}`);
      console.log(`  工程师: ${order.engineer_name} (${order.engineer_id})`);
      console.log(`  配件: ${order.part_name} (${order.part_code})`);
      console.log(`  批次: ${order.batch_no}`);
      console.log(`  旧件状态: ${order.old_part_returned ? '已返还' : '未返还'}`);
      console.log(`  索赔状态: ${order.claim_status}`);
      console.log('');
    });
  });

program.command('return')
  .description('旧件返还')
  .argument('<orderNo>', '领件单号')
  .option('--date <date>', '返还日期')
  .option('--remarks <text>', '备注')
  .action((orderNo, options) => {
    const result = returnService.createReturn({
      receive_order_no: orderNo,
      return_date: options.date,
      remarks: options.remarks,
    });

    if (result.success) {
      console.log(`返还成功! 返还单号: ${result.returnNo}`);
    } else {
      console.log(`返还失败: ${result.error}`);
    }
  });

program.command('claim')
  .description('创建索赔单')
  .requiredOption('--vendor-code <code>', '厂商代码')
  .requiredOption('--vendor-name <name>', '厂商名称')
  .requiredOption('--orders <orders>', '领件单号列表，逗号分隔')
  .option('--price <price>', '单价（所有订单统一）')
  .action((options) => {
    const orderNos = options.orders.split(',').map(o => o.trim());
    const items = orderNos.map(no => ({
      receive_order_no: no,
      unit_price: options.price || 0,
    }));

    const result = claimService.createClaim({
      vendor_code: options.vendorCode,
      vendor_name: options.vendorName,
      items,
    });

    if (result.success) {
      console.log(`\n索赔创建成功! 索赔单号: ${result.claimNo}`);
      console.log(`总金额: ${result.totalAmount}`);
      console.log(`通过校验: ${result.validatedItems.length} 条`);
      
      if (result.failedItems.length > 0) {
        console.log(`\n未通过校验: ${result.failedItems.length} 条`);
        result.failedItems.forEach(f => {
          console.log(`\n  - ${f.receive_order_no}: ${f.error}`);
          if (f.ruleResults) {
            f.ruleResults.forEach(r => {
              console.log(`    [${r.passed ? '通过' : '拦截'}] ${r.ruleName}: ${r.reason}`);
            });
          }
        });
      }
    } else {
      console.log(`索赔创建失败: ${result.error}`);
      if (result.failedItems) {
        result.failedItems.forEach(f => {
          console.log(`  - ${f.receive_order_no}: ${f.error}`);
        });
      }
    }
  });

program.command('list-claims')
  .description('查询索赔单')
  .option('--status <status>', '状态')
  .action((options) => {
    const claims = claimService.getClaims(options);
    console.log(`\n找到 ${claims.length} 条索赔单:\n`);
    
    claims.forEach(claim => {
      console.log(`索赔单号: ${claim.claim_no}`);
      console.log(`  厂商: ${claim.vendor_name} (${claim.vendor_code})`);
      console.log(`  索赔日期: ${claim.claim_date}`);
      console.log(`  总金额: ${claim.total_amount}`);
      console.log(`  状态: ${claim.status}`);
      console.log('');
    });
  });

program.command('export')
  .description('导出数据')
  .requiredOption('--type <type>', '数据类型: receive/claims/rules')
  .requiredOption('--output <path>', '输出文件路径')
  .action((options) => {
    let result;
    
    switch (options.type) {
      case 'receive':
        result = exportService.exportReceiveOrders(options.output);
        break;
      case 'claims':
        result = exportService.exportClaims(options.output);
        break;
      case 'rules':
        result = exportService.exportRuleResults(options.output);
        break;
      default:
        console.log('不支持的导出类型');
        process.exit(1);
    }

    if (result.success) {
      console.log(`导出成功! 文件: ${result.filePath}`);
      console.log(`导出数量: ${result.count} 条`);
    } else {
      console.log(`导出失败: ${result.error}`);
    }
  });

program.command('rules')
  .description('查询规则校验结果')
  .argument('<orderNo>', '领件单号/索赔单号')
  .action((orderNo) => {
    const results = claimService.getRuleResults(orderNo);
    console.log(`\n找到 ${results.length} 条规则校验记录:\n`);
    
    results.forEach(r => {
      console.log(`规则类型: ${r.rule_type}`);
      console.log(`规则名称: ${r.rule_name}`);
      console.log(`结果: ${r.passed ? '通过' : '拦截'}`);
      console.log(`原因: ${r.reason}`);
      console.log(`时间: ${r.created_at}`);
      if (r.details) {
        console.log(`详情: ${r.details}`);
      }
      console.log('');
    });
  });

program.command('logs')
  .description('查看操作日志')
  .option('--type <type>', '实体类型')
  .option('--limit <n>', '数量限制', '100')
  .action((options) => {
    const logs = getLogs(options.type, parseInt(options.limit));
    console.log(`\n找到 ${logs.length} 条日志:\n`);
    
    logs.forEach(log => {
      console.log(`[${log.created_at}] ${log.action} ${log.entity_type}`);
      if (log.entity_no) console.log(`  单号: ${log.entity_no}`);
      console.log('');
    });
  });

program.command('stats')
  .description('查看统计信息')
  .action(() => {
    const stats = receiveService.getStatistics();
    console.log('\n=== 统计信息 ===');
    console.log(`领件单总数: ${stats.total}`);
    console.log(`旧件已返还: ${stats.oldPartReturned}`);
    console.log(`旧件待返还: ${stats.oldPartPending}`);
    console.log(`已索赔: ${stats.claimed}`);
    console.log(`待索赔: ${stats.claimPending}`);
    console.log('');
  });

program.parse();
