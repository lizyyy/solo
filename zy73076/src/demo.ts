import {
  EquipmentNormalizer,
  CutterheadWarningEngine,
  ManagerViewBuilder,
  AnomalyQueueWorkflow,
  JudgmentChangeReporter,
  HandoverPackager,
  EquipmentIdMapping,
  ThresholdRule,
  InspectionRecord,
} from './index';

// ============================================================
// 演示场景：把小林的巡检表数据跑一遍，展示每个模块输出
// ============================================================

const MAPPINGS: EquipmentIdMapping[] = [
  {
    canonicalId: 'SD-001', projectId: 'P-001',
    aliases: ['盾构1号', 'SD001', 'sd-001', 'SD－001', '盾构机001'],
    description: '1号盾构机（左线）',
  },
  {
    canonicalId: 'SD-002', projectId: 'P-001',
    aliases: ['盾构2号', 'SD002', 'sd-002'],
    description: '2号盾构机（右线）',
  },
];

const THRESHOLDS: ThresholdRule[] = [
  {
    itemName: '刀盘磨损量', unit: 'mm', direction: 'upper',
    thresholds: { attention: 8, warning: 15, critical: 25 },
    description: '刀盘滚刀磨损量上限',
  },
  {
    itemName: '主驱动油温', unit: '℃', direction: 'upper',
    thresholds: { attention: 65, warning: 75, critical: 85 },
    description: '主驱动液压油温上限',
  },
];

function data(): InspectionRecord[] {
  const ts = new Date().toISOString();
  return [
    { id: 'R01', inspectionDate: '2026-06-01', rawEquipmentId: 'SD001',
      inspector: '张三', itemName: '刀盘磨损量', measuredValue: 6, unit: 'mm', createdAt: ts },
    { id: 'R02', inspectionDate: '2026-06-02', rawEquipmentId: '盾构1号',
      inspector: '张三', itemName: '刀盘磨损量', measuredValue: 10, unit: 'mm', createdAt: ts },
    { id: 'R03', inspectionDate: '2026-06-03', rawEquipmentId: 'SD-001',
      inspector: '李四', itemName: '刀盘磨损量', measuredValue: 18, unit: 'mm',
      remark: '发现偏磨，计划换刀', createdAt: ts },
    { id: 'R04', inspectionDate: '2026-06-03', rawEquipmentId: 'SD-001',
      inspector: '李四', itemName: '主驱动油温', measuredValue: 78, unit: '℃',
      createdAt: ts },
    { id: 'R05', inspectionDate: '2026-06-03', rawEquipmentId: '盾构2号',
      inspector: '王五', itemName: '刀盘磨损量', measuredValue: 28, unit: 'mm',
      remark: '多把滚刀超限', createdAt: ts },
    { id: 'R06', inspectionDate: '2026-06-04', rawEquipmentId: 'SD-X',
      inspector: '新人', itemName: '刀盘磨损量', measuredValue: 22, unit: 'mm', createdAt: ts },
  ];
}

function section(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log('  ' + title);
  console.log('='.repeat(70));
}

function main() {
  const normalizer = new EquipmentNormalizer(MAPPINGS);
  const engine = new CutterheadWarningEngine(normalizer, THRESHOLDS);
  const inspections = data();

  // ---- 1. 设备编号规范化（小林最关心的"捋顺写法"）----
  section('① 设备编号规范化结果 — 把同一设备的各种写法捋顺');
  const { results: normResults, duplicateGroups } = normalizer.bulkNormalize(
    Array.from(new Set(inspections.map(i => i.rawEquipmentId)))
  );
  for (const [raw, n] of normResults) {
    console.log(
      `  ${raw.padEnd(10)} → ${(n.canonical ?? '???').padEnd(10)} ` +
      `[${n.status}] 置信度=${n.confidence.toFixed(2)}`
    );
  }
  console.log('\n  检测到"设备编号重复组"（需项目经理确认）：');
  for (const g of duplicateGroups) {
    console.log(
      `    ${g.canonicalId}  ←  ${g.rawVariants.join(' / ')}` +
      `   ⚠挂起待确认=${g.pendingConfirmation}`
    );
  }

  // ---- 2. 统一预警结果集 ----
  section('② 统一预警结果集 — 筛选/统计/明细/异常队列 同出一源');
  const result = engine.generate(inspections);
  console.log(`  生成时间: ${result.generatedAt}`);
  console.log(`  明细条数: ${result.statistics.totalInspections}`);
  console.log(`  涉及设备: ${result.statistics.totalEquipments}`);
  console.log(
    `  按级别: C=${result.statistics.byLevel.critical}  ` +
    `W=${result.statistics.byLevel.warning}  ` +
    `A=${result.statistics.byLevel.attention}  ` +
    `N=${result.statistics.byLevel.normal}`
  );
  console.log(`  挂起等待确认: ${result.statistics.suspendedCount}`);
  console.log(`  含证据缺口的条数: ${result.statistics.evidenceGapCount}`);
  console.log(`  异常队列条数: ${result.anomalyQueue.length}`);
  console.log(`  判断变更条数: ${result.judgmentChanges.length}`);

  // ---- 3. 异常队列（含挂起）----
  section('③ 异常队列 — 设备编号重复一律挂起等项目经理确认');
  for (const q of result.anomalyQueue) {
    console.log(
      `  ${q.id}  ${q.level.padEnd(9)} ${q.status.padEnd(22)} ` +
      `→ 分配给: ${q.assignedTo}`
    );
    console.log(`      设备: ${q.equipmentId}  原始写法: [${q.rawEquipmentIds.join(', ')}]`);
    if (q.suspensionReason) console.log(`      挂起原因: ${q.suspensionReason}`);
    console.log(`      最新日志: ${q.history[q.history.length - 1].comment}`);
  }

  // ---- 4. 判断变更（评审会备注）----
  section('④ 判断变更（评审会备注）— 说清"盾构刀盘阈值预警"改变了哪些判断');
  const reporter = new JudgmentChangeReporter();
  console.log(reporter.toReviewBriefing(result.judgmentChanges));
  console.log('\n  可直接粘贴到巡检表"备注"列的内容：');
  for (const line of reporter.toInspectionRemarks(result.judgmentChanges)) {
    console.log('    · ' + line);
  }

  // ---- 5. 项目经理视图 ----
  section('⑤ 项目经理视图 — 一眼看出汇总口径 + 待确认 + 证据缺口');
  const mgrView = new ManagerViewBuilder().build(result);
  console.log('\n  汇总口径（点击数字下钻筛选条件，与明细表对接同一数据源）：');
  for (const row of mgrView.summaryBreakdown) {
    const gaps = row.evidenceGapSummary.map(g => `${g.type}×${g.count}`).join(', ') || '—';
    console.log(
      `    ${row.level.padEnd(9)} 条数=${String(row.count).padEnd(3)} ` +
      `设备=${String(row.equipmentCount).padEnd(3)}  缺口: ${gaps}`
    );
    console.log(
      `      → 下钻筛选条件: warningLevels=[${row.level}] ` +
      `includeSuspended=${row.drillDownFilter.includeSuspended}`
    );
  }
  console.log('\n  待确认清单（不确认的假稳定风险说明）：');
  for (const pc of mgrView.pendingConfirmations) {
    console.log(`    [${pc.queueId}] 写法=[${pc.rawEquipmentIds.join(', ')}]  → 候选规范编号: ${pc.candidateCanonicalIds.join(' / ')}`);
    console.log('        ' + pc.riskOfFalseStability);
  }
  console.log('\n  还剩哪些证据没补齐（项目经理一眼看）：');
  for (const g of mgrView.outstandingEvidenceGaps) {
    console.log(
      `    · ${g.gapType.padEnd(28)} ×${String(g.count).padEnd(3)} ` +
      `设备: [${g.relatedEquipments.slice(0, 3).join(', ')}${g.relatedEquipments.length > 3 ? '...' : ''}]`
    );
    console.log(`        → ${g.suggestedAction}`);
  }

  // ---- 6. 项目经理确认后（模拟）----
  section('⑥ 模拟：项目经理确认 SD-001 编号归属 → 状态流转');
  const wf = new AnomalyQueueWorkflow();
  let queues = result.anomalyQueue.slice();
  const duplicateQ = queues.find(q => q.suspensionReason === 'duplicate_equipment');
  if (duplicateQ) {
    const idx = queues.indexOf(duplicateQ);
    queues[idx] = wf.confirmEquipment(
      duplicateQ, '项目经理-王总', 'SD-001',
      '确认 SD001/盾构1号/SD-001 都是1号盾构机'
    );
    console.log(
      `  ${queues[idx].id}: ${duplicateQ.status} → ${queues[idx].status}  ` +
      `分配给: ${queues[idx].assignedTo}`
    );
    console.log(`  日志: ${queues[idx].history[queues[idx].history.length - 1].comment}`);
  }
  // 确认后重新生成结果（装备用引擎，此处简单演示队列已流转）
  // 开发者 → 小林 交接
  const criticalQ = queues.find(q => q.level === 'critical');
  if (criticalQ) {
    const idx = queues.indexOf(criticalQ);
    queues[idx] = wf.transferToAssistant(
      criticalQ, '开发-小陈', '归档凭证 D-2026-001'
    );
    console.log(
      `  ${queues[idx].id}: ${criticalQ.status} → ${queues[idx].status}  ` +
      `分配给: ${queues[idx].assignedTo}`
    );
  }

  // ---- 7. 交接清单（小林用）----
  section('⑦ 交接清单（小林视角）— 顺着巡检表 → 异常队列就能完成收尾');
  const pkg = new HandoverPackager().build(result);
  console.log(
    `  总步骤: ${pkg.checklist.length}  ` +
    `已完成前置: ${pkg.completedActionCount}  ` +
    `待办: ${pkg.pendingActionCount}`
  );
  for (const step of pkg.checklist) {
    const mark = step.completed ? '✅' : '⬜';
    console.log(
      `\n  ${mark} Step ${step.step}: ${step.description}`
    );
    if (step.relatedAnomalyQueueIds.length > 0) {
      console.log(`     关联队列: ${step.relatedAnomalyQueueIds.join(', ')}`);
    }
  }
  console.log('\n  巡检表 → 异常队列 索引（小林拿着巡检表就能查到对应队列）：');
  for (const idx of pkg.inspectionIndex) {
    console.log(
      `    ${idx.inspectionRecordId}  写法=${idx.rawEquipmentId.padEnd(10)} ` +
      `→ 规范编号=${(idx.canonicalEquipmentId ?? '⚠未确认').padEnd(14)} ` +
      `队列=[${idx.anomalyQueueIds.join(',') || '-'}]  ` +
      `变更=[${idx.judgmentChangeIds.length || 0}]`
    );
  }

  section('✅ 演示结束 — 所有模块输出均从同一 WarningResultSet 生成，口径一致');
}

main();
