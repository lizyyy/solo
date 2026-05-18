#!/usr/bin/env node

const yargs = require('yargs');
const chalk = require('chalk');
const Table = require('cli-table3');
const path = require('path');
const fs = require('fs');
const BucketValidator = require('./bucketValidator');

const logo = `
╔═══════════════════════════════════════════════════════════╗
║                    水站配送队水桶流转追踪                   ║
║                Water Station Bucket Tracker               ║
╚═══════════════════════════════════════════════════════════╝
`;

console.log(chalk.cyan(logo));

yargs
  .command({
    command: 'validate',
    describe: '验证水桶流转数据文件',
    builder: {
      input: {
        alias: 'i',
        describe: '输入CSV文件路径',
        demandOption: true,
        type: 'string'
      },
      config: {
        alias: 'c',
        describe: '规则配置文件路径（可选，默认使用rules/default.json）',
        type: 'string'
      },
      output: {
        alias: 'o',
        describe: '输出目录路径（可选，默认使用output目录）',
        type: 'string'
      }
    },
    async handler(argv) {
      try {
        const inputPath = path.resolve(argv.input);
        const outputDir = path.resolve(argv.output || 'output');
        
        if (!fs.existsSync(inputPath)) {
          console.log(chalk.red(`✗ 输入文件不存在: ${inputPath}`));
          process.exit(1);
        }
        
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log(chalk.blue(`📂 输入文件: ${path.basename(inputPath)}`));
        console.log(chalk.blue(`📂 输出目录: ${outputDir}`));
        console.log('');

        const validator = new BucketValidator(argv.config);
        console.log(chalk.green('✓ 规则配置加载成功'));
        console.log('');

        console.log(chalk.yellow('🔍 正在验证数据...'));
        const result = await validator.validateFile(inputPath);
        console.log(chalk.green('✓ 数据验证完成'));
        console.log('');

        const stats = validator.getStatistics();
        
        const summaryTable = new Table({
          head: [
            chalk.cyan('统计项'),
            chalk.cyan('数量'),
            chalk.cyan('占比')
          ],
          colWidths: [20, 10, 15]
        });

        summaryTable.push(
          ['总记录数', stats.totalRecords, '100%'],
          [
            '有效记录', 
            chalk.green(stats.validRecords), 
            chalk.green(`${((stats.validRecords / stats.totalRecords) * 100).toFixed(1)}%`)
          ],
          [
            '异常记录', 
            chalk.red(stats.exceptionRecords),
            chalk.red(`${((stats.exceptionRecords / stats.totalRecords) * 100).toFixed(1)}%`)
          ]
        );

        console.log(chalk.bold('📊 验证汇总'));
        console.log(summaryTable.toString());
        console.log('');

        if (stats.exceptionRecords > 0) {
          console.log(chalk.bold('⚠️  异常类型统计'));
          const exceptionTable = new Table({
            head: [
              chalk.yellow('异常类型'),
              chalk.yellow('数量'),
              chalk.yellow('说明')
            ],
            colWidths: [30, 10, 40]
          });

          const exceptionDescriptions = {
            'DUPLICATE_BUCKET_SAME_DAY': '同一水站同一天桶号重复',
            'DUPLICATE_IN_TRANSIT': '桶号重复标记为配送中',
            'DRIVER_SUPPLEMENT_WITHOUT_ID': '司机补录缺少司机ID',
            'SUPPLEMENT_EXCEED_TIME': '补录时间超出规定时限',
            'INVALID_SUPPLEMENT_REASON': '补录原因不合法',
            'INVALID_FORMAT': '桶号格式错误',
            'MISSING_BUCKET_NUMBER': '桶号为空',
            'INVALID_STATUS_TRANSITION': '状态流转不合法'
          };

          stats.topExceptions.forEach(ex => {
            exceptionTable.push([
              ex.type,
              ex.count,
              exceptionDescriptions[ex.type] || ex.type
            ]);
          });

          console.log(exceptionTable.toString());
          console.log('');
        }

        const timestamp = new Date().toISOString().slice(0, 10);
        const baseName = path.basename(inputPath, '.csv');

        const exceptionReportPath = path.join(outputDir, `${baseName}_异常报告_${timestamp}.csv`);
        const validRecordsPath = path.join(outputDir, `${baseName}_清洗结果_${timestamp}.csv`);

        await validator.generateExceptionReport(exceptionReportPath);
        await validator.generateValidRecords(validRecordsPath);

        console.log(chalk.bold('📁 输出文件'));
        const outputTable = new Table({
          head: [
            chalk.magenta('文件类型'),
            chalk.magenta('文件名'),
            chalk.magenta('说明')
          ],
          colWidths: [15, 45, 30]
        });

        outputTable.push(
          [
            '异常报告',
            chalk.yellow(path.basename(exceptionReportPath)),
            '包含原始行号、源文件和详细异常信息'
          ],
          [
            '清洗结果',
            chalk.green(path.basename(validRecordsPath)),
            '验证通过的记录，保留原始行号和源文件'
          ]
        );

        console.log(outputTable.toString());
        console.log('');

        console.log(chalk.cyan('═══════════════════════════════════════════════════════════'));
        console.log(chalk.green.bold('✅ 处理完成！'));
        console.log('');
        console.log(chalk.gray('💡 提示：异常报告中每条记录都包含原始行号、源文件名和详细错误位置，'));
        console.log(chalk.gray('   可直接根据行号定位原始文件中的问题数据进行修正后重新运行。'));
        console.log(chalk.cyan('═══════════════════════════════════════════════════════════'));

      } catch (error) {
        console.log(chalk.red(`✗ 处理失败: ${error.message}`));
        console.log(chalk.gray(error.stack));
        process.exit(1);
      }
    }
  })
  .command({
    command: 'info',
    describe: '显示工具信息和使用说明',
    handler() {
      console.log(chalk.bold('📋 工具说明'));
      console.log('');
      console.log('本工具用于水站配送队水桶流转数据的质量校验和异常追踪。');
      console.log('');
      
      console.log(chalk.bold('✨ 主要功能'));
      console.log('  • 桶号格式验证：检查桶号是否符合 BT+6-10位字母数字 的格式');
      console.log('  • 重复检测：同一水站同一天不允许桶号重复');
      console.log('  • 配送中状态查重：已在配送中的桶不能重复标记');
      console.log('  • 司机补录校验：补录必须有司机ID、在规定时限内、原因合法');
      console.log('  • 状态流转校验：水桶状态必须按规定流程流转');
      console.log('');

      console.log(chalk.bold('📁 输出文件特点'));
      console.log('  • 保留原始行号：可直接定位到原始文件');
      console.log('  • 记录源文件名：支持多文件批量处理时追踪来源');
      console.log('  • 详细异常信息：包含错误列名、错误值、业务规则说明');
      console.log('');

      console.log(chalk.bold('🚀 快速开始'));
      console.log(chalk.gray('  # 安装依赖'));
      console.log('  npm install');
      console.log('');
      console.log(chalk.gray('  # 运行样例数据验证'));
      console.log('  npm test');
      console.log('');
      console.log(chalk.gray('  # 验证自定义数据文件'));
      console.log('  node src/cli.js validate -i your-data.csv');
      console.log('');

      console.log(chalk.bold('🔧 自定义规则'));
      console.log('  编辑 rules/default.json 文件可调整验证规则参数');
      console.log('  包括：桶号格式、补录时限、补录原因、状态流转规则等');
      console.log('');
    }
  })
  .demandCommand(1, '请使用 --help 查看可用命令')
  .help()
  .version('1.0.0')
  .epilog('© 2026 水站配送队水桶流转追踪工具')
  .argv;
