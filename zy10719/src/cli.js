#!/usr/bin/env node

const { Command } = require('commander');
const CertChecker = require('./cert-checker');
const ReportGenerator = require('./report-generator');
const path = require('path');

const program = new Command();

program
  .name('cert-check')
  .description('证书部署清单域名证书到期检查 CLI')
  .version('1.0.0')
  .requiredOption('-c, --certs <path>', '证书文件目录路径')
  .requiredOption('-n, --nodes <path>', '节点列表JSON文件路径')
  .requiredOption('-l, --logs <path>', '部署日志目录路径')
  .option('-o, --output <path>', '输出报告目录路径', './cert-check-results')
  .action((options) => {
    try {
      const certsDir = path.resolve(options.certs);
      const nodesFile = path.resolve(options.nodes);
      const logsDir = path.resolve(options.logs);
      const outputDir = path.resolve(options.output);

      console.log('');
      console.log('🚀 开始证书部署清单域名证书到期检查...');
      console.log('');
      console.log(`📂 证书目录: ${certsDir}`);
      console.log(`📄 节点文件: ${nodesFile}`);
      console.log(`📋 日志目录: ${logsDir}`);
      console.log(`📁 输出目录: ${outputDir}`);
      console.log('');

      const checker = new CertChecker();
      
      console.log('📥 加载数据...');
      const loadResult = checker.loadData(certsDir, nodesFile, logsDir);
      
      if (!loadResult.nodesResult.success) {
        console.error(`❌ 节点列表加载失败: ${loadResult.nodesResult.error}`);
        process.exit(1);
      }

      console.log('✅ 数据加载完成');
      console.log('');

      console.log('🔍 执行检查...');
      const results = checker.runChecks();
      console.log('✅ 检查完成');
      console.log('');

      console.log('📝 生成报告...');
      const reportGenerator = new ReportGenerator(results, outputDir);
      const generatedFiles = reportGenerator.generateAllReports();
      
      process.exit(0);
    } catch (error) {
      console.error('');
      console.error('❌ 检查过程中发生错误:');
      console.error(error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

program.parse(process.argv);
