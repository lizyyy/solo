#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { scanDirectory, scanSingleFile } = require('../src/core/scanner');
const { printSummary } = require('../src/reporters/terminal-reporter');
const { exportJSON } = require('../src/reporters/json-reporter');
const { exportHTML } = require('../src/reporters/html-reporter');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dir: null,
    file: null,
    reportDir: null,
    json: false,
    html: false,
    quiet: false,
    help: false,
    selfTest: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-d':
      case '--dir':
        options.dir = args[++i];
        break;
      case '-f':
      case '--file':
        options.file = args[++i];
        break;
      case '-r':
      case '--report':
        options.reportDir = args[++i];
        break;
      case '--json':
        options.json = true;
        break;
      case '--html':
        options.html = true;
        break;
      case '-q':
      case '--quiet':
        options.quiet = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '--self-test':
        options.selfTest = true;
        break;
      default:
        if (!options.dir && fs.existsSync(arg)) {
          if (fs.statSync(arg).isDirectory()) {
            options.dir = arg;
          } else {
            options.file = arg;
          }
        }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
📦 前端资源404扫描工具 - asset-scan

用法:
  asset-scan [选项]

选项:
  -d, --dir <目录>      指定要扫描的构建目录
  -f, --file <文件>     扫描单个HTML文件
  -r, --report <目录>   指定报告输出目录
  --json                导出JSON格式报告
  --html                导出HTML格式报告
  -q, --quiet           静默模式，不输出终端摘要
  --self-test            运行自测程序
  -h, --help            显示此帮助信息

示例:
  asset-scan --dir ./dist                      扫描dist目录
  asset-scan ./dist --report ./reports --html      扫描并生成HTML报告
  asset-scan -f ./index.html --json          扫描单个文件并导出JSON
  asset-scan --self-test                    运行自测验证
  `);
}

async function runSelfTest() {
  console.log('🧪 开始运行自测程序...\n');
  
  const selfTestPath = path.join(__dirname, '..', 'src', 'self-test.js');
  
  if (fs.existsSync(selfTestPath)) {
    require(selfTestPath);
  } else {
    console.log('❌ 未找到自测文件，请确保项目完整安装');
    process.exit(1);
  }
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.selfTest) {
    await runSelfTest();
    return;
  }

  if (!options.dir && !options.file) {
    console.log('❌ 请指定要扫描的目录或文件');
    console.log('   使用 -h 或 --help 查看帮助信息');
    process.exit(1);
  }

  let results;
  
  if (options.dir) {
    const dirPath = path.resolve(options.dir);
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      console.log(`❌ 目录不存在: ${dirPath}`);
      process.exit(1);
    }
    results = scanDirectory(dirPath);
  } else if (options.file) {
    const filePath = path.resolve(options.file);
    const baseDir = path.dirname(filePath);
    if (!fs.existsSync(filePath)) {
      console.log(`❌ 文件不存在: ${filePath}`);
      process.exit(1);
    }
    results = scanSingleFile(filePath, baseDir);
  }

  let missingCount = 0;
  if (!options.quiet) {
    missingCount = printSummary(results);
  }

  const reportDir = options.reportDir ? path.resolve(options.reportDir) : process.cwd();
  
  if (options.json || options.html) {
    console.log('\n📤 导出报告...');
  }

  if (options.json) {
    const jsonPath = path.join(reportDir, 'asset-report.json');
    exportJSON(results, jsonPath);
    console.log(`   ✅ JSON报告: ${jsonPath}`);
  }

  if (options.html) {
    const htmlPath = path.join(reportDir, 'asset-report.html');
    exportHTML(results, htmlPath);
    console.log(`   ✅ HTML报告: ${htmlPath}`);
  }

  if (missingCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ 运行出错:', err);
  process.exit(1);
});
