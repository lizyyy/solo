"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandoverPackager = exports.JudgmentChangeReporter = exports.AnomalyQueueWorkflow = exports.ManagerViewBuilder = void 0;
// ============================================================
// 项目经理视图构建器
// 核心诉求：
// - 汇总口径 → 异常明细的下钻链路一致
// - 一眼看出还剩哪些证据没补齐
// - 待确认（挂起）清单必须说明"不确认的后果"（假稳定风险）
// ============================================================
class ManagerViewBuilder {
    build(resultSet) {
        const { statistics, details, anomalyQueue, judgmentChanges } = resultSet;
        // ---- 1. 汇总口径下钻（按级别分解 + 证据缺口聚合 + 下钻筛选条件） ----
        const summaryBreakdown = this.buildSummaryBreakdown(statistics, details, resultSet.filterCriteria);
        // ---- 2. 项目经理待确认清单（设备编号重复/歧义） ----
        const pendingConfirmations = anomalyQueue
            .filter(q => q.status === 'pending_confirmation')
            .map(q => this.buildPendingConfirmation(q, details));
        // ---- 3. 证据缺口清单（还剩哪些证据没补齐）----
        const outstandingEvidenceGaps = this.buildOutstandingGaps(details);
        return {
            overview: statistics,
            summaryBreakdown,
            pendingConfirmations,
            outstandingEvidenceGaps,
        };
    }
    // ---------- 下钻结构：保证汇总口径 → 明细 对接 ----------
    buildSummaryBreakdown(statistics, details, baseFilter) {
        const levels = ['critical', 'warning', 'attention', 'normal'];
        return levels.map(level => {
            const inLevel = details.filter(d => d.level === level);
            const equipments = new Set(inLevel.map(d => d.equipmentId));
            // 聚合该级别下的证据缺口
            const gapCounter = new Map();
            for (const d of inLevel) {
                for (const g of d.evidenceGap) {
                    gapCounter.set(g.type, (gapCounter.get(g.type) ?? 0) + 1);
                }
            }
            const evidenceGapSummary = Array.from(gapCounter.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => ({ type, count }));
            // 汇总数对应的下钻筛选条件（点击数字就能定位到同一明细）
            const drillDownFilter = {
                ...baseFilter,
                warningLevels: [level],
                includeSuspended: baseFilter.includeSuspended ?? true,
            };
            return {
                level,
                count: statistics.byLevel[level],
                equipmentCount: equipments.size,
                evidenceGapSummary,
                drillDownFilter,
            };
        });
    }
    buildPendingConfirmation(q, details) {
        const relatedWarnings = details.filter(d => q.warningDetailId.includes(d.recordId));
        // 候选规范编号：从 details 中的 equipmentId 取（挂起时可能是 PENDING(...)）
        const candidateSet = new Set();
        for (const d of relatedWarnings) {
            if (d.equipmentId.startsWith('PENDING(')) {
                const inner = d.equipmentId.slice('PENDING('.length, -1);
                candidateSet.add(inner);
            }
            else {
                candidateSet.add(d.equipmentId);
            }
        }
        return {
            queueId: q.id,
            rawEquipmentIds: q.rawEquipmentIds,
            candidateCanonicalIds: Array.from(candidateSet),
            affectedWarningCount: relatedWarnings.length,
            riskOfFalseStability: this.describeFalseStabilityRisk(q, relatedWarnings),
        };
    }
    // 说明不确认的后果（假稳定风险）
    describeFalseStabilityRisk(q, related) {
        const rawIds = q.rawEquipmentIds.join('、');
        const byLevel = new Map();
        for (const d of related) {
            byLevel.set(d.level, (byLevel.get(d.level) ?? 0) + 1);
        }
        const levelDesc = Array.from(byLevel.entries())
            .map(([l, n]) => `${this.levelLabel(l)} × ${n}`)
            .join('，');
        const reason = q.suspensionReason === 'duplicate_equipment'
            ? `原始写法 [${rawIds}] 可能指向同一台物理设备`
            : `原始写法 [${rawIds}] 存在歧义`;
        return (`${reason}。` +
            `若现在不确认就直接出结论：` +
            `①按不同编号拆开统计 → 总数看似分散，可能因单条数据未达阈值而给出"稳定"的假结论；` +
            `②按同一编号合并统计 → 当前命中：${levelDesc}。` +
            `请项目经理明确归属后系统再统一出具结论（宁可挂起也不给假稳定）。`);
    }
    // ---------- 证据缺口清单 ----------
    buildOutstandingGaps(details) {
        const agg = new Map();
        for (const d of details) {
            for (const g of d.evidenceGap) {
                if (!agg.has(g.type)) {
                    agg.set(g.type, { count: 0, equipments: new Set() });
                }
                const node = agg.get(g.type);
                node.count++;
                node.equipments.add(d.equipmentId);
            }
        }
        const priorityOrder = [
            'equipment_not_confirmed',
            'threshold_not_defined',
            'inspection_remark_missing',
            'followup_needed',
            'no_previous_record',
        ];
        return priorityOrder
            .filter(t => agg.has(t))
            .map(type => {
            const node = agg.get(type);
            return {
                gapType: type,
                count: node.count,
                relatedEquipments: Array.from(node.equipments).slice(0, 10), // 最多列 10 个
                suggestedAction: this.suggestActionFor(type),
            };
        })
            .concat(Array.from(agg.entries())
            .filter(([t]) => !priorityOrder.includes(t))
            .map(([type, node]) => ({
            gapType: type,
            count: node.count,
            relatedEquipments: Array.from(node.equipments).slice(0, 10),
            suggestedAction: this.suggestActionFor(type),
        })));
    }
    suggestActionFor(type) {
        switch (type) {
            case 'equipment_not_confirmed':
                return '项目经理在异常队列中确认设备编号归属（挂起→已确认）';
            case 'threshold_not_defined':
                return '技术负责人补齐该巡检项的阈值规则';
            case 'inspection_remark_missing':
                return '现场巡检员在巡检表中补充备注/现场处理说明';
            case 'followup_needed':
                return '安排现场二次复核，并出具处置/维修单';
            case 'no_previous_record':
                return '纳入下次巡检计划，收集至少 2 次数据建立趋势';
            default:
                return '按作业指引补充对应证据';
        }
    }
    levelLabel(l) {
        return {
            normal: '正常', attention: '注意', warning: '预警', critical: '严重',
        }[l];
    }
}
exports.ManagerViewBuilder = ManagerViewBuilder;
// ============================================================
// 异常队列操作（项目经理确认 / 状态流转）
// ============================================================
class AnomalyQueueWorkflow {
    // 项目经理确认：设备编号归属无误 → 队列从 pending → confirmed_warning
    confirmEquipment(queue, operator, confirmedCanonicalId, comment) {
        const ts = new Date().toISOString();
        const log = {
            timestamp: ts,
            from: queue.status,
            to: 'confirmed_warning',
            operator,
            comment: `确认设备编号归属 → 规范编号 ${confirmedCanonicalId}。` +
                (comment ?? ''),
        };
        return {
            ...queue,
            equipmentId: confirmedCanonicalId,
            status: 'confirmed_warning',
            assignedTo: 'assistant_xiaolin',
            suspensionReason: undefined,
            updatedAt: ts,
            history: [...queue.history, log],
        };
    }
    // 项目经理判定误报（其实是不同设备，不是重复）
    markFalseAlarm(queue, operator, comment) {
        const ts = new Date().toISOString();
        const log = {
            timestamp: ts,
            from: queue.status,
            to: 'false_alarm',
            operator,
            comment: `判定为误报：${comment}`,
        };
        return {
            ...queue,
            status: 'false_alarm',
            assignedTo: 'assistant_xiaolin',
            updatedAt: ts,
            history: [...queue.history, log],
        };
    }
    // 项目助理/现场处置完成
    markResolved(queue, operator, resolution) {
        const ts = new Date().toISOString();
        const log = {
            timestamp: ts,
            from: queue.status,
            to: 'resolved',
            operator,
            comment: `已处置闭环：${resolution}`,
        };
        return {
            ...queue,
            status: 'resolved',
            assignedTo: 'assistant_xiaolin',
            updatedAt: ts,
            history: [...queue.history, log],
        };
    }
    // 交接：从开发者 → 项目助理小林
    transferToAssistant(queue, operator, handoverDoc) {
        const ts = new Date().toISOString();
        const log = {
            timestamp: ts,
            from: queue.status,
            to: 'transferred',
            operator,
            comment: `交接给项目助理小林；交接凭证：${handoverDoc}`,
        };
        return {
            ...queue,
            status: 'transferred',
            assignedTo: 'assistant_xiaolin',
            updatedAt: ts,
            history: [...queue.history, log],
        };
    }
    // 从结果集中批量应用状态 → 生成新队列数组
    applyAll(queues, updater) {
        return queues.map(updater);
    }
}
exports.AnomalyQueueWorkflow = AnomalyQueueWorkflow;
// ============================================================
// 巡检表备注 / 判断变更导出（给评审会用）
// ============================================================
class JudgmentChangeReporter {
    // 把 judgmentChanges 打包成巡检表备注格式（可直接粘贴到巡检表"备注"列）
    toInspectionRemarks(changes) {
        return changes.map(c => c.remarkForReview ?? '');
    }
    // 按设备分组输出"哪些判断变了"（评审会发言要点）
    toReviewBriefing(changes) {
        if (changes.length === 0)
            return '本次无判断变更。';
        const lines = [];
        lines.push('【盾构刀盘阈值预警 · 本批次判断变更要点】');
        lines.push(`共 ${changes.length} 项：`);
        const grouped = new Map();
        for (const c of changes) {
            if (!grouped.has(c.changeReason))
                grouped.set(c.changeReason, []);
            grouped.get(c.changeReason).push(c);
        }
        const reasonLabel = {
            equipment_id_unified: '· 因设备编号统一重新归集：',
            false_stability_removed: '· 移除假稳定结论（原拆分统计误判为稳定）：',
            threshold_updated: '· 阈值规则更新：',
            new_evidence: '· 新增证据/首次纳入：',
        };
        for (const [reason, list] of grouped.entries()) {
            lines.push(reasonLabel[reason] + list.length + ' 项');
            for (const c of list.slice(0, 5)) {
                const prev = c.previousJudgment?.conclusion ?? '（无）';
                lines.push(`  - ${c.equipmentId} · ${c.itemName}：${prev} → ${c.currentJudgment.conclusion}`);
            }
            if (list.length > 5)
                lines.push(`  - ...（其余 ${list.length - 5} 项详见明细表）`);
        }
        return lines.join('\n');
    }
}
exports.JudgmentChangeReporter = JudgmentChangeReporter;
// ============================================================
// 交接流程打包器（项目助理小林用）
// 核心：顺着巡检表 → 异常队列 → 判断变更 就能完成交接，不靠开发者
// ============================================================
class HandoverPackager {
    build(resultSet) {
        const ts = new Date().toISOString();
        const { details, anomalyQueue, judgmentChanges, statistics } = resultSet;
        // 构建巡检表 → 队列/变更 的索引（小林顺着巡检表就能查到所有关联）
        const inspectionIndex = details.map(d => {
            const relatedQueueIds = anomalyQueue
                .filter(q => q.warningDetailId.includes(d.recordId))
                .map(q => q.id);
            const relatedJCIds = judgmentChanges
                .filter(jc => jc.affectedRecordIds.includes(d.recordId))
                .map(jc => jc.id);
            return {
                inspectionRecordId: d.recordId,
                rawEquipmentId: d.rawEquipmentId,
                canonicalEquipmentId: d.equipmentId.startsWith('PENDING(')
                    ? null
                    : d.equipmentId,
                anomalyQueueIds: relatedQueueIds,
                judgmentChangeIds: relatedJCIds,
            };
        });
        // 生成交接 checklist（按逻辑顺序，小林逐条打勾）
        const checklist = this.buildChecklist(resultSet, inspectionIndex);
        const pending = checklist.filter(x => !x.completed).length;
        const done = checklist.filter(x => x.completed).length;
        return {
            generatedAt: ts,
            generatedFor: 'assistant_xiaolin',
            checklist,
            inspectionIndex,
            pendingActionCount: pending,
            completedActionCount: done,
        };
    }
    buildChecklist(rs, index) {
        const items = [];
        const { anomalyQueue, judgmentChanges } = rs;
        // Step 1: 核对巡检表原始编号 → 规范编号映射是否均已解决
        const unconfirmed = index.filter(i => i.canonicalEquipmentId === null);
        const unconfirmedRecIds = unconfirmed.map(i => i.inspectionRecordId);
        const unconfirmedQueueIds = Array.from(new Set(unconfirmed.flatMap(i => i.anomalyQueueIds)));
        items.push({
            step: 1,
            description: unconfirmedRecIds.length === 0
                ? '[完成前置] 巡检表中所有设备编号均已规范化，无需项目经理追加确认。'
                : `[待办] 请项目经理确认 ${unconfirmedRecIds.length} 条巡检记录的设备编号归属（涉及队列：${unconfirmedQueueIds.join('、') || '无'}）。` +
                    ' 方法：打开项目经理视图 → "待确认清单" → 逐条确认规范编号。',
            completed: unconfirmedRecIds.length === 0,
            relatedInspectionRecordIds: unconfirmedRecIds,
            relatedAnomalyQueueIds: unconfirmedQueueIds,
        });
        // Step 2: 巡检表备注补充（达到 warning/critical 但没备注的）
        const remarkMissingRecs = rs.details.filter(d => (d.level === 'warning' || d.level === 'critical') &&
            d.evidenceGap.some(g => g.type === 'inspection_remark_missing'));
        const remarkMissingIds = remarkMissingRecs.map(d => d.recordId);
        items.push({
            step: 2,
            description: remarkMissingIds.length === 0
                ? '[完成前置] 所有达到预警/严重级别的巡检记录均已补充备注。'
                : `[待办] 补齐 ${remarkMissingIds.length} 条巡检记录的现场备注（记录号：${remarkMissingIds.slice(0, 5).join('、')}${remarkMissingIds.length > 5 ? '...' : ''}）。`,
            completed: remarkMissingIds.length === 0,
            relatedInspectionRecordIds: remarkMissingIds,
            relatedAnomalyQueueIds: [],
        });
        // Step 3: 阈值规则缺失检查
        const noThreshold = rs.details.filter(d => d.evidenceGap.some(g => g.type === 'threshold_not_defined'));
        const noThresholdIds = noThreshold.map(d => d.recordId);
        items.push({
            step: 3,
            description: noThresholdIds.length === 0
                ? '[完成前置] 所有巡检项均已配置阈值规则。'
                : `[待办] 请技术负责人补齐 ${new Set(noThreshold.map(d => d.itemName)).size} 类巡检项的阈值规则。`,
            completed: noThresholdIds.length === 0,
            relatedInspectionRecordIds: noThresholdIds,
            relatedAnomalyQueueIds: [],
        });
        // Step 4: 异常队列处置（已确认但未闭环）
        const openQueues = anomalyQueue.filter(q => q.status === 'confirmed_warning');
        items.push({
            step: 4,
            description: openQueues.length === 0
                ? '[完成前置] 无待处置异常。'
                : `[待办] 共 ${openQueues.length} 条异常待现场处置闭环。请顺着异常队列号逐一推进：` +
                    openQueues.slice(0, 3).map(q => `${q.id}(${q.equipmentId})`).join('、') +
                    (openQueues.length > 3 ? '...' : ''),
            completed: openQueues.length === 0,
            relatedInspectionRecordIds: [],
            relatedAnomalyQueueIds: openQueues.map(q => q.id),
        });
        // Step 5: 判断变更评审备注
        items.push({
            step: 5,
            description: judgmentChanges.length === 0
                ? '[完成前置] 本批次无判断变更，无需评审会说明。'
                : `[待办] 将 ${judgmentChanges.length} 条判断变更摘要粘贴到巡检表备注，评审会逐项过会（见 JudgmentChangeReporter 输出）。`,
            completed: judgmentChanges.length === 0,
            relatedInspectionRecordIds: Array.from(new Set(judgmentChanges.flatMap(jc => jc.affectedRecordIds))),
            relatedAnomalyQueueIds: [],
        });
        // Step 6: 严重级别现场复核（critical）
        const criticalQueues = anomalyQueue.filter(q => q.level === 'critical');
        items.push({
            step: 6,
            description: criticalQueues.length === 0
                ? '[完成前置] 无严重级别记录，无需现场二次复核。'
                : `[待办] 对 ${criticalQueues.length} 条严重级别异常出具现场二次复核单与处置单。`,
            completed: criticalQueues.length === 0,
            relatedInspectionRecordIds: [],
            relatedAnomalyQueueIds: criticalQueues.map(q => q.id),
        });
        // Step 7: 收尾归档（开发者 → 小林 交接确认）
        const allClosed = anomalyQueue.every(q => q.status === 'resolved' || q.status === 'false_alarm');
        items.push({
            step: 7,
            description: allClosed
                ? '[完成前置] 所有异常均已闭环，可正式归档。'
                : '[待办] 当以上 1~6 步全部完成后，在每条队列上标记 resolved，并打印本交接包作为归档凭证。',
            completed: allClosed,
            relatedInspectionRecordIds: [],
            relatedAnomalyQueueIds: anomalyQueue.map(q => q.id),
        });
        return items;
    }
}
exports.HandoverPackager = HandoverPackager;
//# sourceMappingURL=workflows.js.map