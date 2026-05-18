#!/usr/bin/env node

import { parseTaskFile } from './parser.js';
import { validateTasks } from './validator.js';
import { summarizeTasks } from './summarizer.js';
import { generateReport } from './reporter.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  printUsage();
  process.exit(1);
}

const filePath = args[0];

try {
  console.log('\n📂 正在解析任务文件...\n');
  const parsedData = parseTaskFile(filePath);
  console.log(`✅ 解析完成，共读取 ${parsedData.tasks.length} 个任务\n`);
  
  console.log('🔍 正在校验业务规则...\n');
  const validatedData = validateTasks(parsedData);
  const retryableCount = validatedData.validationResults.filter(r => r.canRetry).length;
  const skippedCount = validatedData.validationResults.filter(r => !r.canRetry).length;
  console.log(`✅ 校验完成: ${retryableCount} 个可重试, ${skippedCount} 个需跳过\n`);
  
  console.log('📊 正在汇总生成重试规划...\n');
  const summary = summarizeTasks(validatedData, parsedData.tasks);
  
  const report = generateReport(summary);
  console.log(report);
  
} catch (error) {
  console.error('\n❌ 处理失败:');
  console.error(`   ${error.message}\n`);
  process.exit(1);
}

function printUsage() {
  console.log('\n🎬 转码任务失败重试规划 CLI\n');
  console.log('使用方法:');
  console.log('  node src/cli.js <任务文件路径>\n');
  console.log('示例:');
  console.log('  node src/cli.js samples/normal-tasks.json');
  console.log('  node src/cli.js samples/abnormal-tasks.json\n');
  console.log('项目示例文件已包含在 samples/ 目录下');
}
