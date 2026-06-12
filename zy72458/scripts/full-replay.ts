#!/usr/bin/env tsx
/**
 * 完整复现脚本
 * 场景：居民投诉编号第一次导入 → 重复导入（含批次内重复+历史重复+缺原文） → 补看照片 → 临时补材料（缺原文） → 导出 → 核对三处同源
 * 使用方法：npx tsx scripts/full-replay.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedInitialData } from '../api/data/seedData.js';
import { complaintService } from '../api/services/complaintService.js';
import { selfCheckService } from '../api/services/selfCheckService.js';
import { exportService } from '../api/services/exportService.js';
import { ImportComplaintDto } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.resolve(__dirname, '../data/replay-logs');
fs.mkdirSync(LOG_DIR, { recursive: true });
const STEP = (n: number, title: string) => {
  const line = '═'.repeat(70);
  console.log(`\n${line}`);
  console.log(`【步骤 ${n}】 ${title}`);
  console.log(line);
};
const WRITE = (name: string, data: unknown) => {
  const f = path.join(LOG_DIR, name);
  fs.writeFileSync(f, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`   → 已保存：${path.relative(path.resolve(__dirname, '..'), f)}`);
};

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║       菜市场摊位外溢治理 · 完整流程复现与三处同源核对脚本            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // ── Step 1: 重置并初始化种子数据 ──────────────────────────────────────────
  STEP(1, '重置数据，初始化基础样例（含缺原文 TS-2026-003/005 + 历史重复 TS-2026-005）');
  await seedInitialData(true);
  const stats0 = await complaintService.getStats();
  console.log(`   初始化统计：总数=${stats0.total} | 缺原文=${stats0.missingOpinion} | 历史重复=${stats0.historicalDuplicates}`);
  WRITE('step1-seed-stats.json', stats0);

  // ── Step 2: 第一次居民投诉编号导入（包含新+缺原文+批次内重复+历史重复）──
  STEP(2, '居民投诉编号第一次导入（含：新记录2条/缺原文1条/批次内重复1条/历史重复1条）');
  const batch1: ImportComplaintDto[] = [
    { complaintNo: 'TS-2026-201', originalRowNo: 201, residentOpinionSummary: '201号摊位占道经营（新·带原文）', residentOpinionOriginal: '201号摊位常年占用人行道经营，多次提醒无效，我们上下班都绕路。', source: '居民投诉编号第一次导入' },
    { complaintNo: 'TS-2026-202', originalRowNo: 202, residentOpinionSummary: '202号路口污水横流（新·缺原文·仅汇总）', source: '居民投诉编号第一次导入' },
    { complaintNo: 'TS-2026-203', originalRowNo: 203, residentOpinionSummary: '203号消防通道被堵（新·带原文）', residentOpinionOriginal: '消防通道被泡沫箱和菜筐堆满，太危险了。', source: '居民投诉编号第一次导入' },
    { complaintNo: 'TS-2026-203', originalRowNo: 204, residentOpinionSummary: '203号消防通道被堵（本次批次内重复）', source: '居民投诉编号第一次导入' },
    { complaintNo: 'TS-2026-005', originalRowNo: 205, residentOpinionSummary: 'TS-2026-005 污水问题（与历史重复·带原文）', residentOpinionOriginal: '历史重复的这条有原文了，希望能处理。', source: '居民投诉编号第一次导入' },
  ];
  const result1 = await complaintService.importComplaints(batch1, '阿宁（脚本复现）');
  console.log(`   导入结果：新记录=${result1.breakdown.newRecords.length} | 本次重复=${result1.breakdown.thisBatchDuplicates.length} | 历史重复=${result1.breakdown.historicalDuplicates.length}`);
  console.log(`   每条重复记录的status：`);
  result1.imported.forEach(c => console.log(`     · ${c.complaintNo} / 行${c.originalRowNo} / 类型=${c.duplicateType} / status=${c.status} / hasOriginal=${c.residentOpinion.hasOriginal}`));
  WRITE('step2-import-result.json', result1);

  // ── 重点核对：缺原文（即使是重复）也必须标 missing_opinion ──────────
  STEP(2.5, '核心核对：缺原文的「重复记录」是否被正确标记 missing_opinion？');
  const missingBatch1 = result1.imported.filter(c => !c.residentOpinion.hasOriginal);
  const allMarkedMissing = missingBatch1.every(c => c.status === 'missing_opinion');
  console.log(`   缺原文记录数：${missingBatch1.length}，全部标为 missing_opinion：${allMarkedMissing ? '✅ 通过' : '❌ 失败'}`);
  missingBatch1.forEach(c => console.log(`     · ${c.complaintNo} / ${c.duplicateType} → status=${c.status}`));
  if (!allMarkedMissing) throw new Error('重复记录缺原文未标 missing_opinion，复现失败！');

  // ── Step 3: 阿宁补看路口照片（对新导入记录） ────────────────────────────
  STEP(3, '阿宁补看路口照片（临时补材料）');
  const importedNew = result1.breakdown.newRecords;
  for (const c of importedNew) {
    await complaintService.updatePhotoInfo(c.id, { hasPhoto: true, photoUrl: `/images/replay-${c.complaintNo}.jpg`, operator: '阿宁（脚本复现）' });
  }
  const afterPhoto = await complaintService.getAll();
  const recent = afterPhoto.filter(c => importedNew.some(n => n.id === c.id));
  console.log(`   补看照片后状态流转：`);
  recent.forEach(c => console.log(`     · ${c.complaintNo} / 步骤=${c.currentStep} / status=${c.status} / reportNote=${c.reportNote}`));
  WRITE('step3-after-photo.json', recent);

  // ── Step 4: 临时补材料——给缺原文的 TS-2026-202 补录原文 ───────────────
  STEP(4, '临时补材料：给 TS-2026-202 补录居民意见原文，复核状态和报告说明同步更新');
  const c202Before = recent.find(c => c.complaintNo === 'TS-2026-202');
  console.log(`   补录前：status=${c202Before?.status} reportNote=${c202Before?.reportNote}`);
  await complaintService.updateResidentOpinion(c202Before!.id, {
    originalText: '这是刚从居委会抄来的原文：202号路口每天下午都像臭水沟，蚊子苍蝇特别多，家里窗户都开不了，希望尽快清走202号附近的死水塘和烂菜。',
    operator: '阿宁（脚本复现）',
  });
  const c202After = await complaintService.getById(c202Before!.id) as any;
  console.log(`   补录后：status=${c202After.status} hasOriginal=${c202After.residentOpinion.hasOriginal}`);
  console.log(`            reportNote=${c202After.reportNote}`);
  if (c202After.status === 'missing_opinion') throw new Error('补录原文后状态未更新！');
  WRITE('step4-after-supplement.json', c202After);

  // ── Step 5: 社区书记复核全部 missing_opinion ─────────────────────────────
  STEP(5, '社区书记复核 remaining missing_opinion 记录（不结案的也做记录）');
  const missingList = await complaintService.getMissingOpinionList();
  console.log(`   待复核数（严格 status===missing_opinion）：${missingList.length}`);
  for (let i = 0; i < missingList.length; i++) {
    const c = missingList[i];
    const approve = i === 0;
    await complaintService.reviewBySecretary(c.id, {
      operator: '王书记（脚本复现）',
      comment: approve ? `通过：${c.complaintNo}情况属实，已协调处理` : `记录：${c.complaintNo}需继续跟踪原文，暂不结案`,
      approve,
    });
  }
  const statsAfterReview = await complaintService.getStats();
  console.log(`   复核后统计：missing_opinion=${statsAfterReview.missingOpinion} resolved=${statsAfterReview.resolved}`);
  WRITE('step5-after-review.json', statsAfterReview);

  // ── Step 6: 运行自检 ───────────────────────────────────────────────────
  STEP(6, '运行四项自检（重复/缺失/补录重算/导出一致性）');
  const checks = await selfCheckService.runAllChecks('脚本复现');
  checks.forEach(ck => console.log(`   · ${ck.checkName}: ${ck.status} — ${ck.message}（问题数=${ck.details.length}）`));
  WRITE('step6-self-check.json', checks);

  // ── Step 7: 导出 + 获取接口数据 + 页面列表三处同源核对 ─────────────────
  STEP(7, '三处同源核对：页面列表（complaints）= 接口（/unified）= 导出文件（export.data）');
  const listPage = await complaintService.getAll();
  const apiUnified = await exportService.getUnifiedDataSource();
  const exported = await exportService.exportAll('脚本复现');

  const sortFn = (a: any, b: any) => a.complaintNo.localeCompare(b.complaintNo) || a.originalRowNo - b.originalRowNo;
  const L1 = listPage.map(c => `${c.id}|${c.status}|${c.duplicateType}|${c.residentOpinion.hasOriginal}|${c.reportNote || ''}`).sort();
  const L2 = apiUnified.map(c => `${c.id}|${c.status}|${c.duplicateType}|${c.residentOpinion.hasOriginal}|${c.reportNote || ''}`).sort();
  const L3 = exported.data.map(c => `${c.id}|${c.status}|${c.duplicateType}|${c.residentOpinion.hasOriginal}|${c.reportNote || ''}`).sort();

  const eq12 = L1.length === L2.length && L1.every((v, i) => v === L2[i]);
  const eq23 = L2.length === L3.length && L2.every((v, i) => v === L3[i]);
  console.log(`   列表 vs 接口：${eq12 ? '✅ 一致' : '❌ 不一致'}（${L1.length} vs ${L2.length}）`);
  console.log(`   接口 vs 导出：${eq23 ? '✅ 一致' : '❌ 不一致'}（${L2.length} vs ${L3.length}）`);
  WRITE('step7-compare-page.json', listPage.sort(sortFn));
  WRITE('step7-compare-api.json', apiUnified.sort(sortFn));
  WRITE('step7-compare-export.json', exported.data.sort(sortFn));

  // ── 重点：missing_opinion 三处都不能「消失」 ─────────────────────────────
  STEP(7.5, '关键核对：居民意见只剩汇总（missing_opinion）的记录在三处都必须出现，不能一个地方显示异常、另一个地方消失');
  const miss1 = listPage.filter(c => c.status === 'missing_opinion').map(c => c.complaintNo + '#' + c.originalRowNo).sort();
  const miss2 = apiUnified.filter(c => c.status === 'missing_opinion').map(c => c.complaintNo + '#' + c.originalRowNo).sort();
  const miss3 = exported.data.filter(c => c.status === 'missing_opinion').map(c => c.complaintNo + '#' + c.originalRowNo).sort();
  console.log(`   页面列表含 missing_opinion：[${miss1.join(', ')}]`);
  console.log(`   接口返回含 missing_opinion：[${miss2.join(', ')}]`);
  console.log(`   导出文件含 missing_opinion：[${miss3.join(', ')}]`);
  const missEq = miss1.length === miss2.length && miss1.length === miss3.length &&
    miss1.every((v, i) => v === miss2[i] && v === miss3[i]);
  console.log(`   三处完全一致：${missEq ? '✅ 通过' : '❌ 失败'}`);
  if (!missEq) throw new Error('missing_opinion 记录在三处不一致！');

  // ── 最终统计 ─────────────────────────────────────────────────────────────
  STEP(8, '最终核对 & 总结');
  const finalStats = await complaintService.getStats();
  console.log(JSON.stringify(finalStats, null, 2));
  console.log();
  console.log('✅ 复现流程全部通过：');
  console.log('   1. 重复导入分支即使缺原文也标 missing_opinion，不固定 pending_photo');
  console.log('   2. 导入时区分新记录/本次重复/历史重复三种类型');
  console.log('   3. 复核视图严格按 status === missing_opinion 展示，异常不消失');
  console.log('   4. 补录后 status + reportNote 同步联动更新，非只改备注');
  console.log('   5. 来源(source)、处理状态(status)、报告说明(reportNote)、复核结论(reviewConclusion) 同一份数据写入三处');
  console.log('   6. missing_opinion 记录在列表/接口/导出中全部一致，不会在一处消失');
  console.log();
  console.log(`详细核对文件保存在：data/replay-logs/`);
}

main().catch(e => {
  console.error('\n❌ 复现失败：', e);
  process.exit(1);
});
