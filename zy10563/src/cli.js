#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const GitScanner = require('./git-scanner');
const ReportGenerator = require('./report-generator');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    repoPath: process.cwd(),
    since: '',
    until: '',
    minSize: 1024 * 1024,
    topN: 20,
    outputDir: null,
    format: 'terminal',
    help: false,
    selfTest: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--repo':
      case '-r':
        options.repoPath = args[++i];
        break;
      case '--since':
      case '-s':
        options.since = args[++i];
        break;
      case '--until':
      case '-u':
        options.until = args[++i];
        break;
      case '--min-size':
      case '-m':
        const sizeStr = args[++i];
        options.minSize = parseSize(sizeStr);
        break;
      case '--top':
      case '-n':
        options.topN = parseInt(args[++i], 10);
        break;
      case '--output':
      case '-o':
        options.outputDir = args[++i];
        break;
      case '--format':
      case '-f':
        options.format = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--self-test':
      case '--test':
        options.selfTest = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`未知选项: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

function parseSize(sizeStr) {
  const units = {
    'b': 1,
    'k': 1024,
    'kb': 1024,
    'm': 1024 * 1024,
    'mb': 1024 * 1024,
    'g': 1024 * 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };

  const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) {
    throw new Error(`无法解析大小: ${sizeStr}`);
  }

  const num = parseFloat(match[1]);
  const unit = match[2] || 'b';
  const multiplier = units[unit] || 1;

  return Math.floor(num * multiplier);
}

function showHelp() {
  console.log(`
Git 历史大文件分析工具

用法:
  git-large-files [选项]

选项:
  -r, --repo <路径>        Git仓库路径 (默认: 当前目录)
  -s, --since <提交>       起始提交/日期
  -u, --until <提交>       结束提交/日期
  -m, --min-size <大小>    最小文件大小 (如: 1M, 500K, 1G) (默认: 1M)
  -n, --top <数量>         显示前N个文件 (默认: 20)
  -o, --output <目录>      输出报告到指定目录
  -f, --format <格式>      输出格式: terminal, json, markdown, all (默认: terminal)
  -v, --verbose            显示详细输出
      --self-test, --test  运行自检程序
  -h, --help               显示帮助信息

示例:
  git-large-files                                # 分析当前仓库
  git-large-files -r /path/to/repo               # 分析指定仓库
  git-large-files -m 5M -n 50                    # 显示大于5M的前50个文件
  git-large-files -s 2023-01-01                  # 分析2023年以来的提交
  git-large-files -o ./reports -f all            # 导出所有格式的报告
  git-large-files --self-test                    # 运行自检程序
`);
}

async function runScan(options) {
  try {
    const isMachineReadable = options.format === 'json' && !options.outputDir;
    
    if (!isMachineReadable) {
      console.log('🔍 开始扫描 Git 历史...');
      console.log(`   仓库: ${options.repoPath}`);
    }
    
    const scanner = new GitScanner(options);
    const data = scanner.getDetailedHistory();
    
    if (!isMachineReadable) {
      console.log(`   ✓ 扫描完成: ${data.summary.totalCommits} 个提交, ${data.summary.totalFiles} 个文件`);
    }
    
    const generator = new ReportGenerator(data, { topN: options.topN });

    if (options.outputDir) {
      console.log(`\n📤 导出报告到: ${options.outputDir}`);
      const results = generator.saveAll(options.outputDir);
      console.log(`   ✓ summary.txt`);
      console.log(`   ✓ results.json`);
      console.log(`   ✓ report.md`);
      console.log(`\n✨ 所有报告已保存！`);
    } else {
      switch (options.format) {
        case 'json':
          console.log(generator.generateJSON());
          break;
        case 'markdown':
          console.log(generator.generateMarkdown());
          break;
        case 'all':
          console.log(generator.generateTerminalSummary());
          console.log('\n' + '='.repeat(80) + '\n');
          console.log(generator.generateJSON());
          break;
        default:
          console.log(generator.generateTerminalSummary());
      }
    }

    if (options.verbose && data.errors.length > 0 && !isMachineReadable) {
      console.log('\n📋 详细错误列表:');
      for (const err of data.errors) {
        console.log(`   [${err.type}] 行${err.line}: ${err.reason}`);
        if (err.content) {
          console.log(`      内容: ${err.content.substring(0, 80)}`);
        }
      }
    }

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function runSelfTest() {
  console.log('🧪 启动 Git 历史大文件分析工具自检程序...\n');
  
  const { execSync } = require('child_process');
  const os = require('os');
  
  const testDir = path.join(os.tmpdir(), 'git-large-files-test-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });

  try {
    console.log('1. 检查 Node.js 版本...');
    const nodeVersion = process.version;
    console.log(`   ✓ Node.js ${nodeVersion}`);

    console.log('\n2. 检查 Git 安装...');
    const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
    console.log(`   ✓ ${gitVersion}`);

    console.log('\n3. 测试模块加载...');
    require.resolve('./git-scanner');
    require.resolve('./report-generator');
    console.log('   ✓ 所有模块加载成功');

    console.log('\n4. 创建测试 Git 仓库...');
    process.chdir(testDir);
    execSync('git init');
    execSync('git config user.name "Test User"');
    execSync('git config user.email "test@example.com"');

    console.log('\n5. 生成测试提交...');
    
    for (let i = 0; i < 5; i++) {
      const content = 'x'.repeat(1024 * (i + 1) * 100);
      fs.writeFileSync(`file${i}.txt`, content);
      execSync(`git add file${i}.txt`);
      execSync(`git commit -m "Add file${i}"`);
    }

    fs.writeFileSync('small.txt', 'small content');
    execSync('git add small.txt');
    execSync('git commit -m "Add small file"');

    console.log('   ✓ 创建了 6 个测试提交');

    console.log('\n6. 运行 GitScanner 测试...');
    const scanner = new GitScanner({ repoPath: testDir, minSize: 1024 });
    
    const historyResult = scanner.scanHistory();
    console.log(`   ✓ 扫描到 ${historyResult.commits.length} 个提交, ${historyResult.files.length} 个文件`);
    
    if (historyResult.commits.length !== 6) {
      throw new Error(`期望 6 个提交, 实际得到 ${historyResult.commits.length}`);
    }

    console.log('\n7. 测试 blob 大小扫描...');
    const blobResult = scanner.scanWithBlobSizes();
    console.log(`   ✓ 找到 ${blobResult.files.length} 个大文件`);

    console.log('\n8. 测试详细历史扫描...');
    const detailedResult = scanner.getDetailedHistory();
    console.log(`   ✓ 摘要: ${JSON.stringify(detailedResult.summary, null, 0)}`);

    console.log('\n9. 测试 ReportGenerator...');
    const generator = new ReportGenerator(detailedResult, { topN: 10 });
    
    const terminalOutput = generator.generateTerminalSummary();
    if (!terminalOutput.includes('Git 历史大文件分析报告')) {
      throw new Error('终端摘要生成失败');
    }
    console.log('   ✓ 终端摘要生成成功');

    const jsonOutput = generator.generateJSON();
    JSON.parse(jsonOutput);
    console.log('   ✓ JSON 输出验证成功');

    const mdOutput = generator.generateMarkdown();
    if (!mdOutput.startsWith('# Git 历史大文件分析报告')) {
      throw new Error('Markdown 报告生成失败');
    }
    console.log('   ✓ Markdown 报告生成成功');

    console.log('\n10. 测试报告导出...');
    const exportDir = path.join(testDir, 'reports');
    const savedFiles = generator.saveAll(exportDir);
    
    for (const [type, filePath] of Object.entries(savedFiles)) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`${type} 报告文件未生成: ${filePath}`);
      }
    }
    console.log('   ✓ 所有报告文件导出成功');

    console.log('\n11. 测试边界情况和错误处理...');
    try {
      const badScanner = new GitScanner({ repoPath: '/nonexistent/path' });
      badScanner.validateRepo();
      throw new Error('应该抛出无效仓库错误');
    } catch (e) {
      if (e.message.includes('不是有效的Git仓库')) {
        console.log('   ✓ 无效仓库检测正常');
      } else {
        throw e;
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ 所有自检通过！工具运行正常。');
    console.log('═'.repeat(60));
    console.log('\n📝 测试数据目录:', testDir);
    console.log('   你可以查看该目录了解测试过程中生成的文件。\n');

    return true;

  } catch (error) {
    console.error('\n❌ 自检失败:', error.message);
    console.error('   堆栈:', error.stack);
    console.log('\n测试目录:', testDir);
    process.exit(1);
  }
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (options.selfTest) {
    await runSelfTest();
    process.exit(0);
  }

  await runScan(options);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
