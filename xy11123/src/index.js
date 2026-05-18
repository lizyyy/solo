const { program } = require('commander');
const LedgerProcessor = require('./processor');
const ReportGenerator = require('./report');
const { version } = require('../package.json');

program
  .name('nongzi-ledger')
  .description('农资门店农资实名台账 CLI - 处理重复记录、身份证尾号缺失、退货记录')
  .version(version)
  .argument('<inputFile>', '输入CSV文件路径')
  .option('-o, --output <path>', '输出文件路径', 'output/ledger-cleaned.csv')
  .option('-r, --report <path>', '报告文件路径', 'output/ledger-report.md')
  .option('-v, --verbose', '详细模式：显示每条记录处理日志')
  .option('-k, --keep-all', '保留所有记录，不合并重复修改')
  .action(async (inputFile, options) => {
    const processor = new LedgerProcessor({
      verbose: options.verbose,
      keepAll: options.keepAll
    });

    try {
      await processor.load(inputFile);
      processor.process();
      
      await processor.saveOutput(options.output);
      
      const reportGenerator = new ReportGenerator(processor);
      await reportGenerator.generate(options.report);
      
      if (options.verbose) {
        console.log('\n处理完成！');
        console.log(`输出文件: ${options.output}`);
        console.log(`报告文件: ${options.report}`);
      }
    } catch (error) {
      console.error('处理出错:', error.message);
      process.exit(1);
    }
  });

program.parse();