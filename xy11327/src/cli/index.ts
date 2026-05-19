import { Command } from 'commander';
import { ImportService } from '../services/ImportService';
import { BillingService } from '../services/BillingService';
import { ReviewService } from '../services/ReviewService';
import { BillService } from '../services/BillService';
import { WorkRecordRepository } from '../repositories/WorkRecordRepository';
import { maskSensitiveData } from '../utils/sensitiveData';
import { logger } from '../utils/logger';

const program = new Command();

program
  .name('farm-coop-finance')
  .description('农机合作社财务管理CLI工具')
  .version('1.0.0');

program
  .command('import')
  .description('从CSV文件导入作业记录')
  .argument('<file>', 'CSV文件路径')
  .action(async (file) => {
    try {
      const importService = new ImportService();
      const result = await importService.importFromCsv(file);

      console.log(`\n导入完成: 共 ${result.total} 条记录`);
      console.log(`成功: ${result.successCount} 条`);
      console.log(`失败: ${result.failedCount} 条\n`);

      if (result.failed.length > 0) {
        console.log('失败记录:');
        result.failed.forEach(f => {
          console.log(`  第${f.index + 1}行 - ${f.item.recordNo}: ${f.error}`);
        });
      }
    } catch (error: any) {
      logger.error(`导入失败: ${error.message}`);
      console.error(`错误: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('bill')
  .description('对作业记录进行计费')
  .option('-a, --all', '对所有待计费记录进行计费')
  .option('-i, --id <id>', '对指定ID的记录进行计费')
  .action(async (options) => {
    try {
      const billingService = new BillingService();
      const repository = new WorkRecordRepository();

      if (options.all) {
        const pending = repository.findAll({ status: 'pending' });
        const ids = pending.map(r => r.id!);
        const result = billingService.billRecords(ids);

        console.log(`\n计费完成: 共 ${result.total} 条记录`);
        console.log(`成功: ${result.successCount} 条, 总金额: ${result.success.reduce((sum, r) => sum + r.totalAmount, 0).toFixed(2)} 元`);
        console.log(`失败: ${result.failedCount} 条\n`);
      } else if (options.id) {
        const result = await billingService.billRecord(options.id);
        console.log('\n计费结果:');
        console.log(`  记录编号: ${result.recordNo}`);
        console.log(`  总金额: ${result.totalAmount} 元`);
        console.log(`  明细: ${JSON.stringify(result.breakdown)}`);
      } else {
        console.error('请指定 --all 或 --id 参数');
        process.exit(1);
      }
    } catch (error: any) {
      logger.error(`计费失败: ${error.message}`);
      console.error(`错误: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('review')
  .description('复核作业记录')
  .option('-a, --all', '复核所有待复核记录')
  .option('-i, --id <id>', '复核指定ID的记录')
  .option('-r, --reject', '拒绝而非通过')
  .action(async (options) => {
    try {
      const reviewService = new ReviewService();
      const approved = !options.reject;

      if (options.all) {
        const pending = reviewService.getPendingReview();
        const ids = pending.map(r => r.id!);
        const result = reviewService.reviewRecords(ids, approved);

        console.log(`\n复核${approved ? '通过' : '拒绝'}完成:`);
        console.log(`成功: ${result.successCount} 条`);
        console.log(`失败: ${result.failedCount} 条\n`);
      } else if (options.id) {
        const result = reviewService.reviewRecord(options.id, approved);
        console.log(`\n记录 ${result.recordNo} 已${approved ? '通过' : '拒绝'}复核`);
      } else {
        const pending = reviewService.getPendingReview();
        console.log(`\n待复核记录共 ${pending.length} 条:\n`);
        pending.forEach(r => {
          console.log(`  ID: ${r.id}, 编号: ${r.recordNo}, 机手: ${r.operatorName}, 日期: ${r.workDate}`);
        });
      }
    } catch (error: any) {
      logger.error(`复核失败: ${error.message}`);
      console.error(`错误: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('generate-bill')
  .description('生成账单')
  .requiredOption('-s, --start <date>', '开始日期 (YYYY-MM-DD)')
  .requiredOption('-e, --end <date>', '结束日期 (YYYY-MM-DD)')
  .option('-o, --operator <name>', '机手姓名，不指定则生成所有机手账单')
  .action(async (options) => {
    try {
      const billService = new BillService();

      if (options.operator) {
        const bill = billService.generateBill(options.operator, options.start, options.end);
        const masked = maskSensitiveData(bill);
        console.log('\n账单已生成:');
        console.log(`  账单编号: ${masked.billNo}`);
        console.log(`  机手: ${masked.operatorName}`);
        console.log(`  期间: ${masked.periodStart} 至 ${masked.periodEnd}`);
        console.log(`  记录数: ${masked.recordCount}`);
        console.log(`  总金额: ${masked.totalAmount} 元\n`);
      } else {
        const result = billService.generateBillsForAllOperators(options.start, options.end);
        console.log(`\n账单生成完成: 成功 ${result.success.length} 份，失败 ${result.failed.length} 份\n`);
        result.success.forEach(bill => {
          const masked = maskSensitiveData(bill);
          console.log(`  ${masked.billNo} - ${masked.operatorName}: ${masked.totalAmount} 元`);
        });
      }
    } catch (error: any) {
      logger.error(`生成账单失败: ${error.message}`);
      console.error(`错误: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('查询历史记录')
  .option('-s, --status <status>', '按状态过滤: pending/billed/reviewed/rejected')
  .option('-o, --operator <name>', '按机手姓名过滤')
  .option('-b, --bills', '查询账单列表')
  .action(async (options) => {
    try {
      if (options.bills) {
        const billService = new BillService();
        const bills = billService.getBills({ operatorName: options.operator, status: options.status });
        const masked = bills.map(b => maskSensitiveData(b));

        console.log(`\n账单列表 (共 ${masked.length} 份):\n`);
        masked.forEach(bill => {
          console.log(`  ${bill.billNo} - ${bill.operatorName} - ${bill.status}`);
          console.log(`    期间: ${bill.periodStart} 至 ${bill.periodEnd}`);
          console.log(`    金额: ${bill.totalAmount} 元, 记录数: ${bill.recordCount}\n`);
        });
      } else {
        const repository = new WorkRecordRepository();
        const records = repository.findAll({
          status: options.status,
          operatorName: options.operator
        });
        const masked = records.map(r => maskSensitiveData(r));

        console.log(`\n作业记录 (共 ${masked.length} 条):\n`);
        masked.forEach(r => {
          console.log(`  ${r.recordNo} - ${r.operatorName} - ${r.workDate} - ${r.status}`);
          console.log(`    拖拉机: ${r.tractorNo}, 作业类型: ${r.workType}, 计费方式: ${r.billingType}`);
          if (r.hours) console.log(`    小时数: ${r.hours}`);
          if (r.acreage) console.log(`    亩数: ${r.acreage}`);
          if (r.fuelUsed) console.log(`    油量: ${r.fuelUsed}L\n`);
        });
      }
    } catch (error: any) {
      logger.error(`查询历史失败: ${error.message}`);
      console.error(`错误: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('issue-bill')
  .description('签发账单')
  .argument('<billId>', '账单ID')
  .action(async (billId) => {
    try {
      const billService = new BillService();
      const success = billService.issueBill(billId);
      if (success) {
        console.log('账单已签发');
      } else {
        console.log('签发失败，账单不存在');
      }
    } catch (error: any) {
      logger.error(`签发账单失败: ${error.message}`);
      console.error(`错误: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('pay-bill')
  .description('标记账单已支付')
  .argument('<billId>', '账单ID')
  .action(async (billId) => {
    try {
      const billService = new BillService();
      const success = billService.markPaid(billId);
      if (success) {
        console.log('账单已标记为已支付');
      } else {
        console.log('操作失败，账单不存在');
      }
    } catch (error: any) {
      logger.error(`标记支付失败: ${error.message}`);
      console.error(`错误: ${error.message}`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
