#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const chalk = require('chalk');

const FileReader = require('../src/file-reader');
const RentalSettlementCalculator = require('../src/calculator');
const ReportGenerator = require('../src/report-generator');

const program = new Command();

program
  .name('rental-settle')
  .description('摄影器材租赁店相机租金结算CLI工具')
  .version('1.0.0');

program
  .command('calculate')
  .description('计算租金结算')
  .argument('<file>', '租赁订单数据文件 (CSV/JSON)')
  .option('-o, --output <directory>', '结果输出目录', './output')
  .option('--no-export', '不导出CSV文件，仅在控制台显示')
  .action(async (file, options) => {
    try {
      const inputFile = path.resolve(file);
      const outputDir = path.resolve(options.output);

      console.log(chalk.blue('正在读取数据文件...'));
      const records = await FileReader.readFile(inputFile);
      console.log(chalk.green(`✓ 成功读取 ${records.length} 条记录`));

      console.log(chalk.blue('正在计算租金结算...'));
      const calculator = new RentalSettlementCalculator();
      const result = calculator.calculateSettlement(records, inputFile);

      const baseName = path.basename(file, path.extname(file));
      ReportGenerator.printConsoleReport(result, inputFile);

      if (options.export) {
        await ReportGenerator.exportResults(result, outputDir, baseName);
      }

      process.exit(result.exceptions.length > 0 ? 1 : 0);
    } catch (error) {
      console.error(chalk.red('\n✗ 处理失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('template')
  .description('生成CSV数据模板')
  .argument('[output]', '输出文件路径', './rental-template.csv')
  .action(async (output) => {
    const createCsvWriter = require('csv-writer').createObjectCsvWriter;
    const csvWriter = createCsvWriter({
      path: output,
      header: [
        { id: 'orderId', title: 'orderId' },
        { id: 'customerName', title: 'customerName' },
        { id: 'cameraModel', title: 'cameraModel' },
        { id: 'lensModel', title: 'lensModel' },
        { id: 'filterIncluded', title: 'filterIncluded' },
        { id: 'rentalStartDate', title: 'rentalStartDate' },
        { id: 'rentalEndDate', title: 'rentalEndDate' },
        { id: 'dailyRate', title: 'dailyRate' },
        { id: 'depositAmount', title: 'depositAmount' },
        { id: 'actualReturnDate', title: 'actualReturnDate' },
        { id: 'itemsReturned', title: 'itemsReturned' },
        { id: 'damageReported', title: 'damageReported' },
        { id: 'notes', title: 'notes' }
      ]
    });

    const exampleRecords = [
      {
        orderId: 'RENT2024001',
        customerName: '张三',
        cameraModel: 'Sony A7M4',
        lensModel: 'Sony 24-70mm F2.8 GM II',
        filterIncluded: '是',
        rentalStartDate: '2024-05-01',
        rentalEndDate: '2024-05-03',
        dailyRate: '299',
        depositAmount: '5000',
        actualReturnDate: '2024-05-04',
        itemsReturned: '相机,镜头',
        damageReported: '否',
        notes: '客户婚礼拍摄'
      },
      {
        orderId: 'RENT2024002',
        customerName: '李四',
        cameraModel: 'Canon R5',
        lensModel: 'Canon RF 70-200mm F2.8',
        filterIncluded: '是',
        rentalStartDate: '2024-05-10',
        rentalEndDate: '2024-05-15',
        dailyRate: '399',
        depositAmount: '8000',
        actualReturnDate: '2024-05-15',
        itemsReturned: '相机',
        damageReported: '否',
        notes: '分批归还，镜头后续归还'
      }
    ];

    await csvWriter.writeRecords(exampleRecords);
    console.log(chalk.green(`✓ 模板已生成: ${output}`));
    console.log(chalk.gray('请按照模板格式填写真实业务数据后使用 calculate 命令计算'));
  });

program
  .command('fields')
  .description('显示字段说明')
  .action(() => {
    console.log('\n' + chalk.bold.blue('摄影器材租赁店租金结算 - 字段说明'));
    console.log(chalk.bold.blue('='.repeat(50)));
    console.log(`
${chalk.bold('必填字段:')}
  orderId          - 订单编号（唯一标识）
  customerName     - 客户姓名
  cameraModel      - 相机型号
  rentalStartDate  - 租用开始日期 (YYYY-MM-DD)
  rentalEndDate    - 租用结束日期 (YYYY-MM-DD)
  dailyRate        - 日租金（元/天）
  depositAmount    - 押金金额（元）

${chalk.bold('可选字段:')}
  lensModel        - 镜头型号
  filterIncluded   - 是否包含滤镜（是/否）
  actualReturnDate - 实际归还日期 (YYYY-MM-DD)
  itemsReturned    - 已归还物品（逗号分隔）
  damageReported   - 是否有损坏（是/否）
  notes            - 备注信息

${chalk.bold('业务逻辑:')}
  • 逾期归还按日租金1.5倍计算逾期费
  • 相机丢失赔偿5000元，镜头丢失赔偿2000元
  • 滤镜丢失赔偿200元
  • 物品损坏赔偿500元
  • 支持分批归还检测
  • 自动检测滤镜丢失并计算赔偿
`);
  });

program.parse(process.argv);
