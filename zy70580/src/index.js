#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');

const YamlParser = require('../lib/yaml-parser');
const ProbeAnalyzer = require('../lib/probe-analyzer');
const ReportGenerator = require('../lib/report-generator');

const program = new Command();

program
  .name('k8s-probe')
  .description('K8s 探针策略分析工具 - 分析和比较 Kubernetes 环境中的探针配置')
  .version('1.0.0');

program
  .argument('<input>', 'YAML 文件或目录路径')
  .option('-o, --output <dir>', '报告输出目录', process.cwd())
  .option('-p, --prefix <name>', '报告文件名前缀', 'probe-report')
  .option('-q, --quiet', '不输出终端摘要', false)
  .option('--max-initial-delay <seconds>', 'initialDelaySeconds 最大值', '300')
  .option('--max-period <seconds>', 'periodSeconds 最大值', '300')
  .option('--max-timeout <seconds>', 'timeoutSeconds 最大值', '60')
  .option('--max-failure-threshold <count>', 'failureThreshold 最大值', '20')
  .action(async (input, options) => {
    try {
      const inputPath = path.resolve(input);
      
      if (!fs.existsSync(inputPath)) {
        console.error(`错误: 输入路径不存在: ${inputPath}`);
        process.exit(1);
      }

      const parser = new YamlParser();
      const parsedData = parser.parseInput(inputPath);

      const analyzer = new ProbeAnalyzer({
        maxInitialDelaySeconds: parseInt(options.maxInitialDelay),
        maxPeriodSeconds: parseInt(options.maxPeriod),
        maxTimeoutSeconds: parseInt(options.maxTimeout),
        maxFailureThreshold: parseInt(options.maxFailureThreshold)
      });

      const analysisResult = analyzer.analyze(parsedData);

      const reporter = new ReportGenerator(analysisResult, {
        outputDir: path.resolve(options.output)
      });

      if (!options.quiet) {
        reporter.printTerminalSummary();
      }

      const outputs = reporter.saveReports(options.prefix);

      console.log('📄 报告已生成:');
      for (const output of outputs) {
        console.log(`   - ${output.type.toUpperCase()}: ${output.path}`);
      }
      console.log('');

      const hasErrors = analysisResult.summary.issuesCount > 0 || 
                        (analysisResult.raw.errors && analysisResult.raw.errors.length > 0);
      
      process.exit(hasErrors ? 1 : 0);

    } catch (error) {
      console.error('❌ 执行出错:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

program.parse();
