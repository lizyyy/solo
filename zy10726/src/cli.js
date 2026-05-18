#!/usr/bin/env node

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const AppointmentReviewer = require('./reviewer');

const argv = yargs(hideBin(process.argv))
  .command('run', '运行检查预约数据号源释放复盘', {
    input: {
      description: '输入目录或文件路径',
      type: 'string',
      demandOption: true,
      alias: 'i'
    },
    output: {
      description: '输出目录路径',
      type: 'string',
      demandOption: true,
      alias: 'o'
    },
    config: {
      description: '配置文件路径',
      type: 'string',
      alias: 'c'
    },
    'no-append': {
      description: '不追加到现有结果，覆盖输出',
      type: 'boolean',
      default: false
    },
    'check-integrity': {
      description: '检查文件完整性后再处理',
      type: 'boolean',
      default: true
    }
  })
  .command('verify', '验证结果文件完整性', {
    file: {
      description: '结果文件路径',
      type: 'string',
      demandOption: true,
      alias: 'f'
    }
  })
  .command('init', '初始化样例数据和配置', {
    path: {
      description: '初始化路径',
      type: 'string',
      default: './sample'
    }
  })
  .demandCommand(1, '请指定一个命令')
  .help()
  .argv;

async function main() {
  const reviewer = new AppointmentReviewer();

  switch (argv._[0]) {
    case 'run':
      try {
        console.log(chalk.blue('开始检查预约数据号源释放复盘...'));
        const result = await reviewer.run({
          inputPath: argv.input,
          outputPath: argv.output,
          configPath: argv.config,
          noAppend: argv.noAppend,
          checkIntegrity: argv.checkIntegrity
        });
        console.log(chalk.green('\n✓ 复盘完成!'));
        console.log(chalk.cyan(`  处理文件数: ${result.processedFiles}`));
        console.log(chalk.cyan(`  未释放号源: ${result.unreleasedCount}`));
        console.log(chalk.cyan(`  误释放号源: ${result.falseReleasedCount}`));
        console.log(chalk.cyan(`  退费延迟: ${result.refundDelayCount}`));
        console.log(chalk.cyan(`  手工改约: ${result.manualRescheduleCount}`));
        console.log(chalk.cyan(`  重复占号: ${result.duplicateCount}`));
        console.log(chalk.cyan(`  输出文件: ${result.outputFile}`));
      } catch (error) {
        console.error(chalk.red('✗ 复盘失败:'), error.message);
        process.exit(1);
      }
      break;

    case 'verify':
      try {
        const isValid = await reviewer.verifyResultFile(argv.file);
        if (isValid) {
          console.log(chalk.green('✓ 文件完整性验证通过'));
        } else {
          console.log(chalk.red('✗ 文件完整性验证失败'));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('✗ 验证失败:'), error.message);
        process.exit(1);
      }
      break;

    case 'init':
      try {
        await reviewer.initSample(argv.path);
        console.log(chalk.green(`✓ 样例数据已初始化到: ${argv.path}`));
      } catch (error) {
        console.error(chalk.red('✗ 初始化失败:'), error.message);
        process.exit(1);
      }
      break;
  }
}

main();
