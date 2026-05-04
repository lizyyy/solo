#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const GCParser = require('./parsers/gc-parser');
const HeapParser = require('./parsers/heap-parser');
const RetainerParser = require('./parsers/retainer-parser');
const TrafficParser = require('./parsers/traffic-parser');
const ConfigParser = require('./parsers/config-parser');

const Detector = require('./detectors/detector');
const Simulator = require('./simulator/simulator');
const Reporter = require('./reporters/reporter');

const packageJson = require('../package.json');

program
  .name('memory-analyzer')
  .description(packageJson.description)
  .version(packageJson.version);

program
  .command('analyze')
  .description('分析内存数据并生成报告')
  .option('--gc-log <path>', 'GC 日志文件路径 (trace-gc.log)')
  .option('--heap-summary <path>', 'Heap 摘要文件路径 (heap-summary.json)')
  .option('--retainer-paths <path>', 'Retainer 路径文件路径 (retainer-paths.json)')
  .option('--endpoint-traffic <path>', '接口流量文件路径 (endpoint-traffic.csv)')
  .option('--config <path>', '配置文件路径 (对象池/缓存配置 JSON)')
  .option('--output <path>', '输出目录路径')
  .option('--format <format>', '输出格式: markdown, json, csv (默认: markdown)', 'markdown')
  .option('--verbose', '显示详细信息')
  .action(async (options) => {
    console.log(chalk.blue('🚀 开始内存分析...\n'));

    const outputDir = options.output || path.join(process.cwd(), 'analysis-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const analysisData = {
      meta: {
        analysisTime: new Date().toISOString(),
        toolVersion: packageJson.version
      },
      gcLog: null,
      heapSummary: null,
      retainerPaths: null,
      endpointTraffic: null,
      config: null,
      issues: [],
      simulations: null,
      recommendations: []
    };

    if (options.gcLog) {
      console.log(chalk.gray('📄 解析 GC 日志...'));
      const gcParser = new GCParser(options.gcLog);
      analysisData.gcLog = gcParser.parse();
      if (options.verbose) {
        console.log(chalk.gray(`   解析了 ${analysisData.gcLog.events.length} 个 GC 事件`));
      }
    }

    if (options.heapSummary) {
      console.log(chalk.gray('📊 解析 Heap 摘要...'));
      const heapParser = new HeapParser(options.heapSummary);
      analysisData.heapSummary = heapParser.parse();
    }

    if (options.retainerPaths) {
      console.log(chalk.gray('🔗 解析 Retainer 路径...'));
      const retainerParser = new RetainerParser(options.retainerPaths);
      analysisData.retainerPaths = retainerParser.parse();
    }

    if (options.endpointTraffic) {
      console.log(chalk.gray('📈 解析接口流量数据...'));
      const trafficParser = new TrafficParser(options.endpointTraffic);
      analysisData.endpointTraffic = await trafficParser.parse();
    }

    if (options.config) {
      console.log(chalk.gray('⚙️  解析配置文件...'));
      const configParser = new ConfigParser(options.config);
      analysisData.config = configParser.parse();
    }

    console.log(chalk.gray('🔍 检测内存问题...'));
    const detector = new Detector(analysisData);
    analysisData.issues = detector.detectAll();
    
    if (options.verbose) {
      console.log(chalk.gray(`   发现 ${analysisData.issues.length} 个潜在问题`));
    }

    console.log(chalk.gray('🎯 运行参数调整模拟...'));
    const simulator = new Simulator(analysisData);
    analysisData.simulations = simulator.runAllSimulations();
    analysisData.recommendations = simulator.getRecommendations();

    console.log(chalk.gray('📝 生成报告...'));
    const reporter = new Reporter(analysisData, outputDir);
    const reportPaths = await reporter.export(options.format);

    console.log(chalk.green('\n✅ 分析完成！'));
    console.log(chalk.blue('\n📂 报告已生成:'));
    reportPaths.forEach(p => console.log(chalk.gray(`   ${p}`)));

    if (analysisData.issues.length > 0) {
      console.log(chalk.yellow(`\n⚠️  发现 ${analysisData.issues.length} 个潜在内存问题`));
      const criticalIssues = analysisData.issues.filter(i => i.severity === 'critical');
      const warningIssues = analysisData.issues.filter(i => i.severity === 'warning');
      if (criticalIssues.length > 0) {
        console.log(chalk.red(`   🔴 严重问题: ${criticalIssues.length} 个`));
      }
      if (warningIssues.length > 0) {
        console.log(chalk.yellow(`   🟡 警告问题: ${warningIssues.length} 个`));
      }
    } else {
      console.log(chalk.green('\n✅ 未发现明显的内存问题'));
    }

    console.log(chalk.blue('\n💡 优化建议:'));
    analysisData.recommendations.slice(0, 5).forEach((rec, idx) => {
      console.log(chalk.gray(`   ${idx + 1}. ${rec.title}`));
    });
  });

program
  .command('simulate')
  .description('模拟参数调整效果（交互式）')
  .option('--config <path>', '基础配置文件路径')
  .option('--gc-log <path>', 'GC 日志文件路径（用于校准）')
  .action(async (options) => {
    console.log(chalk.blue('🎮 参数调整模拟器\n'));
    
    let baseConfig = {};
    if (options.config) {
      const configParser = new ConfigParser(options.config);
      baseConfig = configParser.parse();
    }

    let gcData = null;
    if (options.gcLog) {
      const gcParser = new GCParser(options.gcLog);
      gcData = gcParser.parse();
    }

    const simulator = new Simulator({ config: baseConfig, gcLog: gcData });
    
    const simulations = [
      {
        name: '调整 max-old-space-size',
        scenarios: [
          { params: { maxOldSpaceSize: 256 }, label: '256MB' },
          { params: { maxOldSpaceSize: 512 }, label: '512MB (推荐)' },
          { params: { maxOldSpaceSize: 1024 }, label: '1GB' },
          { params: { maxOldSpaceSize: 2048 }, label: '2GB' }
        ]
      },
      {
        name: '调整 semi-space 大小',
        scenarios: [
          { params: { semiSpaceSize: 16 }, label: '16MB' },
          { params: { semiSpaceSize: 32 }, label: '32MB (推荐)' },
          { params: { semiSpaceSize: 64 }, label: '64MB' },
          { params: { semiSpaceSize: 128 }, label: '128MB' }
        ]
      },
      {
        name: '调整缓存 TTL',
        scenarios: [
          { params: { cacheTTL: 60 }, label: '60秒' },
          { params: { cacheTTL: 300 }, label: '5分钟 (推荐)' },
          { params: { cacheTTL: 1800 }, label: '30分钟' },
          { params: { cacheTTL: 3600 }, label: '1小时' }
        ]
      },
      {
        name: '调整对象池上限',
        scenarios: [
          { params: { poolMaxSize: 100 }, label: '100个' },
          { params: { poolMaxSize: 500 }, label: '500个 (推荐)' },
          { params: { poolMaxSize: 1000 }, label: '1000个' },
          { params: { poolMaxSize: 5000 }, label: '5000个' }
        ]
      }
    ];

    console.log(chalk.gray('📊 运行预设模拟场景...\n'));

    const allResults = [];
    for (const sim of simulations) {
      console.log(chalk.blue(`📋 ${sim.name}`));
      const results = [];
      for (const scenario of sim.scenarios) {
        const result = simulator.simulate(scenario.params);
        results.push({
          label: scenario.label,
          params: scenario.params,
          result
        });
        console.log(chalk.gray(`   ${scenario.label}: 预计内存峰值 ${(result.estimatedPeakMemoryMB).toFixed(1)}MB, GC 频率 ${result.gcFrequency.toFixed(2)}/min`));
      }
      allResults.push({
        name: sim.name,
        results
      });
      console.log('');
    }

    const outputDir = path.join(process.cwd(), 'simulation-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'simulation-results.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      meta: {
        simulationTime: new Date().toISOString(),
        toolVersion: packageJson.version
      },
      baseConfig,
      simulations: allResults
    }, null, 2));

    console.log(chalk.green(`✅ 模拟结果已保存: ${outputPath}`));
  });

program
  .command('generate-seed')
  .description('生成示例数据（包含好/坏样例）')
  .option('--output <path>', '输出目录', './seed-data')
  .option('--type <type>', '数据类型: all, good, bad (默认: all)', 'all')
  .action((options) => {
    const seedGenerator = require('./utils/seed-generator');
    const outputDir = options.output;
    
    console.log(chalk.blue('🌱 生成示例数据...'));
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const types = options.type === 'all' ? ['good', 'bad'] : [options.type];
    
    types.forEach(type => {
      console.log(chalk.gray(`   生成 ${type === 'good' ? '正常' : '问题'}样例数据...`));
      const data = seedGenerator.generate(type);
      
      const typeDir = path.join(outputDir, type);
      if (!fs.existsSync(typeDir)) {
        fs.mkdirSync(typeDir, { recursive: true });
      }

      fs.writeFileSync(path.join(typeDir, 'trace-gc.log'), data.gcLog);
      fs.writeFileSync(path.join(typeDir, 'heap-summary.json'), JSON.stringify(data.heapSummary, null, 2));
      fs.writeFileSync(path.join(typeDir, 'retainer-paths.json'), JSON.stringify(data.retainerPaths, null, 2));
      fs.writeFileSync(path.join(typeDir, 'endpoint-traffic.csv'), data.trafficCSV);
      fs.writeFileSync(path.join(typeDir, 'config.json'), JSON.stringify(data.config, null, 2));
    });

    console.log(chalk.green(`\n✅ 示例数据已生成: ${outputDir}`));
    console.log(chalk.blue('\n📂 目录结构:'));
    console.log(chalk.gray(`   ${outputDir}/`));
    console.log(chalk.gray(`   ├── good/          # 正常运行样例`));
    console.log(chalk.gray(`   │   ├── trace-gc.log`));
    console.log(chalk.gray(`   │   ├── heap-summary.json`));
    console.log(chalk.gray(`   │   ├── retainer-paths.json`));
    console.log(chalk.gray(`   │   ├── endpoint-traffic.csv`));
    console.log(chalk.gray(`   │   └── config.json`));
    console.log(chalk.gray(`   └── bad/           # 有内存问题的样例`));
    console.log(chalk.gray(`       ├── trace-gc.log`));
    console.log(chalk.gray(`       ├── heap-summary.json`));
    console.log(chalk.gray(`       ├── retainer-paths.json`));
    console.log(chalk.gray(`       ├── endpoint-traffic.csv`));
    console.log(chalk.gray(`       └── config.json`));
  });

program.parse(process.argv);
