#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const { normalizeUrl, compareUrls, checkUrlParams } = require('./urlNormalizer');
const { validateConfig, compareEnvironments, attributeErrors } = require('./validator');
const { generateTerminalSummary, generateJsonReport, generateReadableReport } = require('./reporter');
const { parseJsonWithSource, parseErrorSamplesWithSource } = require('./jsonLineParser');

const program = new Command();

program
  .name('oauth-check')
  .description('OAuth回调地址校验CLI工具 - 检查redirect_uri配置是否正确')
  .version('1.0.0');

program
  .command('validate')
  .description('校验OAuth回调配置')
  .requiredOption('-c, --config <path>', '应用配置文件路径 (JSON/YAML)')
  .option('-e, --env <name>', '指定环境名称，如不指定则校验所有环境')
  .option('-a, --auth-url <url>', '授权链接（可选，用于对比）')
  .option('-s, --error-samples <path>', '错误样本文件路径（可选）')
  .option('-o, --output-dir <dir>', '报告输出目录', './reports')
  .option('--json', '输出JSON格式结果')
  .option('--report', '生成可读的HTML报告')
  .action(async (options) => {
    try {
      if (!options.json) {
        console.log(chalk.blue('\n🔍 OAuth回调地址校验工具启动...\n'));
      }

      const configPath = path.resolve(options.config);
      if (!fs.existsSync(configPath)) {
        console.error(chalk.red(`❌ 配置文件不存在: ${configPath}`));
        process.exit(1);
      }

      const config = parseJsonWithSource(configPath);
      
      let errorSamples = [];
      if (options.errorSamples) {
        const samplesPath = path.resolve(options.errorSamples);
        if (fs.existsSync(samplesPath)) {
          errorSamples = parseErrorSamplesWithSource(samplesPath);
        }
      }

      const validationResult = validateConfig(config, options.env);
      const envComparison = compareEnvironments(config);
      const attributedErrors = attributeErrors(validationResult, errorSamples, envComparison);

      if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const jsonPath = path.join(options.outputDir, `oauth-check-result-${timestamp}.json`);
      generateJsonReport(attributedErrors, jsonPath);

      let reportPath = null;
      if (options.report) {
        reportPath = path.join(options.outputDir, `oauth-check-report-${timestamp}.html`);
        generateReadableReport(attributedErrors, reportPath);
      }

      if (options.json) {
        console.log(JSON.stringify({
          result: attributedErrors,
          outputFiles: {
            json: jsonPath,
            html: reportPath
          }
        }, null, 2));
      } else {
        generateTerminalSummary(attributedErrors);
        console.log(chalk.gray(`📄 机器可读结果已保存: ${jsonPath}`));
        if (options.report) {
          console.log(chalk.gray(`📊 详细报告已生成: ${reportPath}`));
        }
      }

      if (attributedErrors.summary.hasErrors) {
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red(`\n❌ 执行错误: ${error.message}`));
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  });

program
  .command('normalize')
  .description('URL归一化工具，用于对比两个URL是否等价')
  .argument('<url1>', '第一个URL')
  .argument('[url2]', '第二个URL（可选，用于对比）')
  .action((url1, url2) => {
    const normalized1 = normalizeUrl(url1);
    console.log(chalk.blue('原始URL:'), url1);
    console.log(chalk.green('归一化URL:'), normalized1.normalized);
    
    if (url2) {
      console.log('\n' + chalk.blue('对比URL:'), url2);
      const normalized2 = normalizeUrl(url2);
      console.log(chalk.green('归一化URL:'), normalized2.normalized);
      
      const comparison = compareUrls(url1, url2);
      console.log('\n' + chalk.yellow('对比结果:'));
      console.log(`  协议匹配: ${comparison.protocolMatch ? '✅' : '❌'}`);
      console.log(`  主机匹配: ${comparison.hostMatch ? '✅' : '❌'}`);
      console.log(`  路径匹配: ${comparison.pathMatch ? '✅' : '❌'}`);
      console.log(`  参数匹配: ${comparison.paramsMatch ? '✅' : '❌'}`);
      console.log(`  完全匹配: ${comparison.exactMatch ? '✅' : '❌'}`);
      
      if (!comparison.exactMatch) {
        console.log('\n' + chalk.red('差异:'));
        comparison.differences.forEach(diff => {
          console.log(`  - ${diff}`);
        });
      }
    }
  });

program.parse(process.argv);
