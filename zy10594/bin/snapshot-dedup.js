#!/usr/bin/env node

const path = require('path');
const { Scanner } = require('../src/scanner');
const { Hasher } = require('../src/hasher');
const { Grouper } = require('../src/grouper');
const { RetentionEngine } = require('../src/retention');
const { Reporter } = require('../src/reporter');

function parseArgs(args) {
  const options = {
    directory: process.cwd(),
    outputJson: null,
    outputMd: null,
    outputScript: null,
    strategy: 'newest',
    keepPerHash: 1,
    keepPerGroup: null,
    algorithm: 'sha256',
    followSymlinks: false,
    maxDepth: Infinity,
    minSize: 0,
    ignoreExtension: false,
    caseSensitive: true,
    preferDirectories: [],
    excludePatterns: [],
    includePatterns: [],
    preservePatterns: [],
    verbose: false,
    noColor: false,
    concurrency: 4,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      case '-v':
      case '--version':
        printVersion();
        process.exit(0);
        break;
      case '-d':
      case '--directory':
        options.directory = path.resolve(args[++i]);
        break;
      case '--json':
        options.outputJson = args[++i] || 'dedup-results.json';
        break;
      case '--md':
      case '--markdown':
        options.outputMd = args[++i] || 'dedup-report.md';
        break;
      case '--script':
        options.outputScript = args[++i] || 'dedup-delete.sh';
        break;
      case '--strategy':
        options.strategy = args[++i];
        break;
      case '--keep-per-hash':
        options.keepPerHash = parseInt(args[++i], 10);
        break;
      case '--keep-per-group':
        options.keepPerGroup = parseInt(args[++i], 10);
        break;
      case '--algorithm':
        options.algorithm = args[++i];
        break;
      case '--follow-symlinks':
        options.followSymlinks = true;
        break;
      case '--max-depth':
        options.maxDepth = parseInt(args[++i], 10);
        break;
      case '--min-size':
        options.minSize = parseSize(args[++i]);
        break;
      case '--ignore-extension':
        options.ignoreExtension = true;
        break;
      case '--case-insensitive':
        options.caseSensitive = false;
        break;
      case '--prefer-dir':
        options.preferDirectories.push(args[++i]);
        break;
      case '--exclude':
        options.excludePatterns.push(args[++i]);
        break;
      case '--include':
        options.includePatterns.push(args[++i]);
        break;
      case '--preserve':
        options.preservePatterns.push(args[++i]);
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--no-color':
        options.noColor = true;
        break;
      case '--concurrency':
        options.concurrency = parseInt(args[++i], 10);
        break;
      default:
        if (!arg.startsWith('-')) {
          options.directory = path.resolve(arg);
        }
    }
  }

  return options;
}

function parseSize(str) {
  const match = str.match(/^(\d+(?:\.\d+)?)\s*([kmgt]?b?)?$/i);
  if (!match) return parseInt(str, 10);
  
  const num = parseFloat(match[1]);
  const unit = (match[2] || 'b').toLowerCase();
  
  const multipliers = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024,
    'tb': 1024 * 1024 * 1024 * 1024,
  };
  
  return Math.floor(num * (multipliers[unit] || 1));
}

function printHelp() {
  console.log(`
📸 snapshot-dedup - 快照文件去重工具

用法:
  snapshot-dedup [目录] [选项]

选项:
  -h, --help                显示帮助信息
  -v, --version             显示版本号
  -d, --directory <path>    指定扫描目录 (默认: 当前目录)
  
  📤 输出选项:
    --json [path]           输出 JSON 结果文件 (默认: dedup-results.json)
    --md [path]             输出 Markdown 报告 (默认: dedup-report.md)
    --script [path]         生成 bash 删除脚本 (默认: dedup-delete.sh)
  
  🎯 保留策略:
    --strategy <name>       保留策略: newest(最新), oldest(最早), largest(最大), smallest(最小)
    --keep-per-hash <n>     每个哈希值保留多少个文件 (默认: 1)
    --keep-per-group <n>    每个分组最多保留多少个文件 (默认: 不限制)
  
  🔍 扫描选项:
    --algorithm <name>      哈希算法: sha256, sha1, md5 (默认: sha256)
    --follow-symlinks       跟随符号链接
    --max-depth <n>         最大扫描深度
    --min-size <size>       最小文件大小 (如: 100KB, 1MB)
    --ignore-extension      分组时忽略文件扩展名
    --case-insensitive      文件名大小写不敏感
    --concurrency <n>       哈希计算并发数 (默认: 4)
  
  📋 过滤选项:
    --prefer-dir <dir>      优先保留此目录下的文件 (可多次使用)
    --exclude <pattern>     排除匹配的文件/目录 (可多次使用)
    --include <pattern>     只处理匹配的文件 (可多次使用)
    --preserve <pattern>    必须保留的文件 (可多次使用)
  
  💬 其他:
    --verbose               显示详细信息
    --no-color              禁用彩色输出

示例:
  # 扫描当前目录，输出所有格式
  snapshot-dedup --json --md --script

  # 扫描备份目录，保留最旧文件，每个哈希保留2个
  snapshot-dedup ./backups --strategy oldest --keep-per-hash 2 --md

  # 优先保留 production 目录，排除 .tmp 文件
  snapshot-dedup ./snapshots --prefer-dir production --exclude .tmp --json
`);
}

function printVersion() {
  const pkg = require('../package.json');
  console.log(`snapshot-dedup v${pkg.version}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log(`\n📸 开始扫描: ${options.directory}\n`);

  try {
    // 1. 扫描目录
    process.stdout.write('🔍 扫描文件... ');
    const scanner = new Scanner({
      followSymlinks: options.followSymlinks,
      maxDepth: options.maxDepth,
      excludePatterns: options.excludePatterns,
      includePatterns: options.includePatterns,
      minSize: options.minSize,
    });
    const scanResult = await scanner.scan(options.directory);
    console.log(`找到 ${scanResult.stats.totalFiles} 个文件`);

    if (scanResult.stats.totalFiles === 0) {
      console.log('⚠️  没有找到任何文件');
      process.exit(0);
    }

    // 2. 计算哈希
    process.stdout.write('🧮 计算哈希值... ');
    const hasher = new Hasher({
      algorithm: options.algorithm,
      concurrency: options.concurrency,
    });
    let hashedCount = 0;
    const hashResult = await hasher.hashFiles(scanResult.files, (current, total) => {
      if (current % 10 === 0 || current === total) {
        process.stdout.write(`\r🧮 计算哈希值... ${current}/${total}`);
      }
    });
    console.log(` - 完成 ${hashResult.hashed.length} 个`);

    // 3. 同名分组
    process.stdout.write('📂 同名分组... ');
    const grouper = new Grouper({
      ignoreExtension: options.ignoreExtension,
      caseSensitive: options.caseSensitive,
    });
    const groupResult = grouper.groupFiles(hashResult.hashed);
    console.log(`找到 ${groupResult.stats.totalGroups} 个同名组`);

    // 4. 应用保留规则
    process.stdout.write('🎯 应用保留规则... ');
    const retention = new RetentionEngine({
      strategy: options.strategy,
      keepPerHash: options.keepPerHash,
      keepPerGroup: options.keepPerGroup,
      preferDirectories: options.preferDirectories,
      preservePatterns: options.preservePatterns,
    });
    const retentionResult = retention.applyRules(groupResult.groups);
    console.log(`建议删除 ${retentionResult.stats.filesToDelete} 个文件`);

    // 5. 生成报告
    console.log('\n📝 生成报告...');
    const reporter = new Reporter({
      color: !options.noColor,
      verbose: options.verbose,
    });

    const fullResults = reporter.generateAllResults(
      scanResult,
      hashResult,
      groupResult,
      retentionResult,
      {
        directory: options.directory,
        strategy: options.strategy,
        keepPerHash: options.keepPerHash,
      }
    );

    // 终端输出
    console.log(reporter.formatTerminal(fullResults));

    // 输出文件
    const outputFiles = [];
    
    if (options.outputJson) {
      const jsonPath = path.resolve(options.outputJson);
      await reporter.writeJson(fullResults, jsonPath);
      outputFiles.push(`JSON: ${jsonPath}`);
    }
    
    if (options.outputMd) {
      const mdPath = path.resolve(options.outputMd);
      await reporter.writeMarkdown(fullResults, mdPath);
      outputFiles.push(`Markdown: ${mdPath}`);
    }
    
    if (options.outputScript) {
      const scriptPath = path.resolve(options.outputScript);
      await reporter.writeDeleteScript(fullResults, scriptPath);
      outputFiles.push(`删除脚本: ${scriptPath}`);
    }

    if (outputFiles.length > 0) {
      console.log('📦 输出文件:');
      for (const file of outputFiles) {
        console.log(`   - ${file}`);
      }
      console.log('');
    }

    if (retentionResult.stats.filesToDelete > 0) {
      console.log('💡 提示: 请检查报告和脚本后再执行删除操作！');
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ 发生错误:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
