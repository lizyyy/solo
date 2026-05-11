#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const importer = require('./core/importer');
const reconciliation = require('./core/reconciliation');
const exporter = require('./core/exporter');
const store = require('./models/store');
const presenter = require('./cli/presenter');

const program = new Command();

program
  .name('invoice-gap')
  .description('月结发票缺口 CLI - 订单、收款、发票三表核对工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化样例数据（订单、收款、发票 CSV/JSON 文件）')
  .option('-d, --dir <directory>', '输出目录', './sample-data')
  .option('--clean', '清除已有数据后再初始化')
  .action(async (options) => {
    if (options.clean) {
      store.clearAllData();
      console.log(chalk.yellow('已清除历史数据'));
    }

    const outputDir = path.resolve(options.dir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const orders = [
      { orderId: 'ORD-2026-001', customer: '华为技术有限公司', amount: 100000, orderDate: '2026-04-01', remark: '服务器采购' },
      { orderId: 'ORD-2026-002', customer: '阿里巴巴集团', amount: 50000, orderDate: '2026-04-05', remark: '云服务套餐' },
      { orderId: 'ORD-2026-003', customer: '腾讯科技', amount: 80000, orderDate: '2026-04-10', remark: '软件开发' },
      { orderId: 'ORD-2026-004', customer: '华为技术有限公司', amount: 30000, orderDate: '2026-04-15', remark: '维护服务' },
      { orderId: 'ORD-2026-005', customer: '百度在线', amount: 60000, orderDate: '2026-04-20', remark: 'AI咨询服务' },
    ];

    const payments = [
      { paymentId: 'PAY-001', orderId: 'ORD-2026-001', customer: '华为技术有限公司', amount: 100000, paymentDate: '2026-04-02' },
      { paymentId: 'PAY-002', orderId: 'ORD-2026-002', customer: '阿里巴巴集团', amount: 50000, paymentDate: '2026-04-06' },
      { paymentId: 'PAY-003', orderId: 'ORD-2026-003', customer: '腾讯科技', amount: 80000, paymentDate: '2026-04-11' },
      { paymentId: 'PAY-004', orderId: 'ORD-2026-004', customer: '华为技术有限公司', amount: 30000, paymentDate: '2026-04-16' },
      { paymentId: 'PAY-005', orderId: 'ORD-2026-005', customer: '百度在线', amount: 60000, paymentDate: '2026-04-21' },
      { paymentId: 'PAY-006', orderId: '', customer: '未知客户', amount: 5000, paymentDate: '2026-04-25', remark: '缺少订单号-测试问题' },
      { paymentId: 'PAY-007', orderId: 'ORD-2026-999', customer: '测试公司', amount: 10000, paymentDate: '2026-04-26', remark: '订单不存在-测试问题' },
    ];

    const invoices = [
      { invoiceId: 'INV-2026-001', orderId: 'ORD-2026-001', customer: '华为技术有限公司', amount: 100000, isRed: false, invoiceDate: '2026-04-03' },
      { invoiceId: 'INV-2026-002', orderId: 'ORD-2026-002', customer: '阿里巴巴集团', amount: 30000, isRed: false, invoiceDate: '2026-04-07', remark: '部分开票' },
      { invoiceId: 'INV-2026-003', orderId: 'ORD-2026-003', customer: '腾讯科技', amount: 80000, isRed: false, invoiceDate: '2026-04-12' },
      { invoiceId: 'INV-2026-004', orderId: 'ORD-2026-003', customer: '腾讯科技', amount: 80000, isRed: true, originalInvoiceId: 'INV-2026-003', invoiceDate: '2026-04-13', remark: '全额红冲' },
      { invoiceId: 'INV-2026-005', orderId: 'ORD-2026-005', customer: '百度在线', amount: 100000, isRed: false, invoiceDate: '2026-04-22', remark: '超额开票-测试问题' },
      { invoiceId: 'INV-2026-006', orderId: '', customer: '未知客户', amount: 2000, isRed: false, invoiceDate: '2026-04-27', remark: '缺少订单号-测试问题' },
      { invoiceId: 'INV-2026-007', orderId: 'ORD-2026-001', customer: '华为技术有限公司', amount: 5000, isRed: true, originalInvoiceId: 'INV-NOT-EXIST', invoiceDate: '2026-04-28', remark: '红冲无原票-测试问题' },
    ];

    const orderCsv = '订单号,客户,金额,订单日期,备注\n' + 
      orders.map(o => `${o.orderId},${o.customer},${o.amount},${o.orderDate},${o.remark}`).join('\n');
    
    const paymentCsv = '收款号,订单号,客户,金额,收款日期,备注\n' + 
      payments.map(p => `${p.paymentId},${p.orderId},${p.customer},${p.amount},${p.paymentDate},${p.remark}`).join('\n');

    const invoiceCsv = '发票号,原发票号,订单号,客户,金额,红冲,开票日期,备注\n' + 
      invoices.map(i => `${i.invoiceId},${i.originalInvoiceId || ''},${i.orderId},${i.customer},${Math.abs(i.amount)},${i.isRed ? '1' : '0'},${i.invoiceDate},${i.remark}`).join('\n');

    fs.writeFileSync(path.join(outputDir, 'orders.csv'), '\ufeff' + orderCsv, 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'payments.csv'), '\ufeff' + paymentCsv, 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'invoices.csv'), '\ufeff' + invoiceCsv, 'utf-8');

    fs.writeFileSync(path.join(outputDir, 'orders.json'), JSON.stringify(orders, null, 2), 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'payments.json'), JSON.stringify(payments, null, 2), 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'invoices.json'), JSON.stringify(invoices, null, 2), 'utf-8');

    presenter.printHeader('初始化样例数据完成');
    console.log(chalk.green(`✓ 样例数据已生成到: ${outputDir}`));
    console.log('');
    console.log('生成的文件:');
    console.log('  - orders.csv / orders.json    (订单数据，5笔)');
    console.log('  - payments.csv / payments.json (收款数据，7笔，含2笔问题数据)');
    console.log('  - invoices.csv / invoices.json (发票数据，7笔，含红冲和3笔问题数据)');
    console.log('');
    console.log('样例数据包含以下场景:');
    console.log('  ✓ 正常开票 (ORD-2026-001)');
    console.log('  ✓ 部分开票 (ORD-2026-002: 应收50000, 已开30000)');
    console.log('  ✓ 全额红冲 (ORD-2026-003: 开票后红冲)');
    console.log('  ✓ 未开票 (ORD-2026-004)');
    console.log('  ✗ 超额开票问题 (ORD-2026-005)');
    console.log('  ✗ 收款缺少订单号问题');
    console.log('  ✗ 发票缺少订单号问题');
    console.log('  ✗ 红冲找不到原票问题');
    console.log('');
    console.log(chalk.cyan('下一步: invoice-gap import ./sample-data/*.csv'));
    console.log('');
  });

program
  .command('import <files...>')
  .description('导入 CSV 或 JSON 数据文件')
  .option('-t, --type <type>', '指定数据类型: order|payment|invoice（不指定则自动识别）')
  .option('--force', '强制重新导入已导入过的文件')
  .action(async (files, options) => {
    for (const filePattern of files) {
      const dir = path.dirname(path.resolve(filePattern));
      const base = path.basename(filePattern);
      
      let matchedFiles;
      if (base.includes('*')) {
        matchedFiles = fs.readdirSync(dir)
          .filter(f => {
            const regex = new RegExp('^' + base.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
            return regex.test(f);
          })
          .map(f => path.join(dir, f));
      } else {
        matchedFiles = [path.resolve(filePattern)];
      }

      for (const filePath of matchedFiles) {
        if (!fs.existsSync(filePath)) {
          console.log(chalk.red(`✗ 文件不存在: ${filePath}`));
          continue;
        }

        if (options.force && store.isFileAlreadyImported(filePath)) {
          const data = store.loadData();
          const absPath = path.resolve(filePath);
          data.importedFiles = data.importedFiles.filter(f => path.resolve(f) !== absPath);
          store.saveData(data);
        }

        console.log(chalk.gray(`导入中: ${path.basename(filePath)}`));
        const result = await importer.importFile(filePath, options.type);
        presenter.printImportResult(result);
      }
    }
    console.log('');
  });

program
  .command('check')
  .description('检查数据问题并显示汇总')
  .option('--issues-only', '只显示问题清单')
  .option('--customers', '显示客户列表')
  .action((options) => {
    const summary = reconciliation.getSummary();
    const notes = reconciliation.getNotes();

    if (!options.issuesOnly) {
      presenter.printSummary(summary);
    }

    if (options.customers && !options.issuesOnly) {
      presenter.printCustomerList(summary.customers);
    }

    if (summary.issues.length > 0 || options.issuesOnly) {
      presenter.printIssues(summary.issues, notes);
    }
  });

program
  .command('customer <name>')
  .description('查看指定客户的详细数据')
  .action((name) => {
    const detail = reconciliation.getCustomerDetail(name);
    presenter.printCustomerDetail(detail);
  });

program
  .command('note <key> <text...>')
  .description('为问题添加人工说明')
  .action((key, textParts) => {
    const text = textParts.join(' ');
    const note = reconciliation.addNote(key, text);
    console.log(chalk.green('✓ 已添加人工说明'));
    console.log(`  问题标识: ${key}`);
    console.log(`  说明内容: ${text}`);
    console.log(`  记录时间: ${new Date(note.createdAt).toLocaleString()}`);
    console.log('');
  });

program
  .command('export [outputDir]')
  .description('导出月结报告')
  .option('-f, --format <format>', '导出格式: all|csv|json', 'all')
  .action((outputDir = './reports', options) => {
    const results = exporter.exportReport(path.resolve(outputDir), options.format);
    presenter.printExportResults(results);

    const summary = reconciliation.getSummary();
    presenter.printSummary(summary);
  });

program
  .command('reset')
  .description('清除所有已导入的数据')
  .action(() => {
    store.clearAllData();
    console.log(chalk.green('✓ 已清除所有数据'));
    console.log('');
  });

program
  .command('demo')
  .description('运行完整演示链路 (init -> import -> check -> customer -> note -> export)')
  .action(async () => {
    console.log(chalk.bold.cyan('\n' + '='.repeat(60)));
    console.log(chalk.bold.cyan('  月结发票缺口 CLI - 完整演示链路'));
    console.log(chalk.bold.cyan('='.repeat(60)) + '\n');

    console.log(chalk.bold.yellow('\n【第1步】清除历史数据并初始化样例数据'));
    console.log(chalk.gray('命令: invoice-gap init --clean'));
    console.log('---');
    store.clearAllData();
    
    const sampleDir = path.resolve('./sample-data');
    if (fs.existsSync(sampleDir)) {
      fs.rmSync(sampleDir, { recursive: true, force: true });
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const orders = [
      { orderId: 'ORD-2026-001', customer: '华为技术有限公司', amount: 100000, orderDate: '2026-04-01', remark: '服务器采购' },
      { orderId: 'ORD-2026-002', customer: '阿里巴巴集团', amount: 50000, orderDate: '2026-04-05', remark: '云服务套餐' },
      { orderId: 'ORD-2026-003', customer: '腾讯科技', amount: 80000, orderDate: '2026-04-10', remark: '软件开发' },
      { orderId: 'ORD-2026-004', customer: '华为技术有限公司', amount: 30000, orderDate: '2026-04-15', remark: '维护服务' },
      { orderId: 'ORD-2026-005', customer: '百度在线', amount: 60000, orderDate: '2026-04-20', remark: 'AI咨询服务' },
    ];
    const payments = [
      { paymentId: 'PAY-001', orderId: 'ORD-2026-001', customer: '华为技术有限公司', amount: 100000, paymentDate: '2026-04-02' },
      { paymentId: 'PAY-002', orderId: 'ORD-2026-002', customer: '阿里巴巴集团', amount: 50000, paymentDate: '2026-04-06' },
      { paymentId: 'PAY-003', orderId: 'ORD-2026-003', customer: '腾讯科技', amount: 80000, paymentDate: '2026-04-11' },
      { paymentId: 'PAY-004', orderId: 'ORD-2026-004', customer: '华为技术有限公司', amount: 30000, paymentDate: '2026-04-16' },
      { paymentId: 'PAY-005', orderId: 'ORD-2026-005', customer: '百度在线', amount: 60000, paymentDate: '2026-04-21' },
      { paymentId: 'PAY-006', orderId: '', customer: '未知客户', amount: 5000, paymentDate: '2026-04-25', remark: '缺少订单号-测试问题' },
    ];
    const invoices = [
      { invoiceId: 'INV-2026-001', orderId: 'ORD-2026-001', customer: '华为技术有限公司', amount: 100000, isRed: false, invoiceDate: '2026-04-03' },
      { invoiceId: 'INV-2026-002', orderId: 'ORD-2026-002', customer: '阿里巴巴集团', amount: 30000, isRed: false, invoiceDate: '2026-04-07', remark: '部分开票' },
      { invoiceId: 'INV-2026-003', orderId: 'ORD-2026-003', customer: '腾讯科技', amount: 80000, isRed: false, invoiceDate: '2026-04-12' },
      { invoiceId: 'INV-2026-004', orderId: 'ORD-2026-003', customer: '腾讯科技', amount: 80000, isRed: true, originalInvoiceId: 'INV-2026-003', invoiceDate: '2026-04-13', remark: '全额红冲' },
      { invoiceId: 'INV-2026-005', orderId: 'ORD-2026-005', customer: '百度在线', amount: 100000, isRed: false, invoiceDate: '2026-04-22', remark: '超额开票-测试问题' },
      { invoiceId: 'INV-2026-006', orderId: '', customer: '未知客户', amount: 2000, isRed: false, invoiceDate: '2026-04-27', remark: '缺少订单号-测试问题' },
    ];

    fs.mkdirSync(sampleDir, { recursive: true });
    fs.writeFileSync(path.join(sampleDir, 'orders.json'), JSON.stringify(orders, null, 2), 'utf-8');
    fs.writeFileSync(path.join(sampleDir, 'payments.json'), JSON.stringify(payments, null, 2), 'utf-8');
    fs.writeFileSync(path.join(sampleDir, 'invoices.json'), JSON.stringify(invoices, null, 2), 'utf-8');
    console.log(chalk.green('✓ 样例数据已生成'));

    console.log(chalk.bold.yellow('\n【第2步】导入数据文件'));
    console.log(chalk.gray('命令: invoice-gap import ./sample-data/*.json'));
    console.log('---');
    
    const dataFiles = [
      path.join(sampleDir, 'orders.json'),
      path.join(sampleDir, 'payments.json'),
      path.join(sampleDir, 'invoices.json')
    ];
    
    for (const f of dataFiles) {
      const result = await importer.importFile(f);
      presenter.printImportResult(result);
    }

    console.log(chalk.bold.yellow('\n【第3步】检查数据，查看汇总和问题'));
    console.log(chalk.gray('命令: invoice-gap check --customers'));
    console.log('---');
    const summary = reconciliation.getSummary();
    presenter.printSummary(summary);
    presenter.printCustomerList(summary.customers);
    presenter.printIssues(summary.issues, {});

    console.log(chalk.bold.yellow('\n【第4步】查看客户详情'));
    console.log(chalk.gray('命令: invoice-gap customer "华为"'));
    console.log('---');
    const hwDetail = reconciliation.getCustomerDetail('华为');
    presenter.printCustomerDetail(hwDetail);

    console.log(chalk.bold.yellow('\n【第5步】查看有问题的客户详情'));
    console.log(chalk.gray('命令: invoice-gap customer "腾讯"'));
    console.log('---');
    const txDetail = reconciliation.getCustomerDetail('腾讯');
    presenter.printCustomerDetail(txDetail);

    console.log(chalk.bold.yellow('\n【第6步】为问题添加人工说明'));
    console.log(chalk.gray('命令: invoice-gap note "invoice-exceeds-ORD-2026-005" "预开发票，下月收款后核销"'));
    console.log('---');
    const note = reconciliation.addNote('invoice-exceeds-ORD-2026-005', '预开发票，下月收款后核销');
    console.log(chalk.green('✓ 已添加人工说明'));
    console.log(`  问题标识: invoice-exceeds-ORD-2026-005`);
    console.log(`  说明内容: 预开发票，下月收款后核销`);

    console.log(chalk.bold.yellow('\n【第7步】导出月结报告'));
    console.log(chalk.gray('命令: invoice-gap export ./reports'));
    console.log('---');
    const reportDir = path.resolve('./reports');
    if (fs.existsSync(reportDir)) {
      fs.rmSync(reportDir, { recursive: true, force: true });
    }
    const exportResults = exporter.exportReport(reportDir, 'all');
    presenter.printExportResults(exportResults);

    console.log(chalk.bold.green('\n' + '='.repeat(60)));
    console.log(chalk.bold.green('  演示完成！'));
    console.log(chalk.bold.green('='.repeat(60)));
    console.log('');
    console.log('你可以手动执行以下命令来复现这个演示:');
    console.log('');
    console.log('  1. ' + chalk.cyan('invoice-gap init --clean'));
    console.log('  2. ' + chalk.cyan('invoice-gap import ./sample-data/orders.json'));
    console.log('     ' + chalk.cyan('invoice-gap import ./sample-data/payments.json'));
    console.log('     ' + chalk.cyan('invoice-gap import ./sample-data/invoices.json'));
    console.log('  3. ' + chalk.cyan('invoice-gap check --customers'));
    console.log('  4. ' + chalk.cyan('invoice-gap customer "华为"'));
    console.log('  5. ' + chalk.cyan('invoice-gap customer "腾讯"'));
    console.log('  6. ' + chalk.cyan('invoice-gap note "invoice-exceeds-ORD-2026-005" "预开发票"'));
    console.log('  7. ' + chalk.cyan('invoice-gap export ./reports'));
    console.log('');
    console.log('或者，再次运行: ' + chalk.cyan('invoice-gap demo'));
    console.log('');
  });

program.parse(process.argv);
