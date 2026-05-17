#!/usr/bin/env node

import ora from 'ora';
import chalk from 'chalk';
import { Cli } from './cli';
import { ConfigManager } from './config';
import { DirectoryReader } from './directory-reader';
import { RepoProbe } from './repo-probe';
import { AlertChecker } from './alert-checker';
import { OrphanDetector } from './orphan-detector';
import { ReportGenerator } from './report-generator';
import { ProcessingError } from './types';

async function main() {
  const cli = new Cli();
  const options = cli.parse(process.argv);

  const configManager = new ConfigManager(options);
  const directoryReader = new DirectoryReader(options.inputDir, configManager, options.verbose);
  const repoProbe = new RepoProbe(configManager, options.verbose, options.githubToken);
  const alertChecker = new AlertChecker(options.inputDir, configManager, options.verbose);
  const orphanDetector = new OrphanDetector(configManager);
  const reportGenerator = new ReportGenerator(options.outputDir, options.format, options.verbose);

  const allErrors: ProcessingError[] = [];

  console.log(chalk.cyan('🔍 开始扫描服务目录...'));

  const readSpinner = ora('读取服务数据...').start();
  const { services, errors: readErrors } = await directoryReader.readAllServices();
  readSpinner.succeed(`读取完成，共发现 ${services.length} 个服务`);

  allErrors.push(...readErrors);

  if (services.length === 0) {
    console.log(chalk.yellow('未找到任何服务数据，程序退出。'));
    process.exit(0);
  }

  let repoResults = new Map();
  if (!options.skipRepoCheck) {
    const repoSpinner = ora('探测仓库可用性...').start();
    const { results, errors: repoErrors } = await repoProbe.probeRepositories(services);
    repoResults = results;
    allErrors.push(...repoErrors);
    repoSpinner.succeed('仓库探测完成');
  } else {
    console.log(chalk.gray('⏭ 跳过仓库探测'));
  }

  orphanDetector.setRepoResults(repoResults);

  let alertResults = new Map();
  if (!options.skipAlertCheck) {
    const alertSpinner = ora('检查告警规则引用...').start();
    const { results, errors: alertErrors } = await alertChecker.checkAlertReferences(services);
    alertResults = results;
    allErrors.push(...alertErrors);
    alertSpinner.succeed('告警检查完成');
  } else {
    console.log(chalk.gray('⏭ 跳过告警检查'));
  }

  orphanDetector.setAlertResults(alertResults);

  const detectSpinner = ora('执行孤儿服务检测...').start();
  const report = orphanDetector.detectOrphans(services, allErrors);
  detectSpinner.succeed('检测完成');

  const generateSpinner = ora('生成报告文件...').start();
  await reportGenerator.generate(report);
  generateSpinner.succeed('报告生成完成');

  reportGenerator.printSummary(report);

  if (report.summary.orphanCount > 0) {
    process.exit(2);
  } else if (report.summary.errorCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(chalk.red('\n✗ 程序执行出错:'));
  console.error(chalk.red(`  ${err.message}`));
  console.error(chalk.gray(err.stack));
  process.exit(1);
});
