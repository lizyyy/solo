#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const STATE_DIR = path.join(process.cwd(), '.batch-state');
const DEFAULT_BATCH_SIZE = 100;
const MAX_RETRIES = 3;

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

function log(message, color = 'white') {
  console.log(`${colors[color] || ''}${message}${colors.reset}`);
}

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

function getBatchPath(batchId) {
  return path.join(STATE_DIR, `${batchId}.json`);
}

function getBatchState(batchId) {
  const batchPath = getBatchPath(batchId);
  if (!fs.existsSync(batchPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(batchPath, 'utf-8'));
}

function saveBatchState(state) {
  ensureStateDir();
  const batchPath = getBatchPath(state.batchId);
  fs.writeFileSync(batchPath, JSON.stringify(state, null, 2), 'utf-8');
}

function parseLine(line, lineNumber, filename) {
  if (!line.trim()) {
    return { valid: false, error: '空行', line, lineNumber, filename };
  }
  
  let data;
  try {
    data = JSON.parse(line);
  } catch (e) {
    return { valid: false, error: 'JSON 格式错误: ' + e.message, line, lineNumber, filename };
  }
  
  if (!data.userId) {
    return { valid: false, error: '缺少主键 userId', data, line, lineNumber, filename };
  }
  
  return { valid: true, data, line, lineNumber, filename };
}

function validateRecord(data, existingUserIds) {
  if (existingUserIds.has(data.userId)) {
    return { valid: false, error: '重复用户ID: ' + data.userId };
  }
  if (data.points !== undefined && typeof data.points !== 'number') {
    return { valid: false, error: '积分必须是数字' };
  }
  if (data.amount !== undefined && typeof data.amount !== 'number') {
    return { valid: false, error: '金额必须是数字' };
  }
  return { valid: true };
}

async function processRecord(data) {
  if (Math.random() < 0.01) {
    throw new Error('模拟数据库连接超时');
  }
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  return {
    success: true,
    message: `成功写入: userId=${data.userId}, points=${data.points || 0}, amount=${data.amount || 0}`
  };
}

async function countFileLines(filePath) {
  return new Promise((resolve, reject) => {
    let count = 0;
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });
    
    rl.on('line', () => count++);
    rl.on('close', () => resolve(count));
    rl.on('error', reject);
  });
}

async function collectInputFiles(input) {
  const files = [];
  
  if (fs.statSync(input).isDirectory()) {
    const entries = fs.readdirSync(input).sort();
    for (const entry of entries) {
      const fullPath = path.join(input, entry);
      if (fs.statSync(fullPath).isFile() && entry.endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
  } else {
    files.push(input);
  }
  
  return files;
}

async function initializeBatch(input, batchId, options) {
  const inputPath = path.resolve(input);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`输入路径不存在: ${inputPath}`);
  }
  
  const files = await collectInputFiles(inputPath);
  if (files.length === 0) {
    throw new Error('未找到有效的 .jsonl 文件');
  }
  
  log(`发现 ${files.length} 个输入文件`, 'cyan');
  
  const fileMetadata = [];
  let totalLines = 0;
  
  for (const file of files) {
    const lineCount = await countFileLines(file);
    fileMetadata.push({
      filename: path.basename(file),
      path: file,
      totalLines: lineCount,
      processedLines: 0,
      status: 'pending'
    });
    totalLines += lineCount;
  }
  
  const state = {
    batchId,
    createdAt: new Date().toISOString(),
    inputPath,
    files: fileMetadata,
    totalLines,
    processedLines: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    currentFileIndex: 0,
    currentLineNumber: 0,
    batchSize: options.batchSize || DEFAULT_BATCH_SIZE,
    maxRetries: options.maxRetries || MAX_RETRIES,
    retries: 0,
    failures: [],
    processedUserIds: [],
    history: [{
      action: 'start',
      timestamp: new Date().toISOString(),
      message: '批次初始化完成'
    }],
    status: 'initialized'
  };
  
  saveBatchState(state);
  log(`批次 ${batchId} 创建成功，总计 ${totalLines} 行`, 'green');
  log(`状态文件: ${getBatchPath(batchId)}`, 'blue');
  
  return state;
}

async function processBatch(state, options = {}) {
  const { simulateInterruptAt = null } = options;
  let processedThisRun = 0;
  let successThisRun = 0;
  let failedThisRun = 0;
  let interruptTriggered = false;
  
  const existingUserIds = new Set(state.processedUserIds);
  
  log(`\n${colors.bold}开始处理批次: ${state.batchId}${colors.reset}`, 'cyan');
  log(`当前进度: 文件 ${state.currentFileIndex + 1}/${state.files.length}, 行 ${state.currentLineNumber}`, 'yellow');
  
  while (state.currentFileIndex < state.files.length && !interruptTriggered) {
    const currentFile = state.files[state.currentFileIndex];
    
    if (currentFile.status === 'completed') {
      state.currentFileIndex++;
      state.currentLineNumber = 0;
      continue;
    }
    
    log(`\n处理文件: ${currentFile.filename}`, 'blue');
    
    const fileStream = fs.createReadStream(currentFile.path);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let lineNumber = 0;
    
    for await (const line of rl) {
      lineNumber++;
      
      if (lineNumber <= state.currentLineNumber) {
        continue;
      }
      
      if (simulateInterruptAt !== null && 
          state.processedLines + processedThisRun >= simulateInterruptAt) {
        log(`\n${colors.red}模拟中断: 已处理 ${state.processedLines + processedThisRun} 行${colors.reset}`);
        interruptTriggered = true;
        break;
      }
      
      const parsed = parseLine(line, lineNumber, currentFile.filename);
      state.currentLineNumber = lineNumber;
      processedThisRun++;
      
      if (!parsed.valid) {
        failedThisRun++;
        state.failedCount++;
        state.failures.push({
          type: 'parse_error',
          ...parsed,
          timestamp: new Date().toISOString(),
          retryCount: 0,
          originalData: parsed.line
        });
        log(`  [${lineNumber}] 解析失败: ${parsed.error}`, 'red');
        continue;
      }
      
      const validation = validateRecord(parsed.data, existingUserIds);
      if (!validation.valid) {
        failedThisRun++;
        state.failedCount++;
        state.failures.push({
          type: 'validation_error',
          error: validation.error,
          data: parsed.data,
          line: parsed.line,
          lineNumber,
          filename: currentFile.filename,
          timestamp: new Date().toISOString(),
          retryCount: 0,
          originalData: parsed.line
        });
        log(`  [${lineNumber}] 验证失败: ${validation.error}`, 'yellow');
        continue;
      }
      
      try {
        const result = await processRecord(parsed.data);
        successThisRun++;
        state.successCount++;
        existingUserIds.add(parsed.data.userId);
        state.processedUserIds.push(parsed.data.userId);
        log(`  [${lineNumber}] ${result.message}`, 'green');
      } catch (e) {
        const failure = state.failures.find(f => 
          f.filename === currentFile.filename && f.lineNumber === lineNumber
        );
        
        if (failure) {
          failure.retryCount++;
          if (failure.retryCount >= state.maxRetries) {
            failedThisRun++;
            state.failedCount++;
            failure.error = e.message;
            log(`  [${lineNumber}] 重试 ${failure.retryCount} 次后仍然失败: ${e.message}`, 'red');
          } else {
            log(`  [${lineNumber}] 重试 (${failure.retryCount}/${state.maxRetries}): ${e.message}`, 'yellow');
            lineNumber--;
            continue;
          }
        } else {
          failedThisRun++;
          state.failedCount++;
          state.failures.push({
            type: 'processing_error',
            error: e.message,
            data: parsed.data,
            line: parsed.line,
            lineNumber,
            filename: currentFile.filename,
            timestamp: new Date().toISOString(),
            retryCount: 1,
            originalData: parsed.line
          });
          log(`  [${lineNumber}] 处理失败: ${e.message}`, 'red');
        }
      }
      
      if (processedThisRun % state.batchSize === 0) {
        state.processedLines += processedThisRun;
        currentFile.processedLines = lineNumber;
        saveBatchState(state);
        log(`\n${colors.magenta}进度保存: 已处理 ${state.processedLines}/${state.totalLines} 行${colors.reset}`);
      }
    }
    
    rl.close();
    
    if (!interruptTriggered) {
      currentFile.status = 'completed';
      currentFile.processedLines = lineNumber;
      state.currentFileIndex++;
      state.currentLineNumber = 0;
      log(`文件完成: ${currentFile.filename}`, 'green');
    }
  }
  
  state.processedLines += processedThisRun;
  state.history.push({
    action: interruptTriggered ? 'interrupt' : 'process',
    timestamp: new Date().toISOString(),
    processedThisRun,
    successThisRun,
    failedThisRun,
    message: interruptTriggered ? '处理被中断' : '本轮处理完成'
  });
  
  if (state.currentFileIndex >= state.files.length && state.failures.length === 0) {
    state.status = 'completed';
  } else if (interruptTriggered) {
    state.status = 'interrupted';
  } else if (state.failures.length > 0) {
    state.status = 'failed';
  } else {
    state.status = 'processing';
  }
  
  saveBatchState(state);
  
  log(`\n${colors.bold}本轮处理总结:${colors.reset}`, 'cyan');
  log(`  处理行数: ${processedThisRun}`, 'white');
  log(`  成功: ${successThisRun}`, 'green');
  log(`  失败: ${failedThisRun}`, 'red');
  
  return state;
}

function checkDuplicateBatch(inputPath, newBatchId) {
  ensureStateDir();
  const files = fs.readdirSync(STATE_DIR);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    const batchId = file.replace('.json', '');
    if (batchId === newBatchId) continue;
    
    const state = getBatchState(batchId);
    if (state && state.inputPath === inputPath) {
      return state;
    }
  }
  
  return null;
}

function printStatus(state) {
  log(`\n${colors.bold}批次状态: ${state.batchId}${colors.reset}`, 'cyan');
  log(`  状态: ${state.status}`, state.status === 'completed' ? 'green' : state.status === 'failed' ? 'red' : 'yellow');
  log(`  创建时间: ${state.createdAt}`, 'white');
  log(`  输入: ${state.inputPath}`, 'white');
  log(`  总进度: ${state.processedLines}/${state.totalLines} 行 (${Math.round(state.processedLines / state.totalLines * 100)}%)`, 'yellow');
  log(`  成功: ${state.successCount}`, 'green');
  log(`  失败: ${state.failedCount}`, 'red');
  log(`  处理用户数: ${state.processedUserIds.length}`, 'blue');
  
  log(`\n${colors.bold}文件进度:${colors.reset}`, 'cyan');
  for (const file of state.files) {
    const percent = Math.round(file.processedLines / file.totalLines * 100);
    const statusColor = file.status === 'completed' ? 'green' : file.status === 'processing' ? 'yellow' : 'white';
    log(`  [${file.status}] ${file.filename}: ${file.processedLines}/${file.totalLines} 行 (${percent}%)`, statusColor);
  }
  
  log(`\n${colors.bold}历史记录:${colors.reset}`, 'cyan');
  for (const entry of state.history) {
    const actionColor = entry.action === 'interrupt' ? 'red' : entry.action === 'resume' ? 'yellow' : 'green';
    log(`  [${entry.timestamp}] ${entry.action}: ${entry.message}`, actionColor);
  }
}

function printFailures(state, limit = 50) {
  if (state.failures.length === 0) {
    log('没有失败记录', 'green');
    return;
  }
  
  log(`\n${colors.bold}失败记录 (共 ${state.failures.length} 条):${colors.reset}`, 'red');
  
  const toShow = state.failures.slice(0, limit);
  for (const failure of toShow) {
    log(`\n  [${failure.type}] ${failure.filename}:${failure.lineNumber}`, 'yellow');
    log(`    错误: ${failure.error}`, 'red');
    log(`    原始数据: ${failure.originalData}`, 'white');
    log(`    时间: ${failure.timestamp}`, 'white');
    if (failure.retryCount > 0) {
      log(`    重试次数: ${failure.retryCount}`, 'yellow');
    }
    if (failure.repairedData) {
      log(`    已修复数据: ${JSON.stringify(failure.repairedData)}`, 'green');
    }
  }
  
  if (state.failures.length > limit) {
    log(`\n... 还有 ${state.failures.length - limit} 条失败记录`, 'yellow');
  }
}

function printReport(state) {
  const totalAttempted = state.successCount + state.failedCount;
  const successRate = totalAttempted > 0 ? Math.round(state.successCount / totalAttempted * 100) : 0;
  
  log(`\n${colors.bold}${'='.repeat(60)}${colors.reset}`, 'cyan');
  log(`${colors.bold}          批处理执行报告${colors.reset}`, 'cyan');
  log(`${colors.bold}${'='.repeat(60)}${colors.reset}`, 'cyan');
  
  log(`\n${colors.bold}基本信息:${colors.reset}`, 'cyan');
  log(`  批次ID: ${state.batchId}`, 'white');
  log(`  状态: ${state.status}`, state.status === 'completed' ? 'green' : state.status === 'failed' ? 'red' : 'yellow');
  log(`  输入: ${state.inputPath}`, 'white');
  log(`  创建时间: ${state.createdAt}`, 'white');
  
  log(`\n${colors.bold}处理统计:${colors.reset}`, 'cyan');
  log(`  总行数: ${state.totalLines}`, 'white');
  log(`  已处理: ${state.processedLines}`, 'yellow');
  log(`  成功: ${state.successCount}`, 'green');
  log(`  失败: ${state.failedCount}`, 'red');
  log(`  成功率: ${successRate}%`, successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red');
  log(`  唯一用户数: ${new Set(state.processedUserIds).size}`, 'blue');
  
  log(`\n${colors.bold}执行历史:${colors.reset}`, 'cyan');
  for (const entry of state.history) {
    const actionColor = entry.action === 'interrupt' ? 'red' : entry.action === 'resume' ? 'yellow' : 'green';
    let details = entry.message;
    if (entry.processedThisRun !== undefined) {
      details += ` (处理:${entry.processedThisRun}, 成功:${entry.successThisRun}, 失败:${entry.failedThisRun})`;
    }
    log(`  [${entry.timestamp}] ${entry.action}: ${details}`, actionColor);
  }
  
  if (state.failures.length > 0) {
    log(`\n${colors.bold}失败详情:${colors.reset}`, 'red');
    const byType = {};
    for (const failure of state.failures) {
      byType[failure.type] = (byType[failure.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(byType)) {
      log(`  ${type}: ${count} 条`, 'white');
    }
  }
  
  const consistency = state.processedLines === state.totalLines && 
                      state.successCount + state.failedCount === state.processedLines;
  log(`\n${colors.bold}数据一致性检查:${colors.reset}`, 'cyan');
  log(`  总行数匹配: ${consistency ? '是' : '否'}`, consistency ? 'green' : 'red');
  
  if (!consistency) {
    log(`  差异: 总(${state.totalLines}) - 已处理(${state.processedLines}) = ${state.totalLines - state.processedLines}`, 'yellow');
  }
}

async function repairFailures(state, repairs) {
  let repairedCount = 0;
  
  for (const repair of repairs) {
    const failure = state.failures.find(f => 
      f.filename === repair.filename && f.lineNumber === repair.lineNumber
    );
    
    if (!failure) {
      log(`未找到失败记录: ${repair.filename}:${repair.lineNumber}`, 'yellow');
      continue;
    }
    
    if (!repair.newData) {
      log(`跳过 ${repair.filename}:${repair.lineNumber} - 未提供修复数据`, 'yellow');
      continue;
    }
    
    log(`\n修复 ${repair.filename}:${repair.lineNumber}`, 'cyan');
    log(`  原始错误: ${failure.error}`, 'red');
    log(`  原始数据: ${failure.originalData}`, 'white');
    log(`  修复数据: ${JSON.stringify(repair.newData)}`, 'green');
    
    failure.repairedData = repair.newData;
    failure.repairedAt = new Date().toISOString();
    repairedCount++;
  }
  
  saveBatchState(state);
  log(`\n修复完成: ${repairedCount}/${repairs.length} 条记录已修复`, 'green');
  
  return state;
}

async function processRepairedFailures(state) {
  const toRetry = state.failures.filter(f => f.repairedData && !f.processed);
  
  if (toRetry.length === 0) {
    log('没有需要重试的修复记录', 'yellow');
    return state;
  }
  
  log(`\n重试 ${toRetry.length} 条已修复记录`, 'cyan');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const failure of toRetry) {
    log(`\n重试 ${failure.filename}:${failure.lineNumber}`, 'yellow');
    log(`  修复数据: ${JSON.stringify(failure.repairedData)}`, 'white');
    
    try {
      const result = await processRecord(failure.repairedData);
      successCount++;
      state.successCount++;
      state.failedCount--;
      failure.processed = true;
      failure.processedAt = new Date().toISOString();
      log(`  成功: ${result.message}`, 'green');
    } catch (e) {
      failCount++;
      failure.error = e.message;
      log(`  仍然失败: ${e.message}`, 'red');
    }
  }
  
  const remainingFailures = state.failures.filter(f => !f.processed);
  if (remainingFailures.length === 0 && state.status === 'failed') {
    state.status = 'completed';
  }
  
  state.history.push({
    action: 'repair',
    timestamp: new Date().toISOString(),
    successCount,
    failCount,
    message: `重试 ${toRetry.length} 条修复记录，成功 ${successCount}，失败 ${failCount}`
  });
  
  saveBatchState(state);
  log(`\n重试完成: 成功 ${successCount}, 失败 ${failCount}`, successCount === toRetry.length ? 'green' : 'yellow');
  
  return state;
}

function parseArgs(args) {
  const command = args[2];
  const options = {};
  
  for (let i = 3; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        options[key] = args[i + 1];
        i++;
      } else {
        options[key] = true;
      }
    }
  }
  
  return { command, options };
}

async function main() {
  const { command, options } = parseArgs(process.argv);
  
  try {
    switch (command) {
      case 'start': {
        if (!options.input) {
          throw new Error('缺少 --input 参数');
        }
        if (!options.batchId) {
          throw new Error('缺少 --batchId 参数');
        }
        
        const inputPath = path.resolve(options.input);
        const existingBatch = checkDuplicateBatch(inputPath, options.batchId);
        
        if (existingBatch) {
          log(`\n${colors.red}警告: 检测到相同输入已有批次记录${colors.reset}`, 'red');
          log(`  现有批次: ${existingBatch.batchId}`, 'yellow');
          log(`  状态: ${existingBatch.status}`, 'yellow');
          log(`  已处理: ${existingBatch.processedLines}/${existingBatch.totalLines} 行`, 'yellow');
          log(`\n继续使用新批次可能导致重复处理！`, 'red');
          log(`建议使用: batch resume --batchId ${existingBatch.batchId}`, 'cyan');
          return;
        }
        
        let state = await initializeBatch(options.input, options.batchId, options);
        state = await processBatch(state, {
          simulateInterruptAt: options.simulateInterrupt ? parseInt(options.simulateInterrupt) : null
        });
        printReport(state);
        break;
      }
      
      case 'resume': {
        if (!options.batchId) {
          throw new Error('缺少 --batchId 参数');
        }
        
        const state = getBatchState(options.batchId);
        if (!state) {
          throw new Error(`批次不存在: ${options.batchId}`);
        }
        
        log(`续跑批次: ${options.batchId}`, 'cyan');
        state.history.push({
          action: 'resume',
          timestamp: new Date().toISOString(),
          message: `从 ${state.processedLines}/${state.totalLines} 恢复`
        });
        saveBatchState(state);
        
        const finalState = await processBatch(state, {
          simulateInterruptAt: options.simulateInterrupt ? parseInt(options.simulateInterrupt) : null
        });
        printReport(finalState);
        break;
      }
      
      case 'status': {
        if (!options.batchId) {
          throw new Error('缺少 --batchId 参数');
        }
        
        const state = getBatchState(options.batchId);
        if (!state) {
          throw new Error(`批次不存在: ${options.batchId}`);
        }
        
        printStatus(state);
        break;
      }
      
      case 'failures': {
        if (!options.batchId) {
          throw new Error('缺少 --batchId 参数');
        }
        
        const state = getBatchState(options.batchId);
        if (!state) {
          throw new Error(`批次不存在: ${options.batchId}`);
        }
        
        printFailures(state, options.limit ? parseInt(options.limit) : 50);
        break;
      }
      
      case 'repair': {
        if (!options.batchId) {
          throw new Error('缺少 --batchId 参数');
        }
        
        const state = getBatchState(options.batchId);
        if (!state) {
          throw new Error(`批次不存在: ${options.batchId}`);
        }
        
        if (options.file) {
          const repairFile = path.resolve(options.file);
          if (!fs.existsSync(repairFile)) {
            throw new Error(`修复文件不存在: ${repairFile}`);
          }
          
          const repairs = JSON.parse(fs.readFileSync(repairFile, 'utf-8'));
          const repairedState = await repairFailures(state, repairs);
          
          if (options.retry) {
            await processRepairedFailures(repairedState);
          }
        } else {
          log('使用 --file 参数指定修复文件', 'yellow');
          log('修复文件格式: [{ filename, lineNumber, newData: {...} }]', 'cyan');
          printFailures(state, 10);
        }
        break;
      }
      
      case 'report': {
        if (!options.batchId) {
          throw new Error('缺少 --batchId 参数');
        }
        
        const state = getBatchState(options.batchId);
        if (!state) {
          throw new Error(`批次不存在: ${options.batchId}`);
        }
        
        printReport(state);
        
        if (options.output) {
          const outputPath = path.resolve(options.output);
          fs.writeFileSync(outputPath, JSON.stringify(state, null, 2), 'utf-8');
          log(`\n报告已保存到: ${outputPath}`, 'green');
        }
        break;
      }
      
      case 'list': {
        ensureStateDir();
        const files = fs.readdirSync(STATE_DIR);
        
        if (files.length === 0) {
          log('没有找到批次记录', 'yellow');
          return;
        }
        
        log(`\n${colors.bold}批次列表:${colors.reset}`, 'cyan');
        for (const file of files.sort()) {
          if (!file.endsWith('.json')) continue;
          const batchId = file.replace('.json', '');
          const state = getBatchState(batchId);
          if (state) {
            const statusColor = state.status === 'completed' ? 'green' : state.status === 'failed' ? 'red' : 'yellow';
            log(`  ${batchId} - ${state.status} - ${state.inputPath}`, statusColor);
            log(`    创建: ${state.createdAt}`, 'white');
            log(`    进度: ${state.processedLines}/${state.totalLines} 行`, 'white');
          }
        }
        break;
      }
      
      default: {
        log(`\n${colors.bold}批处理断点续跑 CLI${colors.reset}`, 'cyan');
        log(`\n命令列表:`, 'yellow');
        log(`  start    --input <路径> --batchId <ID> [--batchSize N] [--maxRetries N] [--simulateInterrupt N]`, 'white');
        log(`  resume   --batchId <ID> [--simulateInterrupt N]`, 'white');
        log(`  status   --batchId <ID>`, 'white');
        log(`  failures --batchId <ID> [--limit N]`, 'white');
        log(`  repair   --batchId <ID> --file <修复文件> [--retry]`, 'white');
        log(`  report   --batchId <ID> [--output <路径>]`, 'white');
        log(`  list`, 'white');
        log(`\n示例:`, 'cyan');
        log(`  batch start --input ./data --batchId batch-001 --simulateInterrupt 150`, 'white');
        log(`  batch status --batchId batch-001`, 'white');
        log(`  batch resume --batchId batch-001`, 'white');
        break;
      }
    }
  } catch (e) {
    log(`错误: ${e.message}`, 'red');
    console.error(e.stack);
    process.exit(1);
  }
}

main();
