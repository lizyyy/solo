#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const path = require('path');

const { initDatabase, getDb } = require('./lib/database');
const { importContracts, importReceipts, importInvoices, normalizeDate } = require('./lib/importer');
const { analyzeAllContracts, analyzeContract, getSummary, markFollowedUp, setPromiseDate, getCollectionHistory } = require('./lib/analyzer');
const { exportCollectionReport } = require('./lib/reporter');

initDatabase();

const program = new Command();

program
  .name('invoice')
  .description('小微企业发票催收 CLI 工具')
  .version('1.0.0');

program
  .command('import-contracts <file>')
  .description('导入合同清单')
  .action((file) => {
    try {
      const result = importContracts(path.resolve(file));
      console.log(chalk.green('✓ 合同导入完成'));
      console.log(`  总计: ${result.total} 条`);
      console.log(`  新增: ${result.inserted} 条`);
      console.log(`  更新: ${result.updated} 条`);
      console.log(`  跳过: ${result.skipped} 条`);
    } catch (err) {
      console.error(chalk.red('✗ 导入失败:'), err.message);
      process.exit(1);
    }
  });

program
  .command('import-receipts <file>')
  .description('导入回款流水')
  .action((file) => {
    try {
      const result = importReceipts(path.resolve(file));
      console.log(chalk.green('✓ 回款流水导入完成'));
      console.log(`  总计: ${result.total} 条`);
      console.log(`  新增: ${result.inserted} 条`);
      console.log(`  重复(跳过): ${result.duplicates} 条`);
      console.log(`  冲销记录: ${result.negatives} 条`);
      console.log(`  跳过: ${result.skipped} 条`);
    } catch (err) {
      console.error(chalk.red('✗ 导入失败:'), err.message);
      process.exit(1);
    }
  });

program
  .command('import-invoices <file>')
  .description('导入已开发票清单')
  .action((file) => {
    try {
      const result = importInvoices(path.resolve(file));
      console.log(chalk.green('✓ 发票清单导入完成'));
      console.log(`  总计: ${result.total} 条`);
      console.log(`  新增: ${result.inserted} 条`);
      console.log(`  重复(跳过): ${result.duplicates} 条`);
      console.log(`  跳过: ${result.skipped} 条`);
    } catch (err) {
      console.error(chalk.red('✗ 导入失败:'), err.message);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('检查所有合同的发票情况')
  .option('-c, --customer <name>', '按客户名称筛选')
  .option('-n, --contract-no <no>', '按合同编号筛选')
  .option('-p, --project <name>', '按项目名称筛选')
  .option('-s, --filter-status <status>', '按状态筛选: all|no_invoice|partial_invoice|fully_invoiced|title_mismatch')
  .option('--need-collection', '只显示需要催收的')
  .action((options) => {
    try {
      const analyses = analyzeAllContracts(options);
      const summary = getSummary();

      if (analyses.length === 0) {
        console.log(chalk.yellow('未找到符合条件的记录'));
        return;
      }

      const table = new Table({
        head: [
          '合同编号',
          '客户名称',
          '项目',
          '合同金额',
          '收款净额',
          '已开票',
          '待开票',
          '状态',
          '催收状态'
        ],
        colWidths: [15, 20, 15, 12, 12, 12, 12, 14, 14]
      });

      let needInvoiceTotal = 0;

      for (const a of analyses) {
        let statusColor = chalk.white(a.statusText);
        if (a.status === 'no_invoice' || a.status === 'partial_invoice') {
          statusColor = chalk.red.bold(a.statusText);
        } else if (a.status === 'title_mismatch') {
          statusColor = chalk.yellow(a.statusText);
        } else if (a.status === 'fully_invoiced') {
          statusColor = chalk.green(a.statusText);
        }

        let collectionStatus = chalk.yellow('未催');
        if (a.collectionRecord?.is_followed_up) {
          collectionStatus = chalk.green('已催');
          if (a.collectionRecord.promise_date) {
            collectionStatus += chalk.gray(` (${a.collectionRecord.promise_date})`);
          }
        }

        table.push([
          a.contract.contract_no,
          a.contract.customer_name.substring(0, 18),
          (a.contract.project_name || '').substring(0, 14),
          `¥${a.contract.contract_amount.toFixed(2)}`,
          `¥${a.netReceipt.toFixed(2)}`,
          `¥${a.invoiceTotal.toFixed(2)}`,
          chalk.red(`¥${a.needInvoice.toFixed(2)}`),
          statusColor,
          collectionStatus
        ]);

        needInvoiceTotal += a.needInvoice;
      }

      console.log(chalk.bold('\n【发票检查结果】\n'));
      console.log(table.toString());

      console.log('\n' + chalk.bold('\n【汇总】'));
      console.log(`  检查合同数: ${analyses.length} 份`);
      console.log(`  合同总金额: ¥${summary.totalContractAmount.toFixed(2)}`);
      console.log(`  累计收款净额: ¥${summary.totalNetReceipt.toFixed(2)}`);
      console.log(`  累计已开票: ¥${summary.totalInvoiced.toFixed(2)}`);
      console.log(`  待开票总额: ¥${needInvoiceTotal.toFixed(2)}`);

      console.log('\n' + chalk.bold('\n【需要催收】'));
      console.log(`  待催收客户数: ${summary.needCollectionCount} 份`);
      console.log(`  待催收金额: ¥${summary.needCollectionAmount.toFixed(2)}`);
      console.log(`  已催: ${summary.followedUpCount} 份 | 未催: ${summary.notFollowedUpCount} 份`);
      console.log(`  有承诺日期: ${summary.withPromiseCount} 份`);
    } catch (err) {
      console.error(chalk.red('✗ 检查失败:'), err.message);
      process.exit(1);
    }
  });

program
  .command('customer <name>')
  .description('按客户查看详细信息')
  .action((name) => {
    try {
      const analyses = analyzeAllContracts({ customer: name });

      if (analyses.length === 0) {
        console.log(chalk.yellow('未找到该客户的合同记录'));
        return;
      }

      for (const a of analyses) {
        console.log(chalk.bold(`\n╔═══════════════════════════════════════════════════════════`));
        console.log(chalk.bold(`║ 合同信息`));
        console.log(chalk.bold(`╚═══════════════════════════════════════════════════════════`));

        console.log(`  合同编号: ${a.contract.contract_no}`);
        console.log(`  客户名称: ${a.contract.customer_name}`);
        console.log(`  项目名称: ${a.contract.project_name || '-'}`);
        console.log(`  合同金额: ¥${a.contract.contract_amount.toFixed(2)}`);
        console.log(`  合同日期: ${a.contract.contract_date || '-'}`);
        console.log(`  税号: ${a.contract.customer_tax_id || '-'}`);

        console.log(`\n` + chalk.bold(`收款记录 (净收款: ¥${a.netReceipt.toFixed(2)})`));
        if (a.receipts.length === 0) {
          console.log(`  暂无收款记录`);
        } else {
          const recTable = new Table({
            head: ['日期', '金额', '银行', '用途'],
            colWidths: [12, 12, 15, 20]
          });
          a.receipts.forEach(r => {
            recTable.push([r.receipt_date, `¥${r.amount.toFixed(2)}`, r.bank_name || '-', r.purpose || '-']);
          });
          console.log(recTable.toString());
        }

        if (a.negativeReceipts.length > 0) {
          console.log(chalk.yellow(`\n  冲销记录:`));
          a.negativeReceipts.forEach(r => {
            console.log(`    ${r.receipt_date}: -¥${r.amount.toFixed(2)} ${r.purpose || ''}`);
          });
        }

        console.log(`\n` + chalk.bold(`开票记录 (已开票: ¥${a.invoiceTotal.toFixed(2)})`));
        if (a.invoices.length === 0) {
          console.log(`  暂无开票记录`);
        } else {
          const invTable = new Table({
            head: ['发票号', '日期', '金额', '抬头'],
            colWidths: [15, 12, 12, 25]
          });
          a.invoices.forEach(i => {
            const isMismatch = i.customer_name !== a.contract.customer_name;
            invTable.push([
              i.invoice_no.substring(0, 13),
              i.invoice_date,
              `¥${i.total_amount.toFixed(2)}`,
              isMismatch ? chalk.red(i.customer_name) : i.customer_name
            ]);
          });
          console.log(invTable.toString());
        }

        console.log(`\n` + chalk.bold(`问题与建议`));
        if (a.issues.length === 0) {
          console.log(chalk.green(`  ✓ 发票开具完整`));
        } else {
          a.issues.forEach((issue, idx) => {
            console.log(chalk.red(`  ${idx + 1}. ${issue.message}`));
          });
        }

        if (a.collectionRecord) {
          console.log(`\n` + chalk.bold(`催收记录`));
          const history = getCollectionHistory(a.contract.id);
          history.forEach((h, idx) => {
            console.log(`  ${idx + 1}. ${h.follow_up_date} - ${h.is_followed_up ? '已催' : '未催'}${h.promise_date ? ` | 承诺: ${h.promise_date}` : ''}${h.follow_up_remark ? ` | ${h.follow_up_remark}` : ''}`);
          });
        }

        console.log('');
      }
    } catch (err) {
      console.error(chalk.red('✗ 查询失败:'), err.message);
      process.exit(1);
    }
  });

program
  .command('mark-follow-up')
  .description('标记已催收')
  .requiredOption('-c, --contract-id <id>', '合同ID或合同编号')
  .option('-r, --remark <text>', '催收备注')
  .action((options) => {
    try {
      const db = getDb();
      let contract = db.prepare('SELECT * FROM contracts WHERE id = ? OR contract_no = ?').get(options.contractId, options.contractId);

      if (!contract) {
        console.error(chalk.red('✗ 未找到该合同'));
        process.exit(1);
      }

      markFollowedUp(contract.id, options.remark || '');

      console.log(chalk.green(`✓ 已标记合同 ${contract.contract_no} 为已催收`));
      if (options.remark) {
        console.log(`  备注: ${options.remark}`);
      }

      const summary = getSummary();
      console.log(chalk.gray(`\n  当前统计: 待催收 ${summary.needCollectionCount} 份, 已催 ${summary.followedUpCount} 份, 未催 ${summary.notFollowedUpCount} 份`));
    } catch (err) {
      console.error(chalk.red('✗ 标记失败:'), err.message);
      process.exit(1);
    }
  });

program
  .command('set-promise')
  .description('记录承诺开票日期')
  .requiredOption('-c, --contract-id <id>', '合同ID或合同编号')
  .requiredOption('-d, --date <date>', '承诺日期 (YYYY-MM-DD)')
  .option('-r, --remark <text>', '备注')
  .action((options) => {
    try {
      const normalizedDate = normalizeDate(options.date);
      if (!normalizedDate) {
        console.error(chalk.red('✗ 日期格式无效，请使用 YYYY-MM-DD 格式'));
        process.exit(1);
      }

      const db = getDb();
      let contract = db.prepare('SELECT * FROM contracts WHERE id = ? OR contract_no = ?').get(options.contractId, options.contractId);

      if (!contract) {
        console.error(chalk.red('✗ 未找到该合同'));
        process.exit(1);
      }

      setPromiseDate(contract.id, normalizedDate, options.remark || '');

      console.log(chalk.green(`✓ 已记录合同 ${contract.contract_no} 的承诺日期`));
      console.log(`  承诺日期: ${normalizedDate}`);
      if (options.remark) {
        console.log(`  备注: ${options.remark}`);
      }

      const summary = getSummary();
      console.log(chalk.gray(`\n  当前统计: 待催收 ${summary.needCollectionCount} 份, 有承诺 ${summary.withPromiseCount} 份`));
    } catch (err) {
      console.error(chalk.red('✗ 记录失败:'), err.message);
      process.exit(1);
    }
  });

program
  .command('export <output>')
  .description('导出财务报告')
  .option('-c, --customer <name>', '按客户筛选')
  .option('--need-collection', '只导出需要催收的')
  .action((output, options) => {
    try {
      const outputPath = path.resolve(output);
      exportCollectionReport(outputPath, options);
      console.log(chalk.green(`✓ 报告已导出至: ${outputPath}`));

      const summary = getSummary();
      console.log(`\n` + chalk.bold('报告内容:'));
      console.log(`  - 汇总表`);
      console.log(`  - 催收清单 (${summary.needCollectionCount} 份)`);
      console.log(`  - 问题明细`);
      console.log(`  - 收款明细`);
      console.log(`  - 发票明细`);
    } catch (err) {
      console.error(chalk.red('✗ 导出失败:'), err.message);
      process.exit(1);
    }
  });

program
  .command('summary')
  .description('显示汇总统计')
  .action(() => {
    try {
      const summary = getSummary();

      console.log(chalk.bold('\n【总体统计】\n'));
      console.log(`  合同总数: ${summary.totalContracts} 份`);
      console.log(`  合同总金额: ¥${summary.totalContractAmount.toFixed(2)}`);
      console.log(`  累计收款净额: ¥${summary.totalNetReceipt.toFixed(2)}`);
      console.log(`  累计已开票: ¥${summary.totalInvoiced.toFixed(2)}`);
      console.log(`  累计待开票: ¥${summary.totalNeedInvoice.toFixed(2)}`);

      console.log(chalk.bold('\n【发票状态分布】\n'));
      console.log(`  ${chalk.green('已全额开票')}: ${summary.fullyInvoicedCount} 份, 金额 ¥${summary.fullyInvoicedAmount.toFixed(2)}`);
      console.log(`  ${chalk.red('已收款未开票')}: ${summary.noInvoiceCount} 份, 金额 ¥${summary.noInvoiceAmount.toFixed(2)}`);
      console.log(`  ${chalk.yellow('已收款开票不足')}: ${summary.partialInvoiceCount} 份, 金额 ¥${summary.partialInvoiceAmount.toFixed(2)}`);
      console.log(`  ${chalk.magenta('发票抬头异常')}: ${summary.titleMismatchCount} 份`);

      console.log(chalk.bold('\n【催收状态】\n'));
      console.log(`  待催收客户数: ${summary.needCollectionCount} 份`);
      console.log(`  待催收金额: ¥${summary.needCollectionAmount.toFixed(2)}`);
      console.log(`  已标记催收: ${summary.followedUpCount} 份`);
      console.log(`  未标记催收: ${summary.notFollowedUpCount} 份`);
      console.log(`  有承诺开票日期: ${summary.withPromiseCount} 份`);
      console.log('');
    } catch (err) {
      console.error(chalk.red('✗ 获取统计失败:'), err.message);
      process.exit(1);
    }
  });

program
  .command('list-contracts')
  .description('列出所有合同')
  .option('-c, --customer <name>', '按客户筛选')
  .option('-s, --status <status>', '按状态筛选')
  .action((options) => {
    try {
      const db = getDb();
      let sql = 'SELECT * FROM contracts WHERE 1=1';
      const params = [];

      if (options.customer) {
        sql += ' AND customer_name LIKE ?';
        params.push(`%${options.customer}%`);
      }
      if (options.status) {
        sql += ' AND status = ?';
        params.push(options.status);
      }
      sql += ' ORDER BY contract_date DESC';

      const contracts = db.prepare(sql).all(...params);

      if (contracts.length === 0) {
        console.log(chalk.yellow('暂无合同记录'));
        return;
      }

      const table = new Table({
        head: ['ID', '合同编号', '客户名称', '项目', '合同金额', '合同日期', '状态'],
        colWidths: [5, 18, 25, 15, 12, 12, 10]
      });

      contracts.forEach(c => {
        table.push([
          c.id,
          c.contract_no,
          c.customer_name.substring(0, 23),
          (c.project_name || '-').substring(0, 14),
          `¥${c.contract_amount.toFixed(2)}`,
          c.contract_date || '-',
          c.status
        ]);
      });

      console.log(table.toString());
      console.log(`\n共 ${contracts.length} 份合同`);
    } catch (err) {
      console.error(chalk.red('✗ 查询失败:'), err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
