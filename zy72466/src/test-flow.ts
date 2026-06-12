import * as fs from 'fs';
import * as path from 'path';
import {
  ImportService,
  ComplaintLinkService,
  HeatmapService,
  UnifiedDataService,
  StatusManager,
  dataStore,
  ComplaintStatus,
  ImportRowData,
  OperationType,
} from './index';

type AssertFn = (cond: unknown, msg: string) => asserts cond;
const assert: AssertFn = (cond, msg) => {
  if (!cond) {
    throw new Error(`❌ 断言失败: ${msg}`);
  }
  console.log(`✅ ${msg}`);
};

const pass = (title: string) =>
  console.log(`\n========================================\n【${title}】\n----------------------------------------`);

async function main() {
  console.log('\n========== 垃圾投放点异味投诉 - 端到端回归测试 ==========\n');

  dataStore.clearAll();

  const importRows: ImportRowData[] = [
    { rowNumber: 3, pointId: 'P0001', pointName: '阳光花园北区投放点',
      address: '阳光路88号', district: '东城区', street: '和平街道',
      lng: '116.4074', lat: '39.9042' },
    { rowNumber: 7, pointId: 'P0002', pointName: '幸福里小区投放点',
      address: '幸福街12号', district: '东城区', street: '和平街道',
      lng: '116.4174', lat: '39.9142' },
    { rowNumber: 12, pointId: 'P0003', pointName: '新华社区投放点',
      address: '新华大道56号', district: '西城区', street: '新华街道',
      lng: '116.3974', lat: '39.8942' },
  ];

  // ============== 场景1: 夜间采样点导入 ==============
  pass('场景1: 夜间采样点导入（保留原始行号）');
  const { success, failed } = ImportService.batchImport(importRows, '夜间巡查员-小李');
  assert(success.length === 3, `导入成功 3 条记录（实际 ${success.length}）`);
  assert(failed.length === 0, `导入失败 0 条（实际 ${failed.length}）`);

  const [rec1, rec2, rec3] = success;
  assert(rec1.originalRowNumber === 3, `P0001 原始行号=3（实际${rec1.originalRowNumber}）`);
  assert(rec2.originalRowNumber === 7, `P0002 原始行号=7（实际${rec2.originalRowNumber}）`);
  assert(rec3.originalRowNumber === 12, `P0003 原始行号=12（实际${rec3.originalRowNumber}）`);

  const importLog = rec1.statusLogs[0];
  assert(importLog.operationType === OperationType.IMPORT, '导入日志类型正确');
  assert(importLog.diff['samplingPoint.pointId']?.after === 'P0001',
    '导入diff记录pointId变化');
  console.log('导入diff关键字段:', Object.keys(importLog.diff).slice(0, 5));

  // ============== 场景2: 交通协管老马关联投诉编号 ==============
  pass('场景2: 交通协管老马关联投诉编号');
  let r1 = ComplaintLinkService.linkComplaint(
    rec1.id,
    {
      complaintId: 'TS-20260601',
      complaintTime: '2026-06-01 19:30:00',
      complaintContent: '夜间垃圾投放点异味严重，影响休息',
      complainant: '张女士',
      complainantPhone: '138****1234',
      remark: '连续三天晚上都有异味',
    },
    '交通协管-老马'
  )!;
  assert(r1.currentStatus === ComplaintStatus.COMPLAINT_LINKED,
    `P0001 状态=已关联投诉（实际${r1.currentStatus}）`);
  assert(r1.complaint?.complaintId === 'TS-20260601',
    '投诉编号正确写入 TS-20260601');

  const linkLog = r1.statusLogs[r1.statusLogs.length - 1];
  assert(
    linkLog.snapshotBefore['complaint'] === undefined ||
      linkLog.snapshotBefore['complaint'] === null,
    '快照snapshotBefore中complaint字段为空（操作前状态）'
  );
  assert(linkLog.diff['complaint.complaintId']?.before === undefined,
    'diff中complaintId变更前为undefined');
  assert(linkLog.diff['complaint.complaintId']?.after === 'TS-20260601',
    'diff中complaintId变更后为TS-20260601');
  console.log('✅ 快照时机正确：操作前complaint为空，diff准确记录变更');

  let r2 = ComplaintLinkService.linkComplaint(
    rec2.id,
    {
      complaintId: 'TS-20260603',
      complaintTime: '2026-06-03 20:15:00',
      complaintContent: '垃圾桶未盖，异味飘散',
      complainant: '李先生',
      complainantPhone: '139****5678',
    },
    '交通协管-老马'
  )!;

  // ============== 场景3: 回滚关联投诉编号（修复前的核心bug）==============
  pass('场景3: 回滚关联投诉 → 验证快照恢复、字段和状态一致、可重新关联');

  try {
    ComplaintLinkService.linkComplaint(
      rec1.id,
      { complaintId: 'TS-XXXXXX', complaintTime: '2026-01-01 00:00:00',
        complaintContent: 'x', complainant: 'x', complainantPhone: 'x' },
      '测试员'
    );
    assert(false, '重复关联应该报错');
  } catch (e) {
    assert(
      (e as Error).message.includes('已关联投诉编号'),
      `重复关联正确拦截: ${(e as Error).message.slice(0, 40)}...`
    );
  }

  const linkLogId = linkLog.id;
  const r1AfterLinkStatus = r1.currentStatus;
  const r1AfterLinkComplaint = r1.complaint;
  console.log(`回滚前状态=${r1AfterLinkStatus}, complaintId=${r1AfterLinkComplaint?.complaintId}`);

  const rolledBack = StatusManager.rollbackToLog(rec1.id, linkLogId, '管理员')!;

  assert(
    rolledBack.currentStatus === ComplaintStatus.IMPORTED,
    `回滚后状态=已导入（实际${rolledBack.currentStatus}）`
  );
  assert(
    rolledBack.complaint === undefined,
    `回滚后complaint字段真的清空（实际=${JSON.stringify(rolledBack.complaint)}）`
  );
  console.log('✅ 回滚生效：状态回到imported，complaint字段真清空（修复前核心bug）');

  const reLinked = ComplaintLinkService.linkComplaint(
    rec1.id,
    {
      complaintId: 'TS-20260601',
      complaintTime: '2026-06-01 19:30:00',
      complaintContent: '夜间垃圾投放点异味严重，影响休息',
      complainant: '张女士',
      complainantPhone: '138****1234',
      remark: '连续三天晚上都有异味（重新关联）',
    },
    '交通协管-老马'
  )!;
  assert(reLinked.currentStatus === ComplaintStatus.COMPLAINT_LINKED,
    '回滚后再次关联成功，不再抛"该记录已关联投诉编号"错误');
  r1 = reLinked;
  console.log('✅ 补录返工：回滚后重新关联正常（修复前无法再次关联）');

  // ============== 场景4: 热力图更新（晚上缺采样偏低）==============
  pass('场景4: 热力图更新 - 晚上缺采样导致热力图偏低处理');

  r1 = HeatmapService.updateHeatmap(
    r1.id, 2, true, '2026-06-05 22:00:00', '热力图系统'
  )!;
  assert(
    r1.currentStatus === ComplaintStatus.HEATMAP_PENDING_REVIEW,
    `P0001 缺采样(是)+热力值2 → 进入待复核（实际${r1.currentStatus}）`
  );
  assert(
    r1.heatmap?.isLowDueToMissing === true,
    'isLowDueToMissing标记=true'
  );
  assert(
    HeatmapService.getDisplayOdorLevel(r1) === 1,
    '待复核期间显示热力值=1（不是实际低值）'
  );
  console.log(`P0001原始热力值=${r1.heatmap.odorLevel}，显示热力值=${HeatmapService.getDisplayOdorLevel(r1)}，待街道规划员复核`);

  r2 = HeatmapService.updateHeatmap(
    r2.id, 7, false, '2026-06-05 22:00:00', '热力图系统'
  )!;
  assert(
    r2.currentStatus === ComplaintStatus.HEATMAP_NORMAL,
    `P0002 正常采样热力值7 → 热力图正常（实际${r2.currentStatus}）`
  );

  let r3 = HeatmapService.updateHeatmap(
    rec3.id, 5, true, '2026-06-05 22:05:00', '热力图系统'
  )!;
  assert(
    r3.currentStatus === ComplaintStatus.HEATMAP_NORMAL,
    `P0003 缺采样但热力值5（≤2才判偏低）→ 正常（实际${r3.currentStatus}）`
  );

  const pendingList = HeatmapService.getPendingReviewRecords();
  assert(pendingList.length === 1, `待复核队列=1条（实际${pendingList.length}）`);
  assert(pendingList[0].id === r1.id, '待复核的是P0001');

  // ============== 场景5: 修改投诉备注/误差说明 带日志 ==============
  pass('场景5: 补录投诉备注/误差说明（MANUAL_EDIT，产生diff和变更历史）');

  const r1BeforeRemark = r1.complaint?.remark;
  r1 = ComplaintLinkService.updateComplaintRemark(
    r1.id,
    '补充：居民投诉编号关键备注——异味持续至凌晨2点，已转交环卫',
    '交通协管-老马',
    '居民补充提供新线索，误差需复核'
  )!;

  const remarkLog = r1.statusLogs[r1.statusLogs.length - 1];
  assert(
    remarkLog.operationType === OperationType.MANUAL_EDIT,
    '修改备注产生MANUAL_EDIT日志'
  );
  assert(
    remarkLog.diff['complaint.remark']?.before === r1BeforeRemark,
    `diff中remark变更前="${r1BeforeRemark}"`
  );
  assert(
    remarkLog.diff['complaint.remark']?.after === r1.complaint?.remark,
    `diff中remark变更后正确记录`
  );
  console.log('修改备注diff字段:', remarkLog.fieldsChanged);

  // ============== 场景6: 街道规划员复核 ==============
  pass('场景6: 街道规划员复核缺采样偏低记录');

  const r1Reviewed = HeatmapService.reviewHeatmap(
    r1.id,
    false,
    '确认为设备故障导致缺采样，现场复核异味为正常水平。因投诉真实存在，标记异常后续跟进。',
    '街道规划员-小王'
  )!;

  assert(
    r1Reviewed.currentStatus === ComplaintStatus.REVIEWED_ABNORMAL,
    `P0001 复核结论=异常（实际${r1Reviewed.currentStatus}）`
  );
  assert(
    r1Reviewed.heatmap?.reviewedBy === '街道规划员-小王',
    '复核人记录正确'
  );
  assert(
    HeatmapService.getDisplayOdorLevel(r1Reviewed) === 1,
    '复核异常后，仍展示低值1（避免误导）'
  );
  r1 = r1Reviewed;

  // ============== 场景7: 统一数据读取验证（同数据源）==============
  pass('场景7: 统一数据读取 - 明细/页面/热力图 三处同构');

  const pageData = UnifiedDataService.getPageList(1, 10).list;
  const heatmapDisplay = UnifiedDataService.getForHeatmapDisplay();
  const csvContent = UnifiedDataService.exportToCSV();
  const records = UnifiedDataService.query();

  console.log(`页面列表: ${pageData.length}条`);
  console.log(`热力图展示: ${heatmapDisplay.length}条`);
  console.log(`CSV行数(含表头): ${csvContent.split('\n').length}行`);
  console.log(`直接查询: ${records.length}条`);

  assert(
    pageData.length === heatmapDisplay.length &&
    heatmapDisplay.length === records.length,
    '页面/热力图/查询三处记录数一致'
  );

  const display1 = heatmapDisplay.find(d => d.pointId === 'P0001')!;
  const csvLines = csvContent.split('\n');
  const csvHeader = csvLines[0];
  const csvLineP0001 = csvLines.find(l => l.includes('P0001'))!;

  assert(display1.displayOdorLevel === 1, '热力图展示P0001显示值=1');
  assert(display1.isLowDueToMissing === true, '热力图展示P0001缺采样致偏低标记=true');
  assert(display1.conclusion.includes('复核通过-异常'),
    '热力图展示包含处理结论');
  assert(csvLineP0001.includes('复核通过-异常'),
    'CSV中包含复核结论（同一份结果）');
  assert(csvLineP0001.includes('缺采样致热力图偏低'),
    'CSV中包含"缺采样致热力图偏低"处理状态来源');
  console.log('✅ 同数据源：页面/热力图/CSV 都读取同一份缺采样偏低的处理结果');

  // ============== 场景8: 真实导出CSV到磁盘 ==============
  pass('场景8: 导出明细CSV 和 变更日志CSV 到磁盘');

  const outDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const detailCsvPath = path.join(outDir, `垃圾投放点异味投诉明细_${Date.now()}.csv`);
  const changelogCsvPath = path.join(outDir, `变更操作日志_${Date.now()}.csv`);

  fs.writeFileSync(detailCsvPath, '\ufeff' + csvContent, 'utf-8');
  fs.writeFileSync(
    changelogCsvPath,
    '\ufeff' + UnifiedDataService.exportChangeLogsCSV(),
    'utf-8'
  );

  console.log(`✅ 明细CSV导出: ${detailCsvPath}`);
  console.log(`✅ 变更日志CSV导出: ${changelogCsvPath}`);

  const detailStats = UnifiedDataService.getStatistics();
  console.log('\n统计概览:', JSON.stringify(detailStats, null, 2));

  // ============== 场景9: 核对 夜间采样点 vs 缺采样偏低 对应关系 ==============
  pass('场景9: 核对 - 夜间采样点（主材料）与缺采样偏低记录对上');

  const all = UnifiedDataService.query();
  console.log(`\n采样点记录核对表 (共${all.length}个)`);
  console.log('─'.repeat(110));
  console.log(
    '原始行号'.padEnd(8) +
    '采样点'.padEnd(16) +
    '投诉编号'.padEnd(14) +
    '夜间缺采样'.padEnd(12) +
    '热力值'.padEnd(8) +
    '缺采样偏低'.padEnd(12) +
    '处理状态'
  );
  console.log('─'.repeat(110));

  let matchedCount = 0;
  let missingLowCount = 0;

  for (const r of all) {
    const isNightImport = r.originalRowNumber > 0;
    const isMissing = r.heatmap?.isMissingSampling || false;
    const isLow = r.heatmap?.isLowDueToMissing || false;

    const row =
      String(r.originalRowNumber).padEnd(8) +
      r.samplingPoint.pointId.padEnd(16) +
      (r.complaint?.complaintId || '—').padEnd(14) +
      (isMissing ? '是' : '否').padEnd(12) +
      String(r.heatmap?.odorLevel ?? '—').padEnd(8) +
      (isLow ? '是 ⚠️' : '否').padEnd(12) +
      r.currentStatus;

    console.log(row);

    if (isNightImport) matchedCount++;
    if (isLow) missingLowCount++;
  }
  console.log('─'.repeat(110));
  assert(matchedCount === 3, `所有记录都来自夜间采样点主材料（${matchedCount}/3）`);
  assert(missingLowCount === 1, `缺采样偏低记录共 1 条 P0001（实际${missingLowCount}）`);

  // ============== 场景10: 变更历史完整可追溯 ==============
  pass('场景10: P0001完整变更历史（街道规划员追问证据链）');
  const history = StatusManager.getOperationHistory(r1.id);
  console.log(`\nP0001 共 ${history.length} 条操作记录：`);
  history.forEach((log, i) => {
    console.log(
      `${i + 1}. [${log.operationTime.slice(0, 19)}] ${log.operationType} ` +
      `(${log.operator}) ${log.fromStatus ?? '空'} → ${log.toStatus}`
    );
    console.log(`   备注: ${log.remark}`);
    if (log.fieldsChanged.length > 0) {
      console.log(`   变更字段(${log.fieldsChanged.length}): ${log.fieldsChanged.join(', ')}`);
    }
  });
  assert(history.length >= 6, `P0001操作历史≥6条（实际${history.length}）`);

  // ============== 场景11: 回滚复核热力图验证快照 ==============
  pass('场景11: 回滚复核热力图 → 验证snapshotBefore是真正的操作前');

  const reviewLog = history.find(l => l.operationType === OperationType.REVIEW_HEATMAP);
  assert(reviewLog !== undefined, '找到复核日志');
  const beforeSnapshot = reviewLog!.snapshotBefore as any;

  console.log(`\n操作前快照(review前): currentStatus=${beforeSnapshot.currentStatus}, reviewedBy=${beforeSnapshot.heatmap?.reviewedBy}`);
  console.log(`操作后实际值: currentStatus=${r1.currentStatus}, reviewedBy=${r1.heatmap?.reviewedBy}`);

  assert(
    beforeSnapshot.currentStatus === ComplaintStatus.HEATMAP_PENDING_REVIEW,
    `快照中review前状态=待复核（实际${beforeSnapshot.currentStatus}）`
  );
  assert(
    beforeSnapshot.heatmap?.reviewedBy === undefined,
    `快照中review前reviewedBy=undefined（实际${beforeSnapshot.heatmap?.reviewedBy}）`
  );
  console.log('✅ 复核快照正确：操作前状态/字段真实记录（修复前snapshot是操作后）');

  const rolledBackReview = StatusManager.rollbackToLog(r1.id, reviewLog!.id, '管理员')!;
  assert(
    rolledBackReview.currentStatus === ComplaintStatus.HEATMAP_PENDING_REVIEW,
    `回滚复核后状态=待复核（实际${rolledBackReview.currentStatus}）`
  );
  assert(
    rolledBackReview.heatmap?.reviewedBy === undefined,
    `回滚复核后reviewedBy真的清空（实际${rolledBackReview.heatmap?.reviewedBy}）`
  );
  assert(
    rolledBackReview.heatmap?.reviewNote === undefined,
    `回滚复核后reviewNote真的清空`
  );
  console.log('✅ 回滚复核生效：真的回到操作前状态，字段完全恢复（修复前不生效）');

  // ============== 场景12: 补录返工 - 回滚复核后修改热力值再复核 ==============
  pass('场景12: 补录返工 - 回滚复核后用MANUAL_EDIT补录新热力值');

  let reworkR1 = StatusManager.executeManualEdit(
    rolledBackReview.id,
    '交通协管-老马',
    r => {
      r.heatmap = {
        odorLevel: 2,
        samplingTime: '2026-06-07 02:00:00',
        isMissingSampling: true,
        isLowDueToMissing: true,
      };
    },
    '返工补录：重新采样，设备已修复，再次出现低值'
  )!;
  assert(
    reworkR1.currentStatus === ComplaintStatus.HEATMAP_PENDING_REVIEW,
    `补录后状态仍为待复核（实际${reworkR1.currentStatus}）`
  );
  assert(
    reworkR1.statusLogs[reworkR1.statusLogs.length - 1].operationType === OperationType.MANUAL_EDIT,
    '返工补录产生MANUAL_EDIT日志'
  );
  r1 = reworkR1;

  // ============== 最终复核（循环完结） ==============
  pass('场景13: 街道规划员最终复核通过 - 完结缺采样偏低流程');
  r1 = HeatmapService.reviewHeatmap(
    r1.id,
    true,
    '多次复核确认：夜间采样点 P0001 原始行号3，对应居民投诉TS-20260601，缺采样属实但现场正常。采信低值2作为有效值。',
    '街道规划员-小王'
  )!;
  assert(
    r1.currentStatus === ComplaintStatus.REVIEWED_NORMAL,
    `最终复核通过=正常（实际${r1.currentStatus}）`
  );
  assert(
    HeatmapService.getDisplayOdorLevel(r1) === 2,
    `复核正常后显示实际热力值=2（之前复核异常时显示1）`
  );
  console.log('✅ 缺采样偏低流程完结：复核通过后，可信低值正常展示，不再归异常');

  // ============== 最终：重导出含完整记录的CSV ==============
  pass('场景14: 最终导出 - 完整处理过的明细（含来源、状态、结论、变更）');

  const finalCsv = UnifiedDataService.exportToCSV();
  const finalCsvPath = path.join(outDir, `最终版_垃圾投放点异味投诉明细.csv`);
  fs.writeFileSync(finalCsvPath, '\ufeff' + finalCsv, 'utf-8');
  const finalChangePath = path.join(outDir, `最终版_变更操作日志.csv`);
  fs.writeFileSync(
    finalChangePath,
    '\ufeff' + UnifiedDataService.exportChangeLogsCSV(),
    'utf-8'
  );

  const p0001Final = UnifiedDataService.getRecordWithDetail(r1.id)!;
  console.log('\nP0001 最终明细报告同屏：');
  console.log('  数据来源:', p0001Final.dataOrigin);
  console.log('  处理状态:', p0001Final.statusLabel);
  console.log('  处理结论:', p0001Final.conclusion);
  console.log('  最后操作:', p0001Final.lastOperation);
  console.log('  操作人:', p0001Final.lastOperator);
  console.log('  最后变更:', p0001Final.lastDiff);
  assert(p0001Final.dataOrigin.includes('夜间采样点主材料'),
    '来源中包含"夜间采样点主材料"');
  assert(p0001Final.dataOrigin.includes('缺采样致热力图偏低'),
    '来源中包含"缺采样致热力图偏低"（两者对上）');
  assert(p0001Final.conclusion.includes('TS-20260601'),
    '结论中包含投诉编号（投诉/采样点关联关系明确）');

  const stats = UnifiedDataService.getStatistics();
  console.log('\n============= 最终统计 =============');
  console.log(`总记录数: ${stats.total}`);
  console.log(`缺采样致偏低: ${stats.missingLowCount}`);
  console.log(`补录/返工记录数: ${stats.reworkCount}`);
  stats.byStatus.forEach(s => {
    console.log(`  ${s.statusLabel}: ${s.count}`);
  });

  console.log(`\n📁 导出文件位置: ${outDir}/`);
  console.log('   ├── 最终版_垃圾投放点异味投诉明细.csv');
  console.log('   └── 最终版_变更操作日志.csv');

  console.log('\n\n🎉 所有端到端场景验证通过！');
  console.log([
    '  ✅ 导入快照正确（diff记录从无到有）',
    '  ✅ 回滚关联投诉真正清空complaint字段',
    '  ✅ 回滚后可重新关联（不再报已关联）',
    '  ✅ 复核快照是操作前状态（reviewedBy=undefined）',
    '  ✅ 回滚复核后字段真正恢复',
    '  ✅ 修改备注/误差说明产生MANUAL_EDIT日志和diff',
    '  ✅ 缺采样偏低记录进入待复核、不自动归正常',
    '  ✅ 三处同数据源：页面/热力图/CSV',
    '  ✅ 夜间采样点（主材料）与缺采样偏低记录对上',
    '  ✅ 导出同屏：来源、处理状态、结论、变更人、变更字段',
  ].join('\n'));
}

main().catch(e => {
  console.error('\n❌ 测试失败:', e);
  process.exit(1);
});
