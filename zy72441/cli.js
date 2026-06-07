#!/usr/bin/env node

const SynthPresetComparator = require('./lib/comparator');

const comparator = new SynthPresetComparator();
const args = process.argv.slice(2);
const command = args[0];

function printHeader() {
  console.log('');
  console.log('🎹 合成器预设版本比较工具');
  console.log('   琴行店长老周 & 录音师专用');
  console.log('');
}

function printHelp() {
  printHeader();
  console.log('用法:');
  console.log('  node cli.js list                - 查看所有批次');
  console.log('  node cli.js review              - 查看待复核的批次（混批等）');
  console.log('  node cli.js show <批次ID>        - 查看批次详情和操作记录');
  console.log('  node cli.js run-demo            - 跑一遍完整演示流程（给新人讲流程用）');
  console.log('  node cli.js add-notes <批次ID> <留言内容>');
  console.log('                                - 补录调音师留言');
  console.log('  node cli.js import <JSON文件路径>');
  console.log('                                - 导入授权期限页');
  console.log('  node cli.js correct <批次ID> <修正说明>');
  console.log('                                - 人工修正');
  console.log('  node cli.js rerun <批次ID>      - 重跑比较逻辑');
  console.log('');
}

function cmdList() {
  printHeader();
  const batches = comparator.getAllBatches();
  console.log(`共 ${batches.length} 个批次:\n`);
  batches.forEach(batch => {
    console.log(comparator.formatBatchSummary(batch));
    console.log('');
  });
}

function cmdReview() {
  printHeader();
  const pending = comparator.getBatchesNeedingReview();
  if (pending.length === 0) {
    console.log('✅ 目前没有待复核的批次，放心下班！');
    return;
  }
  console.log(`⚠️  有 ${pending.length} 个批次需要录音师复核:\n`);
  pending.forEach(batch => {
    console.log(comparator.formatBatchSummary(batch));
    console.log('');
  });
  console.log('👉 这些混批别着急归正常，留给录音师确认。');
}

function cmdShow(batchId) {
  printHeader();
  const batch = comparator.getBatch(batchId);
  if (!batch) {
    console.log(`❌ 找不到批次: ${batchId}`);
    return;
  }
  console.log(comparator.formatBatchSummary(batch));
  console.log('');
  console.log(comparator.formatHistory(batch));
  console.log('');
}

function cmdAddNotes(batchId, notes) {
  printHeader();
  try {
    const batch = comparator.addEngineerNotes(batchId, notes);
    console.log(`✅ 已补录调音师留言到批次 ${batchId}`);
    console.log('');
    console.log(comparator.formatBatchSummary(batch));
    console.log('');
    console.log('👉 授权提醒已根据留言自动更新。');
  } catch (e) {
    console.log(`❌ 操作失败: ${e.message}`);
  }
}

function cmdCorrect(batchId, correction) {
  printHeader();
  try {
    const batch = comparator.manualCorrect(batchId, correction);
    console.log(`✅ 已记录人工修正到批次 ${batchId}`);
    console.log('');
    console.log(comparator.formatHistory(batch));
    console.log('');
  } catch (e) {
    console.log(`❌ 操作失败: ${e.message}`);
  }
}

function cmdRerun(batchId) {
  printHeader();
  try {
    const batch = comparator.rerunComparison(batchId);
    console.log(`✅ 已重跑批次 ${batchId} 的比较逻辑`);
    console.log('');
    console.log(comparator.formatBatchSummary(batch));
    console.log('');
  } catch (e) {
    console.log(`❌ 操作失败: ${e.message}`);
  }
}

function cmdRunDemo() {
  printHeader();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📚 演示：老周给新人讲完整流程');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const batches = comparator.getAllBatches();

  console.log('【第一步：导入授权期限页】');
  console.log('老周："新人你看，先把授权期限页导进来，系统会自动分析。"');
  console.log('');
  console.log('导入成功的有这几个批次：');
  batches.forEach(b => {
    console.log(`  • ${b.id} - ${b.name}`);
  });
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('【第二步：看系统自动分析结果】');
  console.log('老周："重点来了，系统会标出不同情况："');
  console.log('');

  const normal = batches.find(b => b.id === 'BATCH-2024-001');
  const mixed = batches.find(b => b.id === 'BATCH-2024-002');
  const amended = batches.find(b => b.id === 'BATCH-2024-003');

  console.log('✅ 第一种：顺利的，纯售票，直接过');
  console.log(comparator.formatBatchSummary(normal));
  console.log('');
  console.log('老周："像这个星空乐队的，120张全是售票，系统自动校验，没问题。"');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('⚠️  第二种：赠票和售票混在一个批次');
  console.log(comparator.formatBatchSummary(mixed));
  console.log('');
  console.log(comparator.formatHistory(mixed));
  console.log('');
  console.log('老周："这个大学城的就是典型混批！30张赠票+50张售票。"');
  console.log('老周："记住，碰到这种别着急归正常！留给录音师复核。"');
  console.log('老周："晚上录音师催结果，你就翻这儿给他看，说还等你确认呢。"');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📝 第三种：补录调音师留言，旧口径修正');
  console.log(comparator.formatBatchSummary(amended));
  console.log('');
  console.log(comparator.formatHistory(amended));
  console.log('');
  console.log('老周："这个老街酒吧的，一开始导入60张全算售票。"');
  console.log('老周："后来我翻到调音师阿凯的留言，说20张是内部招待，旧口径不计入。"');
  console.log('老周："补录完留言，系统自动更新授权提醒，你看现在余量就充足了。"');
  console.log('老周："这里面有一次人工修正，一次重跑，流程都留痕了。"');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('【老周总结】');
  console.log('老周："就这三步：导入→看混批标记→补录留言更新提醒。"');
  console.log('老周："混批别乱点确认，等录音师说话，出了问题他担着。"');
  console.log('老周："操作记录都留着，哪天对账翻出来都能说清楚。"');
  console.log('');
  console.log('✅ 演示完毕，新人你试试？');
  console.log('');
}

switch (command) {
  case 'list':
    cmdList();
    break;
  case 'review':
    cmdReview();
    break;
  case 'show':
    cmdShow(args[1]);
    break;
  case 'add-notes':
    cmdAddNotes(args[1], args.slice(2).join(' '));
    break;
  case 'correct':
    cmdCorrect(args[1], args.slice(2).join(' '));
    break;
  case 'rerun':
    cmdRerun(args[1]);
    break;
  case 'run-demo':
    cmdRunDemo();
    break;
  case 'help':
  default:
    printHelp();
}
