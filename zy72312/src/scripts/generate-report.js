#!/usr/bin/env node
/**
 * 凸包围栏面积复核 - 独立报告导出脚本
 *
 * 可直接运行：node src/scripts/generate-report.js [studentId]
 * 或通过 package.json 调用：npm run report [-- studentId]
 *
 * 功能：
 * 1. 读取已持久化的复核记录（从 data/ 目录）
 * 2. 生成与正式报告文本完全一致的内容
 * 3. 支持按学生ID筛选、导出到文件、批量导出
 * 4. 输出同一条保存后的最新复核结果
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { dataStore } from '../models/index.js';
import { generateReport, generateReportSummary } from '../review/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flags = {
  student: null,
  output: null,
  format: 'text',
  all: false,
  latest: false
};

// 解析参数
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-o' || a === '--output') flags.output = args[++i];
  else if (a === '-s' || a === '--student') flags.student = args[++i];
  else if (a === '-a' || a === '--all') flags.all = true;
  else if (a === '-l' || a === '--latest') flags.latest = true;
  else if (a === '--json') flags.format = 'json';
  else if (a === '--text') flags.format = 'text';
  else if (!a.startsWith('-') && !flags.student) flags.student = a;
}

function usage() {
  console.log(`
凸包围栏面积复核 - 报告生成器

用法:
  node src/scripts/generate-report.js [options]

选项:
  -s, --student <id>     按学生ID筛选 (如 S004)
  -o, --output <file>    导出到文件 (默认输出到 stdout)
  -a, --all              导出所有记录
  -l, --latest           只导出最新的一条
      --json             JSON 格式输出
      --text             文本格式输出 (默认)

示例:
  npm run report                    # 查看最新记录的报告
  npm run report -- S004            # 查看 S004 的报告
  npm run report -- -a -o all.txt   # 导出所有记录到 all.txt
  npm run report -- S004 --json     # S004 的 JSON 格式报告
`);
}

// ========== 主逻辑 ==========
(async function main() {
  if (args.includes('-h') || args.includes('--help')) {
    usage();
    process.exit(0);
  }

  // 1. 读取已持久化的数据（关键：必须是同一份保存后的结果）
  dataStore.loadFromFiles();
  const allRecords = dataStore.getAllReviewRecords();

  if (allRecords.length === 0) {
    console.error('⚠️  没有找到任何复核记录。请先运行：');
    console.error('   npm run demo     或');
    console.error('   npm run cli -- import data/sample-student-answers.json && npm run review');
    process.exit(1);
  }

  // 2. 筛选目标记录
  let targetRecords = [];

  if (flags.all) {
    targetRecords = [...allRecords];
  } else if (flags.student) {
    targetRecords = allRecords.filter(r => r.studentId === flags.student);
    if (targetRecords.length === 0) {
      console.error(`⚠️  未找到学生 ${flags.student} 的复核记录。可用学生：`);
      const students = [...new Set(allRecords.map(r => r.studentId))].join(', ');
      console.error(`   ${students}`);
      process.exit(1);
    }
  } else if (flags.latest) {
    targetRecords = [allRecords[allRecords.length - 1]];
  } else {
    // 默认：如果只有一条则用那一条；否则列出让用户选
    if (allRecords.length === 1) {
      targetRecords = [allRecords[0]];
    } else {
      console.log(`📋 现有 ${allRecords.length} 条复核记录，请指定 --student 或 --all：\n`);
      allRecords.forEach(r => {
        const manual = r.manualExample ? '✓' : '✗';
        const quest = r.questionnaire ? '✓' : '✗';
        console.log(`  ${r.studentId}  status=${r.status}  next=${r.nextStep}  手算${manual} 问卷${quest}`);
      });
      console.log(`\n示例: npm run report -- S004`);
      process.exit(0);
    }
  }

  // 3. 生成报告
  const outputs = [];
  const summaries = [];

  for (const rec of targetRecords) {
    const rpt = generateReport(rec.id);
    outputs.push(rpt);
    summaries.push({
      studentId: rec.studentId,
      answerId: rec.answerId,
      status: rec.status,
      assignedTo: rec.assignedTo,
      hasManual: !!rec.manualExample,
      hasQuestionnaire: !!rec.questionnaire,
      nextStep: rec.nextStep,
      problemEdgeCount: rec.geometryAnalysis?.problemEdges?.length || 0
    });
  }

  // 4. 输出
  const textOutput = outputs.map(o => o.humanReport).join('\n\n\n');
  const jsonOutput = outputs.map(o => ({
    record: o.record,
    summary: o.summary
  }));

  let finalOutput = flags.format === 'json'
    ? JSON.stringify(jsonOutput.length === 1 ? jsonOutput[0] : jsonOutput, null, 2)
    : textOutput;

  if (flags.output) {
    const outPath = path.resolve(flags.output);
    fs.writeFileSync(outPath, finalOutput, 'utf-8');
    const size = Buffer.byteLength(finalOutput, 'utf-8');
    console.log(`✅ 已导出 ${targetRecords.length} 份报告到 ${path.relative(process.cwd(), outPath)}`);
    console.log(`   格式: ${flags.format.toUpperCase()}  大小: ${size} 字节`);
    console.log();
    summaries.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.studentId} ${s.answerId}  status=${s.status}  next=${s.nextStep}`);
    });
  } else {
    // 控制台输出：文本格式带装饰，JSON 格式直接输出
    if (flags.format === 'json') {
      console.log(finalOutput);
    } else {
      console.log();
      console.log('📄 凸包围栏面积复核 · 正式报告');
      console.log('   数据来源：已持久化的复核记录（data/review-records.json）');
      console.log(`   生成时间：${new Date().toISOString().substring(0, 19)}`);
      console.log(`   记录数：${targetRecords.length}`);
      console.log('═'.repeat(70));
      console.log();
      console.log(finalOutput);
      console.log();
      console.log('═'.repeat(70));
      console.log(`💡 导出到文件：npm run report -- ${flags.student || '-a'} -o <file>`);
    }
  }
})().catch(err => {
  console.error('❌ 生成报告失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});
