"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CutterheadWarningEngine = void 0;
class CutterheadWarningEngine {
    normalizer;
    rules;
    previousJudgments = new Map();
    constructor(normalizer, rules = [], previousJudgments) {
        this.normalizer = normalizer;
        this.rules = rules;
        if (previousJudgments) {
            for (const j of previousJudgments) {
                this.previousJudgments.set(j.equipmentId + '|' + j.itemName, j);
            }
        }
    }
    setRules(rules) {
        this.rules = rules;
    }
    // ---------- 对外入口：生成统一预警结果 ----------
    generate(inspections, criteria = {
        dateRange: null,
        projectId: null,
        equipmentIds: null,
        warningLevels: null,
        includeSuspended: true,
    }) {
        const ts = new Date().toISOString();
        // ===== 步骤 1：批量规范化所有设备编号 =====
        const allRawIds = Array.from(new Set(inspections.map(i => i.rawEquipmentId)));
        const { results: normMap, duplicateGroups } = this.normalizer.bulkNormalize(allRawIds);
        // duplicateCanonicals: 需要挂起的规范编号集合（有 2+ 种原始写法）
        const duplicateCanonicals = new Set(duplicateGroups.filter(g => g.pendingConfirmation).map(g => g.canonicalId));
        // rawId 所属的重复组（canonical）
        const rawToDuplicateCanonical = new Map();
        for (const g of duplicateGroups) {
            for (const v of g.rawVariants) {
                rawToDuplicateCanonical.set(v, g.canonicalId);
            }
        }
        // ===== 步骤 2：逐条生成 WarningDetail（中间结果） =====
        const intermediateDetails = [];
        // 按 (规范编号, 巡检项) 归集，方便判断 "缺少历史记录"
        const historyIndex = new Map();
        for (const rec of inspections) {
            const norm = normMap.get(rec.rawEquipmentId);
            // 历史记录索引（按原始记录排序）
            const hKey = (norm.canonical ?? '__unknown__') + '|' + rec.itemName;
            if (!historyIndex.has(hKey))
                historyIndex.set(hKey, []);
            historyIndex.get(hKey).push(rec);
        }
        // 按日期排序，以确定"首次出现"
        for (const [, arr] of historyIndex) {
            arr.sort((a, b) => a.inspectionDate.localeCompare(b.inspectionDate));
        }
        for (const rec of inspections) {
            const norm = normMap.get(rec.rawEquipmentId);
            const rule = this.findRule(rec.itemName, rec.unit);
            const level = this.evaluateLevel(rec, rule);
            // === 证据缺口计算 ===
            const gaps = [];
            // 1. 阈值缺失
            if (!rule) {
                gaps.push({
                    type: 'threshold_not_defined',
                    description: `未定义 [${rec.itemName}(${rec.unit})] 的阈值规则`,
                    priority: 'high',
                });
            }
            // 2. 设备编号未确认（duplicate / ambiguous）
            if (norm.status === 'duplicate' ||
                norm.status === 'ambiguous' ||
                norm.status === 'unknown') {
                const d = this.describeEquipmentIssue(norm.status);
                gaps.push({
                    type: 'equipment_not_confirmed',
                    description: d + `（原始写法：${rec.rawEquipmentId}）`,
                    priority: 'high',
                });
            }
            // 3. 缺少历史对比数据（首次出现该设备+该巡检项）
            const hKey = (norm.canonical ?? '__unknown__') + '|' + rec.itemName;
            const hist = historyIndex.get(hKey) ?? [];
            if (hist.length < 2 && hist[0]?.id === rec.id) {
                gaps.push({
                    type: 'no_previous_record',
                    description: `[${rec.itemName}] 缺少历史巡检数据，无法判断趋势`,
                    priority: 'medium',
                });
            }
            // 4. 巡检备注缺失（达到 warning 及以上但没备注）
            if ((level === 'warning' || level === 'critical') && !rec.remark?.trim()) {
                gaps.push({
                    type: 'inspection_remark_missing',
                    description: `达到 ${this.levelLabel(level)} 但巡检表未填写备注，需补现场说明`,
                    priority: 'high',
                });
            }
            // 5. 严重级别需现场复核
            if (level === 'critical') {
                gaps.push({
                    type: 'followup_needed',
                    description: `达到 critical，需现场二次复核并出具处置单`,
                    priority: 'high',
                });
            }
            const detail = {
                recordId: rec.id,
                inspectionDate: rec.inspectionDate,
                equipmentId: norm.canonical ?? `PENDING(${rec.rawEquipmentId})`,
                rawEquipmentId: rec.rawEquipmentId,
                itemName: rec.itemName,
                measuredValue: rec.measuredValue,
                unit: rec.unit,
                level,
                thresholdBreached: rule
                    ? this.buildThresholdBreach(rec, rule, level)
                    : null,
                evidenceGap: gaps,
            };
            intermediateDetails.push(detail);
        }
        // ===== 步骤 3：生成异常队列 =====
        const anomalyQueue = this.buildAnomalyQueue(intermediateDetails, duplicateCanonicals, rawToDuplicateCanonical, normMap, ts);
        // ===== 步骤 4：生成判断变更记录 =====
        const judgmentChanges = this.buildJudgmentChanges(intermediateDetails, inspections, ts);
        // ===== 步骤 5：应用筛选条件（details / queue / changes 同步过滤，口径一致）=====
        const filtered = this.applyFullFilter(intermediateDetails, anomalyQueue, judgmentChanges, criteria);
        // ===== 步骤 6：统计数字（从过滤后的数据生成，口径一致） =====
        const statistics = this.computeStatistics(filtered.details, filtered.queue, criteria);
        return {
            generatedAt: ts,
            filterCriteria: criteria,
            statistics,
            details: filtered.details,
            anomalyQueue: filtered.queue,
            judgmentChanges: filtered.changes,
        };
    }
    // ---------- 内部：查找阈值规则 ----------
    findRule(itemName, unit) {
        return (this.rules.find(r => r.itemName === itemName && r.unit === unit) ??
            this.rules.find(r => r.itemName === itemName) ??
            null);
    }
    // ---------- 内部：根据阈值判断级别 ----------
    evaluateLevel(rec, rule) {
        if (!rule)
            return 'normal';
        const v = rec.measuredValue;
        const t = rule.thresholds;
        if (rule.direction === 'upper' || rule.direction === 'both') {
            if (t.critical != null && v >= t.critical)
                return 'critical';
            if (t.warning != null && v >= t.warning)
                return 'warning';
            if (t.attention != null && v >= t.attention)
                return 'attention';
        }
        if (rule.direction === 'lower' || rule.direction === 'both') {
            if (t.critical != null && v <= t.critical)
                return 'critical';
            if (t.warning != null && v <= t.warning)
                return 'warning';
            if (t.attention != null && v <= t.attention)
                return 'attention';
        }
        return 'normal';
    }
    buildThresholdBreach(rec, rule, level) {
        if (level === 'normal')
            return null;
        const t = rule.thresholds;
        let limit;
        let direction = 'above';
        if (level === 'critical') {
            limit = t.critical;
            direction = rule.direction === 'lower' ? 'below' : 'above';
        }
        else if (level === 'warning') {
            limit = t.warning;
            direction = rule.direction === 'lower' ? 'below' : 'above';
        }
        else if (level === 'attention') {
            limit = t.attention;
            direction = rule.direction === 'lower' ? 'below' : 'above';
        }
        if (limit == null)
            return null;
        // 若双向，按实际方向
        if (rule.direction === 'both') {
            direction = rec.measuredValue >= limit ? 'above' : 'below';
        }
        return {
            ruleName: rule.description,
            limit,
            direction,
        };
    }
    // ---------- 内部：构建异常队列 ----------
    buildAnomalyQueue(details, duplicateCanonicals, rawToDuplicateCanonical, normMap, ts) {
        const queue = [];
        let seq = 0;
        // 先按 (规范设备编号 + 严重级别) 归集，一个组一条队列记录
        const groups = new Map();
        for (const d of details) {
            if (d.level === 'normal')
                continue; // 正常不入队
            const key = d.equipmentId + '|' + d.level;
            if (!groups.has(key))
                groups.set(key, []);
            groups.get(key).push(d);
        }
        for (const [, groupDetails] of groups) {
            seq++;
            const first = groupDetails[0];
            const rawIds = Array.from(new Set(groupDetails.map(d => d.rawEquipmentId)));
            // ==== 判断是否挂起 ====
            // 策略：只要该组涉及的规范编号在 duplicateCanonicals 中，
            //       或任一原始写法是 ambiguous/unknown → 挂起，等项目经理确认
            let status = 'confirmed_warning';
            let suspensionReason;
            let assignedTo = 'assistant_xiaolin';
            const touchesDuplicate = groupDetails.some(d => rawToDuplicateCanonical.has(d.rawEquipmentId));
            const touchesAmbiguousOrUnknown = groupDetails.some(d => {
                const n = normMap.get(d.rawEquipmentId);
                return n?.status === 'ambiguous' || n?.status === 'unknown';
            });
            if (touchesDuplicate) {
                status = 'pending_confirmation';
                suspensionReason = 'duplicate_equipment';
                assignedTo = 'project_manager';
            }
            else if (touchesAmbiguousOrUnknown) {
                status = 'pending_confirmation';
                suspensionReason = 'ambiguous_equipment';
                assignedTo = 'project_manager';
            }
            // 判断变更导致的挂起（本批次有 judgment_change 且级别上升 → 标记需评审）
            // 这里不在这里判断，judgmentChanges 单独记录
            const initialLog = {
                timestamp: ts,
                from: null,
                to: status,
                operator: 'system',
                comment: suspensionReason
                    ? `自动挂起：${this.describeSuspension(suspensionReason)}`
                    : '系统自动入队',
            };
            queue.push({
                id: `AQ-${ts.slice(0, 10).replace(/-/g, '')}-${String(seq).padStart(3, '0')}`,
                warningDetailId: groupDetails.map(d => d.recordId).join(','),
                equipmentId: first.equipmentId,
                rawEquipmentIds: rawIds,
                level: first.level,
                status,
                suspensionReason,
                assignedTo,
                createdAt: ts,
                updatedAt: ts,
                history: [initialLog],
            });
        }
        return queue;
    }
    // ---------- 内部：构建判断变更列表 ----------
    buildJudgmentChanges(details, inspections, _ts) {
        const changes = [];
        const seen = new Set();
        let jcSeq = 0;
        for (const d of details) {
            const bucketKey = d.equipmentId + '|' + d.itemName;
            if (seen.has(bucketKey))
                continue;
            seen.add(bucketKey);
            // 取该 (设备, 巡检项) 中最新一条作为当前判断
            const bucket = details.filter(x => x.equipmentId === d.equipmentId && x.itemName === d.itemName);
            bucket.sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate));
            const current = bucket[0];
            const previous = this.previousJudgments.get(bucketKey) ?? null;
            const affectedRecordIds = bucket.map(x => x.recordId);
            const relatedInspection = inspections.find(i => i.id === current.recordId);
            // === 判定 changeReason ===
            let reason = 'new_evidence';
            const normStatus = relatedInspection
                ? this.normalizer.normalize(relatedInspection.rawEquipmentId).status
                : null;
            if (!previous) {
                reason = 'new_evidence';
            }
            else if (previous.level !== current.level) {
                // 级别变化 → 判断是阈值变化还是设备编号统一导致的归集变化
                if (normStatus === 'duplicate' || normStatus === 'normalized') {
                    // 本次对该编号做了规范化归集，且级别变化
                    // 若之前级别 normal（因为拆分到不同设备所以没触发阈值），现在非 normal
                    // → 典型的"假稳定结论"被移除
                    if (previous.level === 'normal' && current.level !== 'normal') {
                        reason = 'false_stability_removed';
                    }
                    else {
                        reason = 'equipment_id_unified';
                    }
                }
                else {
                    reason = 'new_evidence';
                }
            }
            else if (normStatus === 'duplicate' || normStatus === 'normalized') {
                reason = 'equipment_id_unified';
            }
            // 只有发生了实际变化（级别变了 / 编号被统一 / 首次）才生成 change
            const changed = !previous ||
                previous.level !== current.level ||
                reason === 'equipment_id_unified' ||
                reason === 'false_stability_removed';
            if (!changed)
                continue;
            jcSeq++;
            const inspectionRemark = relatedInspection?.remark ?? '';
            const remarkForReview = this.buildReviewRemark(reason, previous, current, inspectionRemark);
            changes.push({
                id: `JC-${Date.now()}-${jcSeq}`,
                equipmentId: current.equipmentId,
                itemName: current.itemName,
                previousJudgment: previous
                    ? {
                        level: previous.level,
                        conclusion: this.levelLabel(previous.level),
                        basis: previous.thresholdBreached
                            ? `${previous.thresholdBreached.direction === 'above' ? '超' : '低于'}${previous.thresholdBreached.limit}${previous.unit}`
                            : '无阈值触发',
                    }
                    : null,
                currentJudgment: {
                    level: current.level,
                    conclusion: this.levelLabel(current.level),
                    basis: current.thresholdBreached
                        ? `${current.thresholdBreached.direction === 'above' ? '超' : '低于'}${current.thresholdBreached.limit}${current.unit}`
                        : '无阈值触发',
                },
                changeReason: reason,
                affectedRecordIds,
                remarkForReview,
            });
        }
        return changes;
    }
    // ---------- 内部：统一应用筛选（details / queue / changes 同源过滤） ----------
    applyFullFilter(details, queue, changes, criteria) {
        // 构造一个 detailId → 是否保留 的 Set，供 queue 和 changes 复用
        const keptRecordIds = new Set();
        let outDetails = details;
        // 1. projectId 过滤
        if (criteria.projectId) {
            outDetails = outDetails.filter(d => this.normalizer.isRawBelongsToProject(d.rawEquipmentId, criteria.projectId));
        }
        // 2. 日期过滤
        if (criteria.dateRange) {
            outDetails = outDetails.filter(d => d.inspectionDate >= criteria.dateRange.start &&
                d.inspectionDate <= criteria.dateRange.end);
        }
        // 3. 设备编号过滤
        if (criteria.equipmentIds && criteria.equipmentIds.length > 0) {
            const set = new Set(criteria.equipmentIds);
            outDetails = outDetails.filter(d => set.has(d.equipmentId) || set.has(d.rawEquipmentId));
        }
        // 4. 预警级别过滤
        if (criteria.warningLevels && criteria.warningLevels.length > 0) {
            const set = new Set(criteria.warningLevels);
            outDetails = outDetails.filter(d => set.has(d.level));
        }
        // 5. 挂起项过滤（includeSuspended=false 时，排除涉及 pending_confirmation 队列的 detail）
        //    注意：这里要基于"过滤后 queue"的概念，所以先从原始 queue 中找出挂起的设备，
        //    再把对应 details 去掉
        if (!criteria.includeSuspended) {
            const suspendedEquipmentIds = new Set(queue
                .filter(q => q.status === 'pending_confirmation')
                .map(q => q.equipmentId));
            outDetails = outDetails.filter(d => !suspendedEquipmentIds.has(d.equipmentId));
        }
        for (const d of outDetails)
            keptRecordIds.add(d.recordId);
        // ---- 过滤 queue：只要队列关联的任意一条 detail 被保留，队列就保留 ----
        const outQueue = queue.filter(q => {
            const detailIds = q.warningDetailId.split(',');
            return detailIds.some(id => keptRecordIds.has(id));
        });
        // ---- 过滤 judgmentChanges：只要 affectedRecordIds 中有被保留的，就保留 ----
        const outChanges = changes.filter(c => c.affectedRecordIds.some(id => keptRecordIds.has(id)));
        return { details: outDetails, queue: outQueue, changes: outChanges };
    }
    // ---------- 内部：统计（从筛选后的 details 生成，口径一致） ----------
    computeStatistics(details, queue, criteria) {
        const byLevel = {
            normal: 0, attention: 0, warning: 0, critical: 0,
        };
        const byEquipment = {};
        const equipSet = new Set();
        let gapCount = 0;
        for (const d of details) {
            byLevel[d.level]++;
            equipSet.add(d.equipmentId);
            byEquipment[d.equipmentId] = (byEquipment[d.equipmentId] ?? 0) + 1;
            if (d.evidenceGap.length > 0)
                gapCount++;
        }
        const suspendedQueue = queue.filter(q => q.status === 'pending_confirmation');
        const suspendedCount = criteria.includeSuspended
            ? suspendedQueue.length
            : 0;
        return {
            totalInspections: details.length,
            totalEquipments: equipSet.size,
            byLevel,
            suspendedCount,
            evidenceGapCount: gapCount,
            byEquipment,
        };
    }
    // ---------- 辅助：文本 ----------
    levelLabel(l) {
        return {
            normal: '正常', attention: '注意', warning: '预警', critical: '严重',
        }[l];
    }
    describeEquipmentIssue(s) {
        return {
            duplicate: '该设备编号存在多种写法重复，需项目经理确认归属',
            ambiguous: '该原始写法匹配到多个规范编号，存在歧义',
            unknown: '无法识别该设备编号，系统内无对应规范编号',
        }[s];
    }
    describeSuspension(r) {
        return {
            duplicate_equipment: '同一物理设备对应多种原始写法（设备编号重复），未确认前不得给出假稳定结论',
            ambiguous_equipment: '设备编号存在歧义（一个写法对应多台规范设备）',
            judgment_change_review: '本批次预警判断发生变更，需评审会确认',
        }[r];
    }
    buildReviewRemark(reason, previous, current, inspectionRemark) {
        const parts = [];
        const head = `【评审会备注 · ${current.equipmentId} · ${current.itemName}】`;
        parts.push(head);
        if (reason === 'new_evidence' && !previous) {
            parts.push('首次纳入预警体系。');
        }
        else if (previous && previous.level !== current.level) {
            parts.push(`判断变化：${this.levelLabel(previous.level)} → ${this.levelLabel(current.level)}。`);
        }
        if (reason === 'equipment_id_unified') {
            parts.push(`【设备编号统一】因将不同写法(${current.rawEquipmentId}等)归集到同一规范编号 ${current.equipmentId}，预警数据重新计算。`);
        }
        if (reason === 'false_stability_removed') {
            parts.push(`【移除假稳定】此前因设备编号写法不统一(${current.rawEquipmentId}等)，该设备数据被拆分到多个"虚假设备"导致阈值未触发；统一后数据归集，原本看似"稳定"的判断已不再成立。`);
        }
        if (inspectionRemark) {
            parts.push(`巡检表备注：${inspectionRemark}。`);
        }
        else if (current.level !== 'normal') {
            parts.push('⚠巡检表未补充备注，建议会前补齐。');
        }
        return parts.join(' ');
    }
}
exports.CutterheadWarningEngine = CutterheadWarningEngine;
//# sourceMappingURL=cutterhead-warning-engine.js.map