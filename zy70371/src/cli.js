#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const { scanDirectory, scanFile, findFilesRecursive, getFileInfo } = require('./scanner');
const StateManager = require('./stateManager');
const { printTerminalReport, printExplainReport, printAllRules, generateSummary, canPublish } = require('./reporter');

function printHelp() {
  console.log(`
${chalk.bold.magenta('本地 PII 扫描 CLI')}

${chalk.bold('用法:')}
  pii-scan <命令> [选项]

${chalk.bold('命令:')}
  scan <目录/文件>      扫描指定目录或文件
  explain <规则>        解释规则详情，可加 --test <文本> 测试
  ignore <命中ID>       忽略特定命中（可加原因和到期时间）
  rescan <目录>         增量复扫（仅扫描变更文件）
  report                查看上次扫描报告
  list-rules            列出所有识别规则
  help                  显示帮助信息

${chalk.bold('选项:')}
  --reason, -r <文本>   忽略原因（用于 ignore 命令）
  --expires, -e <天数>  忽略规则到期天数（默认 30 天，0 表示永不过期）
  --full                完整扫描，跳过增量（用于 rescan）
  --test <文本>         测试文本（用于 explain 命令）
  --json                输出 JSON 格式报告
  --verbose, -v         详细输出模式

${chalk.bold('示例:')}
  ${chalk.gray('# 扫描 test-data 目录')}
  pii-scan scan ./test-data

  ${chalk.gray('# 解释手机号规则并测试')}
  pii-scan explain phone --test "联系电话: 13812345678"

  ${chalk.gray('# 忽略误报，30天后到期')}
  pii-scan ignore a1b2c3d4e5f6 --reason "测试数据" --expires 30

  ${chalk.gray('# 增量复扫')}
  pii-scan rescan ./test-data

  ${chalk.gray('# 查看报告')}
  pii-scan report
`);
}

function parseArgs(args) {
  const result = {
    command: null,
    target: null,
    reason: null,
    expires: 30,
    testText: null,
    json: false,
    verbose: false,
    full: false
  };
  
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (!result.command) {
      result.command = arg;
      i++;
      continue;
    }
    
    if (arg === '--reason' || arg === '-r') {
      result.reason = args[i + 1];
      i += 2;
    } else if (arg === '--expires' || arg === '-e') {
      result.expires = parseInt(args[i + 1]) || 0;
      i += 2;
    } else if (arg === '--test') {
      result.testText = args[i + 1];
      i += 2;
    } else if (arg === '--json') {
      result.json = true;
      i++;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
      i++;
    } else if (arg === '--full') {
      result.full = true;
      i++;
    } else if (!result.target && !arg.startsWith('-')) {
      result.target = arg;
      i++;
    } else {
      i++;
    }
  }
  
  return result;
}

function resolveTargetPath(target) {
  if (!target) return null;
  return path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
}

async function handleScan(target, options) {
  const targetPath = resolveTargetPath(target);
  
  if (!targetPath) {
    console.log(chalk.red('❌ 请指定要扫描的目录或文件'));
    process.exit(1);
  }
  
  if (!fs.existsSync(targetPath)) {
    console.log(chalk.red('❌ 目标不存在: ' + targetPath));
    process.exit(1);
  }
  
  const baseDir = fs.statSync(targetPath).isDirectory() ? targetPath : path.dirname(targetPath);
  const stateManager = new StateManager(baseDir);
  
  console.log(chalk.bold.magenta('\n🔍 开始扫描...'));
  console.log(chalk.gray('  目标: ' + targetPath));
  
  let results;
  
  if (fs.statSync(targetPath).isFile()) {
    const fileResult = scanFile(targetPath);
    results = [fileResult];
  } else {
    results = scanDirectory(targetPath, stateManager);
  }
  
  stateManager.saveScanResults(results);
  
  console.log(chalk.green('  ✓ 扫描完成\n'));
  
  const report = printTerminalReport(results, stateManager);
  
  if (options.json) {
    const summary = generateSummary(results);
    console.log(JSON.stringify({
      summary,
      publishable: canPublish(summary),
      results
    }, null, 2));
  }
  
  process.exit(report.exitCode);
}

async function handleExplain(ruleName, options) {
  if (!ruleName) {
    printAllRules();
    return;
  }
  
  printExplainReport(ruleName, options.testText);
}

async function handleIgnore(matchId, options) {
  const baseDir = process.cwd();
  const stateManager = new StateManager(baseDir);
  
  if (!matchId) {
    console.log(chalk.red('❌ 请指定命中 ID'));
    const ignores = stateManager.getAllIgnores();
    if (ignores.length > 0) {
      console.log(chalk.yellow('\n当前忽略的命中:'));
      for (const ignore of ignores) {
        console.log('  - ' + ignore.matchId + ': ' + ignore.reason);
      }
    }
    process.exit(1);
  }
  
  if (!options.reason) {
    console.log(chalk.red('❌ 请使用 --reason 参数提供忽略原因'));
    process.exit(1);
  }
  
  stateManager.addIgnore(matchId, options.reason, options.expires);
  
  console.log(chalk.green('✓ 已添加忽略规则'));
  console.log('  命中 ID: ' + matchId);
  console.log('  原因: ' + options.reason);
  console.log('  到期: ' + (options.expires === 0 ? '永不过期' : options.expires + ' 天后'));
}

async function handleRescan(target, options) {
  const targetPath = resolveTargetPath(target);
  
  if (!targetPath) {
    console.log(chalk.red('❌ 请指定要扫描的目录'));
    process.exit(1);
  }
  
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
    console.log(chalk.red('❌ 目标必须是一个有效的目录'));
    process.exit(1);
  }
  
  const stateManager = new StateManager(targetPath);
  const lastInfo = stateManager.getLastScanInfo();
  
  console.log(chalk.bold.magenta('\n🔄 增量复扫'));
  
  const allFiles = findFilesRecursive(targetPath);
  
  let filesToScan = allFiles;
  
  if (!options.full && lastInfo.lastScanTime) {
    filesToScan = stateManager.getFilesNeedingScan(allFiles);
    console.log(chalk.gray('  上次扫描: ' + new Date(lastInfo.lastScanTime).toLocaleString('zh-CN')));
    console.log(chalk.gray('  需要扫描的文件: ' + filesToScan.length + '/' + allFiles.length));
  } else {
    console.log(chalk.gray('  执行完整扫描'));
  }
  
  if (filesToScan.length === 0) {
    console.log(chalk.green('\n✓ 没有文件需要重新扫描'));
    console.log(chalk.gray('使用 --full 选项强制完整扫描'));
    
    const savedResults = stateManager.getScanResults();
    if (savedResults.length > 0) {
      printTerminalReport(savedResults, stateManager);
    }
    return;
  }
  
  console.log(chalk.bold('\n🔍 扫描变更文件...'));
  
  const results = [];
  const ignoredIds = stateManager.getActiveIgnoreIds();
  const seenMatches = new Set();
  
  for (const filePath of filesToScan) {
    const fileResult = scanFile(filePath, ignoredIds, seenMatches);
    results.push(fileResult);
    if (options.verbose) {
      console.log('  ' + (fileResult.matches.length > 0 ? '⚠️  ' : '✓ ') + path.relative(targetPath, filePath));
    }
  }
  
  const previousResults = stateManager.getScanResults();
  const previousByFile = {};
  for (const result of previousResults) {
    previousByFile[result.filePath] = result;
  }
  
  const currentFiles = new Set(allFiles);
  const finalResults = [];
  
  for (const [filePath, oldResult] of Object.entries(previousByFile)) {
    if (!currentFiles.has(filePath)) continue;
    const newResult = results.find(r => r.filePath === filePath);
    finalResults.push(newResult || oldResult);
  }
  
  for (const result of results) {
    if (!finalResults.find(r => r.filePath === result.filePath)) {
      finalResults.push(result);
    }
  }
  
  stateManager.saveScanResults(finalResults);
  
  console.log(chalk.green('  ✓ 扫描完成\n'));
  
  const report = printTerminalReport(finalResults, stateManager);
  
  if (options.json) {
    const summary = generateSummary(finalResults);
    console.log(JSON.stringify({
      summary,
      publishable: canPublish(summary),
      results: finalResults,
      rescanInfo: {
        filesScanned: filesToScan.length,
        totalFiles: allFiles.length,
        wasFullScan: options.full || !lastInfo.lastScanTime
      }
    }, null, 2));
  }
  
  process.exit(report.exitCode);
}

async function handleReport(options) {
  const baseDir = process.cwd();
  const stateManager = new StateManager(baseDir);
  const results = stateManager.getScanResults();
  
  if (results.length === 0) {
    console.log(chalk.yellow('⚠️  没有找到历史扫描记录'));
    console.log('请先运行: pii-scan scan <目录>');
    process.exit(1);
  }
  
  if (options.json) {
    const summary = generateSummary(results);
    console.log(JSON.stringify({
      summary,
      publishable: canPublish(summary),
      results,
      ignores: stateManager.getAllIgnores(),
      resolved: stateManager.getAllResolved()
    }, null, 2));
    return;
  }
  
  printTerminalReport(results, stateManager);
}

async function handleListRules() {
  printAllRules();
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help') {
    printHelp();
    return;
  }
  
  const parsed = parseArgs(args);
  
  switch (parsed.command) {
    case 'scan':
      await handleScan(parsed.target, parsed);
      break;
    case 'explain':
      await handleExplain(parsed.target, parsed);
      break;
    case 'ignore':
      await handleIgnore(parsed.target, parsed);
      break;
    case 'rescan':
      await handleRescan(parsed.target, parsed);
      break;
    case 'report':
      await handleReport(parsed);
      break;
    case 'list-rules':
      await handleListRules();
      break;
    default:
      console.log(chalk.red('❌ 未知命令: ' + parsed.command));
      printHelp();
      process.exit(1);
  }
}

main().catch(err => {
  console.error(chalk.red('❌ 执行出错:'), err.message);
  console.error(err.stack);
  process.exit(1);
});
