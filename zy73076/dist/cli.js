#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
// ============================================================
// 盾构刀盘阈值预警 — 命令行交接入口
//
// 用法: node dist/cli.js <command> [options]
// 子命令:
//   projects              列出所有项目
//   overview -p <P-001>   项目预警汇总
//   details  -p <P-001>   异常明细 (--level warning/critical/...)
//   queue    -p <P-001>   异常队列（含挂起）
//   changes  -p <P-001>   判断变更清单
//   remark   --record <id> --text "..."  补充巡检备注
//   confirm  <queueId> --canonical <SD-001>  项目经理确认设备编号
//   manager  -p <P-001>   项目经理视图（汇总 + 待确认 + 证据缺口）
//   handover -p <P-001>   小林交接清单
//   demo                  跑完整验收场景演示
// ============================================================
// ---------- 初始数据 ----------
const MAPPINGS = [
    { canonicalId: 'SD-001', projectId: 'P-001',
        aliases: ['盾构1号', 'SD001', 'sd-001', 'SD－001', '盾构机001'],
        description: '1号盾构机（左线）' },
    { canonicalId: 'SD-002', projectId: 'P-001',
        aliases: ['盾构2号', 'SD002', 'sd-002', '盾构机002'],
        description: '2号盾构机（右线）' },
    { canonicalId: 'SD-003', projectId: 'P-002',
        aliases: ['盾构3号', 'SD003'],
        description: '3号盾构机' },
    { canonicalId: 'SD-004', projectId: 'P-002',
        aliases: ['盾构4号', 'SD004'],
        description: '4号盾构机' },
];
const THRESHOLDS = [
    { itemName: '刀盘磨损量', unit: 'mm', direction: 'upper',
        thresholds: { attention: 8, warning: 15, critical: 25 },
        description: '刀盘滚刀磨损量上限' },
    { itemName: '主驱动油温', unit: '℃', direction: 'upper',
        thresholds: { attention: 65, warning: 75, critical: 85 },
        description: '主驱动液压油温上限' },
    { itemName: '刀盘转速', unit: 'rpm', direction: 'lower',
        thresholds: { attention: 1, warning: 0.5, critical: 0.2 },
        description: '刀盘转速下限' },
];
function initialInspections() {
    const ts = new Date().toISOString();
    return [
        // === P-001 项目 ===
        // SD-001 的 3 种写法（会被识别为 duplicate → 挂起）
        { id: 'R001', inspectionDate: '2026-06-01', rawEquipmentId: 'SD001',
            inspector: '张工', itemName: '刀盘磨损量', measuredValue: 6, unit: 'mm',
            remark: '', createdAt: ts },
        { id: 'R002', inspectionDate: '2026-06-02', rawEquipmentId: '盾构1号',
            inspector: '张工', itemName: '刀盘磨损量', measuredValue: 10, unit: 'mm',
            remark: '', createdAt: ts },
        { id: 'R003', inspectionDate: '2026-06-03', rawEquipmentId: 'SD-001',
            inspector: '李工', itemName: '刀盘磨损量', measuredValue: 18, unit: 'mm',
            remark: '发现偏磨', createdAt: ts },
        { id: 'R004', inspectionDate: '2026-06-03', rawEquipmentId: 'SD-001',
            inspector: '李工', itemName: '主驱动油温', measuredValue: 78, unit: '℃',
            remark: '', createdAt: ts },
        // SD-002
        { id: 'R005', inspectionDate: '2026-06-02', rawEquipmentId: '盾构2号',
            inspector: '王工', itemName: '刀盘磨损量', measuredValue: 28, unit: 'mm',
            remark: '多把滚刀超限', createdAt: ts },
        { id: 'R006', inspectionDate: '2026-06-03', rawEquipmentId: 'SD-002',
            inspector: '王工', itemName: '主驱动油温', measuredValue: 68, unit: '℃',
            remark: '', createdAt: ts },
        // === P-002 项目 ===
        { id: 'R101', inspectionDate: '2026-06-02', rawEquipmentId: 'SD-003',
            inspector: '赵工', itemName: '刀盘磨损量', measuredValue: 12, unit: 'mm',
            remark: '', createdAt: ts },
        { id: 'R102', inspectionDate: '2026-06-03', rawEquipmentId: '盾构3号',
            inspector: '赵工', itemName: '刀盘磨损量', measuredValue: 22, unit: 'mm',
            remark: '', createdAt: ts },
        { id: 'R103', inspectionDate: '2026-06-03', rawEquipmentId: 'SD-004',
            inspector: '钱工', itemName: '主驱动油温', measuredValue: 82, unit: '℃',
            remark: '高温报警', createdAt: ts },
        { id: 'R104', inspectionDate: '2026-06-04', rawEquipmentId: 'SD-004',
            inspector: '钱工', itemName: '刀盘转速', measuredValue: 0.3, unit: 'rpm',
            remark: '', createdAt: ts },
    ];
}
// ---------- 应用状态 ----------
let inspections = initialInspections();
const normalizer = new index_1.EquipmentNormalizer(MAPPINGS);
const engine = new index_1.CutterheadWarningEngine(normalizer, THRESHOLDS);
const queueWf = new index_1.AnomalyQueueWorkflow();
function currentResult(criteria = {}) {
    const full = {
        dateRange: criteria.dateRange ?? null,
        projectId: criteria.projectId ?? null,
        equipmentIds: criteria.equipmentIds ?? null,
        warningLevels: criteria.warningLevels ?? null,
        includeSuspended: criteria.includeSuspended ?? true,
    };
    return engine.generate(inspections, full);
}
// ---------- 命令解析 ----------
function parseArgs() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        return { cmd: 'help', opts: new Map() };
    }
    const cmd = args[0];
    const opts = new Map();
    let i = 1;
    while (i < args.length) {
        const a = args[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const val = args[i + 1];
            if (val && !val.startsWith('-')) {
                opts.set(key, val);
                i += 2;
            }
            else {
                opts.set(key, 'true');
                i += 1;
            }
        }
        else if (a.startsWith('-') && a.length === 2) {
            const short = a[1];
            const val = args[i + 1];
            const map = { p: 'project', l: 'level', r: 'record', t: 'text', c: 'canonical' };
            const key = map[short] ?? short;
            if (val && !val.startsWith('-')) {
                opts.set(key, val);
                i += 2;
            }
            else {
                opts.set(key, 'true');
                i += 1;
            }
        }
        else {
            opts.set('__arg1', a);
            i += 1;
        }
    }
    return { cmd, opts };
}
// ---------- 工具：输出格式化 ----------
function hline(char = '═') {
    return char.repeat(72);
}
function section(title) {
    console.log();
    console.log(hline());
    console.log('  ' + title);
    console.log(hline());
}
function levelBadge(l) {
    const map = {
        normal: '  正常  ',
        attention: '  注意  ',
        warning: '  预警  ',
        critical: '  严重  ',
    };
    return map[l];
}
function pad(s, n, right = false) {
    const str = String(s);
    if (str.length >= n)
        return str.slice(0, n);
    const pad = ' '.repeat(n - str.length);
    return right ? str + pad : pad + str;
}
// ---------- 各子命令 ----------
function cmdProjects() {
    section('项目列表');
    const projs = normalizer.listAllProjects();
    for (const p of projs) {
        const devices = normalizer.getAllMappings().filter(m => m.projectId === p);
        console.log(`  ${pad(p, 10)}  ${devices.length} 台设备：${devices.map(d => d.canonicalId).join(', ')}`);
    }
    console.log();
    console.log('  提示: 使用 -p <项目ID> 指定项目查看详情');
}
function cmdOverview(projectId) {
    const title = projectId ? `项目 ${projectId} 预警汇总` : '全量预警汇总';
    section(title);
    const r = currentResult({ projectId });
    const s = r.statistics;
    console.log(`  巡检记录总数: ${s.totalInspections}`);
    console.log(`  涉及设备数:   ${s.totalEquipments}`);
    console.log(`  挂起待确认:   ${s.suspendedCount} 条（设备编号重复/歧义）`);
    console.log(`  含证据缺口:   ${s.evidenceGapCount} 条`);
    console.log();
    console.log('  按级别分布:');
    const levels = ['critical', 'warning', 'attention', 'normal'];
    for (const l of levels) {
        console.log(`    ${levelBadge(l)}  ${pad(s.byLevel[l], 4)} 条`);
    }
    console.log();
    console.log('  按设备（Top）:');
    const topEquips = Object.entries(s.byEquipment)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    for (const [eid, cnt] of topEquips) {
        console.log(`    ${pad(eid, 14)} ${pad(cnt, 3)} 条记录`);
    }
    console.log();
    console.log(`  生成时间: ${r.generatedAt}`);
}
function cmdDetails(projectId, level) {
    const title = projectId ? `项目 ${projectId} 异常明细` : '全量异常明细';
    section(title + (level ? `（级别: ${level}）` : ''));
    const levels = level ? [level] : null;
    const r = currentResult({ projectId, warningLevels: levels });
    if (r.details.length === 0) {
        console.log('  （无符合条件的记录）');
        return;
    }
    // 表格式输出
    const h = `${pad('记录ID', 8)} ${pad('日期', 12)} ${pad('设备(规范)', 14)} ${pad('原始写法', 12)} ${pad('巡检项', 12)} ${pad('测值', 8)} ${pad('级别', 8)} ${pad('证据缺口', 10)}`;
    console.log('  ' + h);
    console.log('  ' + '─'.repeat(100));
    for (const d of r.details) {
        const gaps = d.evidenceGap.length > 0
            ? `${d.evidenceGap.length} 项`
            : ' 无 ';
        console.log('  ' +
            pad(d.recordId, 8) + ' ' +
            pad(d.inspectionDate, 12) + ' ' +
            pad(d.equipmentId, 14) + ' ' +
            pad(d.rawEquipmentId, 12) + ' ' +
            pad(d.itemName, 12) + ' ' +
            pad(`${d.measuredValue}${d.unit}`, 8) + ' ' +
            pad(levelBadge(d.level), 8) + ' ' +
            pad(gaps, 10));
        if (d.evidenceGap.length > 0) {
            for (const g of d.evidenceGap) {
                console.log(`      ▸ ${g.type}: ${g.description}`);
            }
        }
    }
    console.log();
    console.log(`  共 ${r.details.length} 条明细，均来自同一批筛选结果，与统计/队列口径一致。`);
}
function cmdQueue(projectId) {
    const title = projectId ? `项目 ${projectId} 异常队列` : '全量异常队列';
    section(title);
    const r = currentResult({ projectId });
    if (r.anomalyQueue.length === 0) {
        console.log('  （无队列记录）');
        return;
    }
    for (const q of r.anomalyQueue) {
        const statusMap = {
            pending_confirmation: '⏳待确认',
            confirmed_warning: '✅已确认',
            false_alarm: '❌误报',
            resolved: '🎉已闭环',
            transferred: '📨已交接',
        };
        const statusLabel = statusMap[q.status] ?? q.status;
        console.log(`  ${pad(q.id, 16)} ${levelBadge(q.level)} ${pad(statusLabel, 8)}  ` +
            `分配给: ${q.assignedTo}`);
        console.log(`     设备: ${q.equipmentId}`);
        console.log(`     原始写法: [${q.rawEquipmentIds.join(', ')}]`);
        if (q.suspensionReason) {
            console.log(`     挂起原因: ${q.suspensionReason}`);
        }
        console.log(`     关联记录: ${q.warningDetailId}`);
        const lastLog = q.history[q.history.length - 1];
        console.log(`     最新状态: ${lastLog.comment}（${lastLog.operator} @ ${lastLog.timestamp}）`);
        console.log();
    }
    console.log(`  共 ${r.anomalyQueue.length} 条队列记录。`);
    console.log('  提示: 使用 confirm <队列ID> --canonical <规范编号> 可由项目经理确认设备编号。');
}
function cmdChanges(projectId) {
    const title = projectId ? `项目 ${projectId} 判断变更清单` : '全量判断变更清单';
    section(title);
    const r = currentResult({ projectId });
    const reporter = new index_1.JudgmentChangeReporter();
    if (r.judgmentChanges.length === 0) {
        console.log('  （无判断变更）');
        return;
    }
    console.log(reporter.toReviewBriefing(r.judgmentChanges));
    console.log();
    console.log('  详细列表（可直接粘贴到巡检表备注）:');
    for (let i = 0; i < r.judgmentChanges.length; i++) {
        const jc = r.judgmentChanges[i];
        console.log();
        console.log(`  [${i + 1}] 设备: ${jc.equipmentId} | 巡检项: ${jc.itemName} | 原因: ${jc.changeReason}`);
        console.log(`      前: ${jc.previousJudgment?.conclusion ?? '（首次纳入）'}`);
        console.log(`      后: ${jc.currentJudgment.conclusion}`);
        console.log(`      备注: ${jc.remarkForReview ?? ''}`);
        console.log(`      受影响记录: ${jc.affectedRecordIds.join(', ')}`);
    }
}
function cmdRemark(recordId, text) {
    section(`补充巡检备注 → ${recordId}`);
    const idx = inspections.findIndex(r => r.id === recordId);
    if (idx === -1) {
        console.log(`  ❌ 未找到记录 ${recordId}`);
        return;
    }
    const before = inspections[idx];
    const oldRemark = before.remark ?? '';
    const beforeLevel = engine.generate([before]).details[0]?.level ?? 'normal';
    inspections[idx] = {
        ...before,
        remark: text,
    };
    const afterLevel = engine.generate([inspections[idx]]).details[0]?.level ?? 'normal';
    console.log(`  ✅ 已更新 ${recordId} 的备注`);
    console.log(`     旧备注: "${oldRemark}"`);
    console.log(`     新备注: "${text}"`);
    console.log(`     级别: ${beforeLevel} → ${afterLevel}${beforeLevel === afterLevel ? '（未变）' : ''}`);
    console.log();
    console.log('  提示: 可运行 changes 命令查看本批次所有判断变更。');
}
function cmdConfirm(queueId, canonical) {
    section(`项目经理确认设备编号 → ${queueId}`);
    const r = currentResult();
    const q = r.anomalyQueue.find(x => x.id === queueId);
    if (!q) {
        console.log(`  ❌ 未找到队列 ${queueId}`);
        return;
    }
    if (q.status !== 'pending_confirmation') {
        console.log(`  ⚠ 队列状态为 ${q.status}，无需再确认`);
        return;
    }
    // 验证规范编号存在
    const projs = normalizer.getProjectOfCanonical(canonical);
    if (!projs) {
        console.log(`  ❌ 规范编号 ${canonical} 不存在于设备映射中`);
        return;
    }
    const updated = queueWf.confirmEquipment(q, '项目经理', canonical, 'CLI 交互确认');
    console.log(`  ✅ 已确认`);
    console.log(`     队列: ${updated.id}`);
    console.log(`     状态: ${q.status} → ${updated.status}`);
    console.log(`     分配给: ${updated.assignedTo}`);
    console.log(`     最新日志: ${updated.history[updated.history.length - 1].comment}`);
    console.log();
    console.log('  说明: 此处仅展示状态流转结果，实际引擎生成结果以重新计算为准。');
    console.log('        若要持久化确认结果，请将对应巡检记录的 rawEquipmentId 统一为规范写法。');
}
function cmdManager(projectId) {
    const title = projectId
        ? `项目经理视图 — 项目 ${projectId}`
        : '项目经理视图 — 全量';
    section(title);
    const r = currentResult({ projectId });
    const view = new index_1.ManagerViewBuilder().build(r);
    // 1. 概览
    const s = view.overview;
    console.log('  📊 概览');
    console.log(`     巡检记录: ${s.totalInspections}  设备: ${s.totalEquipments}  挂起待确认: ${s.suspendedCount}`);
    for (const row of view.summaryBreakdown) {
        const gaps = row.evidenceGapSummary.length
            ? `证据缺口: ${row.evidenceGapSummary.map(g => `${g.type}×${g.count}`).join(', ')}`
            : '无证据缺口';
        console.log(`     ${levelBadge(row.level)} ${pad(row.count, 3)} 条 / ${pad(row.equipmentCount, 2)} 台设备  |  ${gaps}`);
    }
    // 2. 待确认清单
    console.log();
    console.log('  ⏳ 待确认清单（不确认的假稳定风险）');
    if (view.pendingConfirmations.length === 0) {
        console.log('     （无待确认项）');
    }
    for (let i = 0; i < view.pendingConfirmations.length; i++) {
        const pc = view.pendingConfirmations[i];
        console.log(`     [${i + 1}] 队列: ${pc.queueId}`);
        console.log(`         原始写法: [${pc.rawEquipmentIds.join(', ')}]`);
        console.log(`         候选规范编号: ${pc.candidateCanonicalIds.join(' / ')}`);
        console.log(`         受影响预警: ${pc.affectedWarningCount} 条`);
        console.log(`         ⚠ 假稳定风险: ${pc.riskOfFalseStability.slice(0, 80)}...`);
    }
    // 3. 证据缺口
    console.log();
    console.log('  🧩 还剩哪些证据没补齐');
    if (view.outstandingEvidenceGaps.length === 0) {
        console.log('     （证据齐全）');
    }
    for (const g of view.outstandingEvidenceGaps) {
        const equips = g.relatedEquipments.slice(0, 5).join(', ');
        const more = g.relatedEquipments.length > 5 ? ` ...（+${g.relatedEquipments.length - 5}）` : '';
        console.log(`     · ${pad(g.gapType, 28)} ×${pad(g.count, 3)}  设备: ${equips}${more}`);
        console.log(`       → ${g.suggestedAction}`);
    }
    console.log();
    console.log('  🔍 下钻提示: 用 details --level <级别> 可查看对应明细，与汇总口径一致。');
}
function cmdHandover(projectId) {
    const title = projectId
        ? `小林交接清单 — 项目 ${projectId}`
        : '小林交接清单 — 全量';
    section(title);
    const r = currentResult({ projectId });
    const pkg = new index_1.HandoverPackager().build(r);
    console.log(`  总步骤: ${pkg.checklist.length}`);
    console.log(`  已完成前置: ${pkg.completedActionCount}`);
    console.log(`  待办: ${pkg.pendingActionCount}`);
    console.log();
    for (const step of pkg.checklist) {
        const mark = step.completed ? '✅' : '⬜';
        console.log(`  ${mark} Step ${step.step}: ${step.description}`);
        if (step.relatedAnomalyQueueIds.length > 0) {
            console.log(`     关联队列: ${step.relatedAnomalyQueueIds.join(', ')}`);
        }
        console.log();
    }
    console.log('  📋 巡检表 → 异常队列 索引（顺着巡检表就能找到对应队列）');
    console.log('  ' + '─'.repeat(100));
    const header = pad('记录ID', 8) + ' ' +
        pad('原始写法', 12) + ' ' +
        pad('规范编号', 14) + ' ' +
        pad('队列', 20) + ' ' +
        pad('判断变更', 8);
    console.log('  ' + header);
    for (const idx of pkg.inspectionIndex) {
        const canonical = idx.canonicalEquipmentId ?? '⚠未确认';
        const queues = idx.anomalyQueueIds.join(',') || '-';
        const changes = idx.judgmentChangeIds.length > 0 ? String(idx.judgmentChangeIds.length) : '-';
        console.log('  ' +
            pad(idx.inspectionRecordId, 8) + ' ' +
            pad(idx.rawEquipmentId, 12) + ' ' +
            pad(canonical, 14) + ' ' +
            pad(queues, 20) + ' ' +
            pad(changes, 8));
    }
    console.log();
    console.log('  💡 小林收尾步骤:');
    console.log('     1) 打开 manager 视图看还有哪些证据没补齐');
    console.log('     2) 用 remark 命令补巡检备注');
    console.log('     3) 找项目经理用 confirm 确认重复设备编号');
    console.log('     4) 顺着本清单的队列逐一闭环');
    console.log('     5) 全部完成后，本交接包即可作为归档凭证');
}
function cmdDemo() {
    section('验收场景演示 — 项目 P-001');
    console.log('  场景: 同一份巡检数据同时有 P-001 和 P-002，');
    console.log('        选 P-001 后不应出现 P-002 设备；');
    console.log('        临时补一条备注后，系统展示受影响的判断变化；');
    console.log('        遇到设备编号重复 → 进待确认队列，不给假稳定结论；');
    console.log('        最终小林能顺着巡检表、异常队列、待补证据完成交接。');
    // Step 1: 确认 P-001 不混入 P-002
    console.log();
    console.log('  ── Step 1: 项目维度筛选验证 ──');
    const r1 = currentResult({ projectId: 'P-001' });
    const equipIds = Array.from(new Set(r1.details.map(d => d.equipmentId)));
    console.log(`  P-001 涉及设备: ${equipIds.join(', ')}`);
    console.log(`  含 SD-003/SD-004 (P-002)? ${equipIds.some(e => e === 'SD-003' || e === 'SD-004') ? '是 ❌' : '否 ✅'}`);
    console.log(`  明细条数: ${r1.details.length}，队列条数: ${r1.anomalyQueue.length}，判断变更: ${r1.judgmentChanges.length}`);
    console.log('  → 统计、明细、队列、变更均来自同一套筛选结果，口径一致。');
    // Step 2: 挂起机制
    console.log();
    console.log('  ── Step 2: 设备编号重复挂起（宁可挂起不给假稳定） ──');
    const pending = r1.anomalyQueue.filter(q => q.status === 'pending_confirmation');
    console.log(`  挂起队列数: ${pending.length}`);
    for (const q of pending) {
        console.log(`    - ${q.id}: 原始写法 [${q.rawEquipmentIds.join(', ')}] → 规范编号候选: ${q.equipmentId}`);
        console.log(`      挂起原因: ${q.suspensionReason}`);
        console.log('      （不确认就不给出稳定结论，避免"拆分统计导致的假稳定"）');
    }
    // Step 3: 补备注
    console.log();
    console.log('  ── Step 3: 临时补充巡检备注 ──');
    console.log('  补充 R004（SD-001 主驱动油温 78℃）的备注: "现场确认散热风扇故障，已报修"');
    cmdRemark('R004', '现场确认散热风扇故障，已报修');
    // Step 4: 判断变更
    console.log();
    console.log('  ── Step 4: 查看本批次判断变更 ──');
    cmdChanges('P-001');
    // Step 5: 项目经理视图
    console.log();
    console.log('  ── Step 5: 项目经理视图（一眼看证据缺口 + 待确认） ──');
    cmdManager('P-001');
    // Step 6: 小林交接
    console.log();
    console.log('  ── Step 6: 小林交接清单 ──');
    cmdHandover('P-001');
    console.log();
    console.log(hline());
    console.log('  ✅ 验收场景演示完成。所有输出均从同一 WarningResultSet 生成，口径一致。');
    console.log(hline());
}
function cmdHelp() {
    console.log(hline());
    console.log('  盾构刀盘阈值预警 — 命令行交接工具');
    console.log(hline());
    console.log();
    console.log('  用法: node dist/cli.js <command> [options]');
    console.log();
    console.log('  子命令:');
    console.log('    projects              列出所有项目');
    console.log('    overview  -p P-001    项目预警汇总');
    console.log('    details   -p P-001 [--level warning]  异常明细');
    console.log('    queue     -p P-001    异常队列（含挂起）');
    console.log('    changes   -p P-001    判断变更清单（评审会备注）');
    console.log('    remark    --record R004 --text "..."   补充巡检备注');
    console.log('    confirm   <queueId>  --canonical SD-001  项目经理确认设备');
    console.log('    manager   -p P-001    项目经理视图（汇总+待确认+证据缺口）');
    console.log('    handover  -p P-001    小林交接清单');
    console.log('    demo                  跑完整验收场景');
    console.log();
    console.log('  设计原则:');
    console.log('    · 筛选 / 统计 / 明细 / 队列 / 变更 同源生成，口径一致');
    console.log('    · 设备编号重复 → 一律挂起等项目经理确认，不给假稳定结论');
    console.log('    · 顺着巡检表 → 异常队列 → 判断变更 → 证据缺口 可完成全流程交接');
    console.log();
}
// ---------- 入口 ----------
const { cmd, opts } = parseArgs();
const projectId = opts.get('project') ?? null;
const level = opts.get('level') ?? null;
switch (cmd) {
    case 'projects':
        cmdProjects();
        break;
    case 'overview':
        cmdOverview(projectId);
        break;
    case 'details':
        cmdDetails(projectId, level);
        break;
    case 'queue':
        cmdQueue(projectId);
        break;
    case 'changes':
        cmdChanges(projectId);
        break;
    case 'remark': {
        const recordId = opts.get('record') ?? opts.get('__arg1') ?? '';
        const text = opts.get('text') ?? '';
        if (!recordId || !text) {
            console.log('  ❌ 用法: remark --record <记录ID> --text "备注内容"');
        }
        else {
            cmdRemark(recordId, text);
        }
        break;
    }
    case 'confirm': {
        const queueId = opts.get('__arg1') ?? '';
        const canonical = opts.get('canonical') ?? '';
        if (!queueId || !canonical) {
            console.log('  ❌ 用法: confirm <队列ID> --canonical <规范编号>');
        }
        else {
            cmdConfirm(queueId, canonical);
        }
        break;
    }
    case 'manager':
        cmdManager(projectId);
        break;
    case 'handover':
        cmdHandover(projectId);
        break;
    case 'demo':
        cmdDemo();
        break;
    case 'help':
    case '--help':
    case '-h':
    default:
        cmdHelp();
}
//# sourceMappingURL=cli.js.map