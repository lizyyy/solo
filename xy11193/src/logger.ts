import chalk from 'chalk';

class Logger {
  private verbose: boolean = false;

  setVerbose(verbose: boolean) {
    this.verbose = verbose;
  }

  info(message: string) {
    console.log(chalk.blue('ℹ ') + message);
  }

  success(message: string) {
    console.log(chalk.green('✓ ') + message);
  }

  warning(message: string) {
    console.log(chalk.yellow('⚠ ') + message);
  }

  error(message: string) {
    console.log(chalk.red('✗ ') + message);
  }

  verboseInfo(message: string) {
    if (this.verbose) {
      console.log(chalk.gray('  ') + message);
    }
  }

  verboseRecord(record: { 员工姓名: string; 员工编号: string; 培训课程: string }) {
    if (this.verbose) {
      console.log(chalk.gray(`    ${record.员工姓名} (${record.员工编号}) - ${record.培训课程}`));
    }
  }

  printSummary(statistics: {
    总文件数: number;
    成功处理文件数: number;
    跳过文件数: number;
    失败文件数: number;
    总记录数: number;
    正常记录数: number;
    异常记录数: number;
  }) {
    console.log('\n' + chalk.bold('═══════════════════════════════════════════'));
    console.log(chalk.bold('           企业内训成绩汇总处理摘要           '));
    console.log(chalk.bold('═══════════════════════════════════════════\n'));

    console.log(chalk.bold('📁 文件处理情况:'));
    console.log(`  总文件数: ${statistics.总文件数}`);
    console.log(chalk.green(`  成功处理: ${statistics.成功处理文件数}`));
    console.log(chalk.yellow(`  跳过文件: ${statistics.跳过文件数}`));
    console.log(chalk.red(`  失败文件: ${statistics.失败文件数}`));

    console.log('\n' + chalk.bold('📊 记录处理情况:'));
    console.log(`  总记录数: ${statistics.总记录数}`);
    console.log(chalk.green(`  正常记录: ${statistics.正常记录数}`));
    console.log(chalk.red(`  异常记录: ${statistics.异常记录数}`));

    console.log('\n' + chalk.bold('═══════════════════════════════════════════\n'));
  }
}

export const logger = new Logger();
