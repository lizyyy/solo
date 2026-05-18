#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const PriceComparator = require('./comparator');

function parseArgs(args) {
  const result = {
    config: null,
    input: null,
    output: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
      case '-c':
        result.config = args[++i];
        break;
      case '--input':
      case '-i':
        result.input = args[++i];
        break;
      case '--output':
      case '-o':
        result.output = args[++i];
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
    }
  }
  return result;
}

function printHelp() {
  console.log(`
价目表快照门店价格生效比对 CLI

用法:
  price-compare --config <规则文件> --input <输入目录/文件> --output <输出文件>

选项:
  --config, -c    规则配置文件路径 (JSON格式)
  --input,  -i    输入数据目录或单个文件
  --output, -o    输出结果文件路径
  --help,   -h    显示帮助信息

示例:
  price-compare --config config/rules.json --input samples/normal --output result.json

业务说明:
  比较实际价格和应生效版本，支持以下规则配置：
  - 半夜生效：00:00-06:00生效的价格特殊处理
  - 门店停业：停业期间价格不生效
  - 旧订单：历史订单使用下单时价格版本
  
  规则变更后，相关输出能用 diff 直接看出变化。
`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.config || !args.input) {
    console.error('错误: 必须指定 --config 和 --input 参数');
    printHelp();
    process.exit(1);
  }

  try {
    console.log('=' .repeat(60));
    console.log('  价目表快照门店价格生效比对工具');
    console.log('=' .repeat(60));

    const configPath = path.resolve(args.config);
    if (!fs.existsSync(configPath)) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`✓ 加载配置文件: ${configPath}`);

    const comparator = new PriceComparator(config);
    const inputPath = path.resolve(args.input);
    
    let inputFiles = [];
    if (fs.statSync(inputPath).isDirectory()) {
      inputFiles = fs.readdirSync(inputPath)
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(inputPath, f));
    } else {
      inputFiles = [inputPath];
    }

    if (inputFiles.length === 0) {
      throw new Error(`未找到输入文件: ${inputPath}`);
    }
    console.log(`✓ 发现 ${inputFiles.length} 个输入文件`);

    const allResults = [];
    for (const file of inputFiles) {
      console.log(`  处理: ${path.basename(file)}`);
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const results = comparator.compare(data);
      allResults.push({
        sourceFile: path.basename(file),
        ...results
      });
    }

    const summary = comparator.generateSummary(allResults);

    const output = {
      tool: '价目表快照门店价格生效比对',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      configUsed: {
        rules: config.rules,
        configFile: args.config
      },
      results: allResults,
      summary: summary
    };

    if (args.output) {
      const outputPath = path.resolve(args.output);
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
      console.log(`✓ 结果已写入: ${outputPath}`);
    } else {
      console.log('\n' + JSON.stringify(output, null, 2));
    }

    console.log('');
    console.log('--- 比对摘要 ---');
    console.log(`总记录数: ${summary.totalRecords}`);
    console.log(`匹配: ${summary.matched}`);
    console.log(`不匹配: ${summary.mismatched}`);
    console.log(`异常: ${summary.errors}`);
    console.log(`匹配率: ${summary.matchRate.toFixed(2)}%`);

    if (summary.breakdown && Object.keys(summary.breakdown).length > 0) {
      console.log('');
      console.log('--- 按规则分类 ---');
      for (const [rule, count] of Object.entries(summary.breakdown)) {
        console.log(`  ${rule}: ${count}`);
      }
    }

    console.log('=' .repeat(60));

  } catch (error) {
    console.error('');
    console.error('❌ 执行失败:');
    console.error(`   ${error.message}`);
    console.error('');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseArgs, printHelp };
