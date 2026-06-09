"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../index");
// ---------- 测试数据 ----------
const TEST_MAPPINGS = [
    {
        canonicalId: 'SD-001',
        projectId: 'P-001',
        aliases: ['盾构1号', 'SD001', 'sd-001', 'SD－001', '盾构机001'],
        description: '1号盾构机（左线）',
    },
    {
        canonicalId: 'SD-002',
        projectId: 'P-001',
        aliases: ['盾构2号', 'SD002', 'sd-002', '盾构机002'],
        description: '2号盾构机（右线）',
    },
    {
        canonicalId: 'SD-003',
        projectId: 'P-002',
        aliases: ['盾构3号', 'SD003'],
        description: '3号盾构机',
    },
];
const TEST_THRESHOLDS = [
    {
        itemName: '刀盘磨损量',
        unit: 'mm',
        direction: 'upper',
        thresholds: { attention: 8, warning: 15, critical: 25 },
        description: '刀盘滚刀磨损量上限',
    },
    {
        itemName: '主驱动油温',
        unit: '℃',
        direction: 'upper',
        thresholds: { attention: 65, warning: 75, critical: 85 },
        description: '主驱动液压油温上限',
    },
    {
        itemName: '刀盘转速',
        unit: 'rpm',
        direction: 'both',
        thresholds: { attention: 0.5, warning: 1, critical: 2 },
        description: '刀盘转速下限异常（过低即停）',
    },
];
function mkInspections() {
    const ts = new Date().toISOString();
    const recs = [];
    // SD-001 的多种写法（将被识别为 duplicate → 挂起）
    recs.push({
        id: 'R-001',
        inspectionDate: '2026-06-01',
        rawEquipmentId: 'SD001', // 别名
        inspector: '张三',
        itemName: '刀盘磨损量',
        measuredValue: 6,
        unit: 'mm',
        createdAt: ts,
    });
    recs.push({
        id: 'R-002',
        inspectionDate: '2026-06-02',
        rawEquipmentId: '盾构1号', // 别名
        inspector: '张三',
        itemName: '刀盘磨损量',
        measuredValue: 10, // attention
        unit: 'mm',
        createdAt: ts,
    });
    recs.push({
        id: 'R-003',
        inspectionDate: '2026-06-03',
        rawEquipmentId: 'SD-001', // 规范写法
        inspector: '李四',
        itemName: '刀盘磨损量',
        measuredValue: 18, // warning（且有 3 种写法 → 归集后 warning；但挂起不给出结论）
        unit: 'mm',
        remark: '现场观察有偏磨，计划下周换刀',
        createdAt: ts,
    });
    recs.push({
        id: 'R-004',
        inspectionDate: '2026-06-03',
        rawEquipmentId: 'SD-001',
        inspector: '李四',
        itemName: '主驱动油温',
        measuredValue: 78, // warning
        unit: '℃',
        remark: '', // 故意缺备注，触发证据缺口
        createdAt: ts,
    });
    // SD-002
    recs.push({
        id: 'R-005',
        inspectionDate: '2026-06-01',
        rawEquipmentId: 'SD-002',
        inspector: '王五',
        itemName: '刀盘磨损量',
        measuredValue: 4,
        unit: 'mm',
        createdAt: ts,
    });
    recs.push({
        id: 'R-006',
        inspectionDate: '2026-06-03',
        rawEquipmentId: '盾构2号',
        inspector: '王五',
        itemName: '刀盘磨损量',
        measuredValue: 28, // critical
        unit: 'mm',
        remark: '多把滚刀达到磨损上限',
        createdAt: ts,
    });
    // 未知设备编号
    recs.push({
        id: 'R-007',
        inspectionDate: '2026-06-04',
        rawEquipmentId: '盾构-X99',
        inspector: '新人',
        itemName: '刀盘磨损量',
        measuredValue: 30,
        unit: 'mm',
        createdAt: ts,
    });
    // 未定义阈值项
    recs.push({
        id: 'R-008',
        inspectionDate: '2026-06-05',
        rawEquipmentId: 'SD-002',
        inspector: '王五',
        itemName: '刀盘振动幅值',
        measuredValue: 3.5,
        unit: 'mm/s',
        createdAt: ts,
    });
    return recs;
}
// ---------- 测试用例 ----------
(0, node_test_1.describe)('EquipmentNormalizer', () => {
    const n = new index_1.EquipmentNormalizer(TEST_MAPPINGS);
    (0, node_test_1.it)('精确别名匹配 → normalized', () => {
        const r = n.normalize('SD001');
        strict_1.default.equal(r.canonical, 'SD-001');
        strict_1.default.equal(r.status, 'normalized');
        strict_1.default.equal(r.confidence, 1);
    });
    (0, node_test_1.it)('规范编号匹配 → canonical', () => {
        const r = n.normalize('SD-001');
        strict_1.default.equal(r.canonical, 'SD-001');
        strict_1.default.equal(r.status, 'canonical');
    });
    (0, node_test_1.it)('中文别名匹配', () => {
        const r = n.normalize(' 盾构1号 ');
        strict_1.default.equal(r.canonical, 'SD-001');
        strict_1.default.equal(r.status, 'normalized');
    });
    (0, node_test_1.it)('未知编号 → unknown', () => {
        const r = n.normalize('盾构-X99');
        strict_1.default.equal(r.canonical, null);
        strict_1.default.equal(r.status, 'unknown');
    });
    (0, node_test_1.it)('批量规范化应识别出 duplicate 组（SD-001 有 3 种写法）', () => {
        const rawIds = ['SD001', '盾构1号', 'SD-001', 'SD-002'];
        const { results, duplicateGroups } = n.bulkNormalize(rawIds);
        strict_1.default.equal(results.get('SD001').status, 'duplicate');
        strict_1.default.equal(results.get('盾构1号').status, 'duplicate');
        strict_1.default.equal(results.get('SD-001').status, 'duplicate');
        strict_1.default.equal(results.get('SD-002').status, 'canonical');
        const sd001Group = duplicateGroups.find(g => g.canonicalId === 'SD-001');
        strict_1.default.ok(sd001Group);
        strict_1.default.equal(sd001Group.rawVariants.length, 3);
        strict_1.default.equal(sd001Group.pendingConfirmation, true);
    });
});
(0, node_test_1.describe)('CutterheadWarningEngine - 统一数据源口径一致性', () => {
    const normalizer = new index_1.EquipmentNormalizer(TEST_MAPPINGS);
    const engine = new index_1.CutterheadWarningEngine(normalizer, TEST_THRESHOLDS);
    const inspections = mkInspections();
    const result = engine.generate(inspections);
    (0, node_test_1.it)('统计数字.byLevel 之和 = 明细表总数（筛选全量时）', () => {
        const totalByLevel = Object.values(result.statistics.byLevel).reduce((a, b) => a + b, 0);
        strict_1.default.equal(totalByLevel, result.details.length);
        strict_1.default.equal(result.details.length, 8);
    });
    (0, node_test_1.it)('异常队列中的 warningDetailId 都能在明细表中找到', () => {
        for (const q of result.anomalyQueue) {
            for (const detailId of q.warningDetailId.split(',')) {
                const found = result.details.find(d => d.recordId === detailId);
                strict_1.default.ok(found, `队列 ${q.id} 的 detailId=${detailId} 在明细表中不存在`);
            }
        }
    });
    (0, node_test_1.it)('统计.byEquipment 与 明细中对应设备的条数一致', () => {
        const countFromDetails = {};
        for (const d of result.details) {
            countFromDetails[d.equipmentId] =
                (countFromDetails[d.equipmentId] ?? 0) + 1;
        }
        strict_1.default.deepEqual(result.statistics.byEquipment, countFromDetails);
    });
    (0, node_test_1.it)('筛选条件变化时：统计与明细一起变', () => {
        const filtered = engine.generate(inspections, {
            dateRange: null, projectId: null, equipmentIds: null,
            warningLevels: ['critical'], includeSuspended: true,
        });
        for (const d of filtered.details) {
            strict_1.default.equal(d.level, 'critical');
        }
        strict_1.default.equal(filtered.statistics.byLevel.critical, filtered.details.length);
        strict_1.default.equal(filtered.statistics.byLevel.warning, 0);
    });
});
(0, node_test_1.describe)('CutterheadWarningEngine - 挂起机制：宁可挂起不给假稳定', () => {
    const normalizer = new index_1.EquipmentNormalizer(TEST_MAPPINGS);
    const engine = new index_1.CutterheadWarningEngine(normalizer, TEST_THRESHOLDS);
    const inspections = mkInspections();
    const result = engine.generate(inspections);
    (0, node_test_1.it)('SD-001 有 duplicate → 相关异常队列状态为 pending_confirmation', () => {
        const sd001Queues = result.anomalyQueue.filter(q => q.rawEquipmentIds.some(id => ['SD001', '盾构1号', 'SD-001'].includes(id)) && q.suspensionReason === 'duplicate_equipment');
        strict_1.default.ok(sd001Queues.length > 0, '应有因设备编号重复而挂起的队列');
        for (const q of sd001Queues) {
            strict_1.default.equal(q.status, 'pending_confirmation');
            strict_1.default.equal(q.assignedTo, 'project_manager');
        }
    });
    (0, node_test_1.it)('包含 includeSuspended=false 时，被挂起设备的统计不计入', () => {
        const withoutSuspended = engine.generate(inspections, {
            dateRange: null, projectId: null, equipmentIds: null,
            warningLevels: null, includeSuspended: false,
        });
        const suspendedEquipment = new Set(result.anomalyQueue
            .filter(q => q.status === 'pending_confirmation')
            .map(q => q.equipmentId));
        for (const d of withoutSuspended.details) {
            strict_1.default.equal(suspendedEquipment.has(d.equipmentId), false, `includeSuspended=false 时明细不应含挂起设备 ${d.equipmentId}`);
        }
        strict_1.default.equal(withoutSuspended.statistics.suspendedCount, 0);
    });
    (0, node_test_1.it)('未知设备编号（盾构-X99）应挂起为 ambiguous/unknown，不给出假稳定', () => {
        const unknownQ = result.anomalyQueue.find(q => q.rawEquipmentIds.includes('盾构-X99'));
        strict_1.default.ok(unknownQ);
        strict_1.default.equal(unknownQ.status, 'pending_confirmation');
    });
});
(0, node_test_1.describe)('CutterheadWarningEngine - 判断变更 & 巡检表备注', () => {
    const normalizer = new index_1.EquipmentNormalizer(TEST_MAPPINGS);
    // 先造一批"旧判断"：SD-001 的刀盘磨损量之前被判定为 normal
    // （模拟因写法不统一，之前按"虚假设备"拆分导致阈值未触发）
    const previousDetail = {
        recordId: 'OLD-R',
        inspectionDate: '2026-05-20',
        equipmentId: 'SD-001',
        rawEquipmentId: 'SD001',
        itemName: '刀盘磨损量',
        measuredValue: 5,
        unit: 'mm',
        level: 'normal',
        thresholdBreached: null,
        evidenceGap: [],
    };
    const engine = new index_1.CutterheadWarningEngine(normalizer, TEST_THRESHOLDS, [previousDetail]);
    const inspections = mkInspections();
    const result = engine.generate(inspections);
    (0, node_test_1.it)('应产生 judgmentChanges（含 false_stability_removed 或 equipment_id_unified）', () => {
        strict_1.default.ok(result.judgmentChanges.length > 0, '批次对比应产生至少 1 条判断变更');
        const sd001Wear = result.judgmentChanges.find(jc => jc.equipmentId === 'SD-001' && jc.itemName === '刀盘磨损量');
        strict_1.default.ok(sd001Wear, 'SD-001 刀盘磨损量 应有判断变更');
        strict_1.default.equal(sd001Wear.previousJudgment?.conclusion, '正常');
        strict_1.default.ok(['false_stability_removed', 'equipment_id_unified', 'new_evidence']
            .includes(sd001Wear.changeReason), `reason=${sd001Wear.changeReason}`);
    });
    (0, node_test_1.it)('每条 judgmentChange 都有 remarkForReview（供评审会备注）', () => {
        for (const jc of result.judgmentChanges) {
            strict_1.default.ok(jc.remarkForReview, `JC ${jc.id} 缺少评审会备注`);
            strict_1.default.ok(jc.remarkForReview.startsWith('【评审会备注'), '备注应以统一前缀开头');
        }
    });
    (0, node_test_1.it)('JudgmentChangeReporter 输出评审会要点摘要', () => {
        const reporter = new index_1.JudgmentChangeReporter();
        const briefing = reporter.toReviewBriefing(result.judgmentChanges);
        strict_1.default.ok(briefing.includes('判断变更要点'));
    });
});
(0, node_test_1.describe)('ManagerViewBuilder - 项目经理视图', () => {
    const normalizer = new index_1.EquipmentNormalizer(TEST_MAPPINGS);
    const engine = new index_1.CutterheadWarningEngine(normalizer, TEST_THRESHOLDS);
    const builder = new index_1.ManagerViewBuilder();
    const result = engine.generate(mkInspections());
    const view = builder.build(result);
    (0, node_test_1.it)('summaryBreakdown 中每个 count 与 overview.byLevel 一致', () => {
        for (const row of view.summaryBreakdown) {
            strict_1.default.equal(row.count, view.overview.byLevel[row.level]);
        }
    });
    (0, node_test_1.it)('summaryBreakdown.drillDownFilter 能定位到对应明细（再跑一次引擎过滤得同 count）', () => {
        for (const row of view.summaryBreakdown) {
            const fc = row.drillDownFilter;
            const subset = engine.generate(mkInspections(), {
                dateRange: fc.dateRange ?? null,
                projectId: fc.projectId ?? null,
                equipmentIds: fc.equipmentIds ?? null,
                warningLevels: fc.warningLevels ?? null,
                includeSuspended: fc.includeSuspended ?? true,
            });
            strict_1.default.equal(subset.details.length, row.count, `下钻 ${row.level} 后明细条数应等于该行 count`);
        }
    });
    (0, node_test_1.it)('pendingConfirmations 不为空且每条都列出假稳定风险', () => {
        strict_1.default.ok(view.pendingConfirmations.length > 0);
        for (const pc of view.pendingConfirmations) {
            strict_1.default.ok(pc.riskOfFalseStability.length > 10);
            strict_1.default.ok(pc.riskOfFalseStability.includes('假稳定') ||
                pc.riskOfFalseStability.includes('假结论'));
        }
    });
    (0, node_test_1.it)('outstandingEvidenceGaps 至少应包含 equipment_not_confirmed 和 inspection_remark_missing', () => {
        const gapTypes = new Set(view.outstandingEvidenceGaps.map(g => g.gapType));
        strict_1.default.ok(gapTypes.has('equipment_not_confirmed'));
        strict_1.default.ok(gapTypes.has('inspection_remark_missing'));
        // 每条都有建议动作
        for (const g of view.outstandingEvidenceGaps) {
            strict_1.default.ok(g.suggestedAction.length > 0);
        }
    });
});
(0, node_test_1.describe)('AnomalyQueueWorkflow - 状态流转', () => {
    const normalizer = new index_1.EquipmentNormalizer(TEST_MAPPINGS);
    const engine = new index_1.CutterheadWarningEngine(normalizer, TEST_THRESHOLDS);
    const result = engine.generate(mkInspections());
    const wf = new index_1.AnomalyQueueWorkflow();
    (0, node_test_1.it)('项目经理确认 duplicate → 状态变为 confirmed_warning 并分配给小林', () => {
        const duplicate = result.anomalyQueue.find(q => q.suspensionReason === 'duplicate_equipment');
        strict_1.default.ok(duplicate);
        const confirmed = wf.confirmEquipment(duplicate, '项目经理-老王', 'SD-001', '确认都是1号盾构机');
        strict_1.default.equal(confirmed.status, 'confirmed_warning');
        strict_1.default.equal(confirmed.assignedTo, 'assistant_xiaolin');
        strict_1.default.equal(confirmed.equipmentId, 'SD-001');
        strict_1.default.equal(confirmed.history.length, duplicate.history.length + 1);
    });
    (0, node_test_1.it)('标记误报 → false_alarm', () => {
        const q = result.anomalyQueue[0];
        const r = wf.markFalseAlarm(q, '项目经理-老王', '是两个不同设备');
        strict_1.default.equal(r.status, 'false_alarm');
    });
    (0, node_test_1.it)('现场处置 → resolved', () => {
        const q = result.anomalyQueue[0];
        const r = wf.markResolved(q, '现场-李四', '已更换磨损滚刀');
        strict_1.default.equal(r.status, 'resolved');
    });
    (0, node_test_1.it)('交接 → transferred 分配给小林', () => {
        const q = result.anomalyQueue[0];
        const r = wf.transferToAssistant(q, '开发-小陈', '归档编号 D-2026-001');
        strict_1.default.equal(r.status, 'transferred');
        strict_1.default.equal(r.assignedTo, 'assistant_xiaolin');
    });
});
(0, node_test_1.describe)('HandoverPackager - 小林交接清单', () => {
    const normalizer = new index_1.EquipmentNormalizer(TEST_MAPPINGS);
    const engine = new index_1.CutterheadWarningEngine(normalizer, TEST_THRESHOLDS);
    const result = engine.generate(mkInspections());
    const packager = new index_1.HandoverPackager();
    const pkg = packager.build(result);
    (0, node_test_1.it)('checklist 包含 7 步标准流程', () => {
        strict_1.default.equal(pkg.checklist.length, 7);
        for (let i = 0; i < 7; i++) {
            strict_1.default.equal(pkg.checklist[i].step, i + 1);
        }
    });
    (0, node_test_1.it)('Step 1 必须是设备编号确认（当前未完成，因为有 duplicate）', () => {
        strict_1.default.equal(pkg.checklist[0].completed, false);
        strict_1.default.ok(pkg.checklist[0].relatedAnomalyQueueIds.length > 0);
    });
    (0, node_test_1.it)('每条巡检记录在 inspectionIndex 中都能找到', () => {
        strict_1.default.equal(pkg.inspectionIndex.length, result.details.length);
        for (const d of result.details) {
            const found = pkg.inspectionIndex.find(i => i.inspectionRecordId === d.recordId);
            strict_1.default.ok(found, `找不到 ${d.recordId} 的索引`);
            strict_1.default.equal(found.rawEquipmentId, d.rawEquipmentId);
        }
    });
    (0, node_test_1.it)('inspectionIndex 中 anomalyQueueIds 都能对应上异常队列', () => {
        for (const idx of pkg.inspectionIndex) {
            for (const qid of idx.anomalyQueueIds) {
                strict_1.default.ok(result.anomalyQueue.some(q => q.id === qid), `索引中的队列 ${qid} 在队列里找不到`);
            }
        }
    });
    (0, node_test_1.it)('pendingActionCount + completedActionCount = checklist 总条数', () => {
        strict_1.default.equal(pkg.pendingActionCount + pkg.completedActionCount, pkg.checklist.length);
    });
});
(0, node_test_1.describe)('证据缺口（WarningDetail.evidenceGap）', () => {
    const normalizer = new index_1.EquipmentNormalizer(TEST_MAPPINGS);
    const engine = new index_1.CutterheadWarningEngine(normalizer, TEST_THRESHOLDS);
    const inspections = mkInspections();
    const result = engine.generate(inspections);
    (0, node_test_1.it)('达到 warning 但没备注 → 含 inspection_remark_missing（R-004 主驱动油温 78℃）', () => {
        const d = result.details.find(x => x.recordId === 'R-004');
        strict_1.default.ok(d);
        strict_1.default.ok(d.evidenceGap.some(g => g.type === 'inspection_remark_missing'), 'R-004 应提示缺巡检备注');
    });
    (0, node_test_1.it)('R-008（刀盘振动幅值，未定义阈值）→ threshold_not_defined', () => {
        const d = result.details.find(x => x.recordId === 'R-008');
        strict_1.default.ok(d.evidenceGap.some(g => g.type === 'threshold_not_defined'));
    });
    (0, node_test_1.it)('R-006 (critical) → followup_needed', () => {
        const d = result.details.find(x => x.recordId === 'R-006');
        strict_1.default.ok(d.evidenceGap.some(g => g.type === 'followup_needed'));
    });
});
//# sourceMappingURL=cutterhead-warning.test.js.map