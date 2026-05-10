"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessRuleValidator = exports.ALLOWED_STATUS_TRANSITIONS = exports.MAX_DELAY_DAYS = exports.MIN_REASON_LENGTH = exports.MAX_DELAY_COUNT = void 0;
const types_1 = require("../types");
exports.MAX_DELAY_COUNT = 3;
exports.MIN_REASON_LENGTH = 20;
exports.MAX_DELAY_DAYS = {
    [types_1.Severity.CRITICAL]: 7,
    [types_1.Severity.HIGH]: 14,
    [types_1.Severity.MEDIUM]: 30,
    [types_1.Severity.LOW]: 90
};
exports.ALLOWED_STATUS_TRANSITIONS = {
    [types_1.VulnerabilityStatus.NEW]: [types_1.VulnerabilityStatus.ASSIGNED],
    [types_1.VulnerabilityStatus.ASSIGNED]: [types_1.VulnerabilityStatus.IN_PROGRESS, types_1.VulnerabilityStatus.DELAYED],
    [types_1.VulnerabilityStatus.IN_PROGRESS]: [types_1.VulnerabilityStatus.FIXED, types_1.VulnerabilityStatus.DELAYED],
    [types_1.VulnerabilityStatus.DELAYED]: [types_1.VulnerabilityStatus.IN_PROGRESS],
    [types_1.VulnerabilityStatus.FIXED]: [types_1.VulnerabilityStatus.DEPLOYED],
    [types_1.VulnerabilityStatus.DEPLOYED]: [types_1.VulnerabilityStatus.CLOSED],
    [types_1.VulnerabilityStatus.CLOSED]: []
};
class BusinessRuleValidator {
    static validateAssignment(vulnerabilityStatus, currentAssigneeId, assigneeId, isManualOverride = false) {
        const errors = [];
        const warnings = [];
        if (!assigneeId || assigneeId.trim() === '') {
            errors.push('负责人ID不能为空');
        }
        if (vulnerabilityStatus === types_1.VulnerabilityStatus.CLOSED) {
            errors.push('已关闭的漏洞不能分配负责人');
        }
        if (vulnerabilityStatus === types_1.VulnerabilityStatus.DEPLOYED) {
            errors.push('已上线的漏洞不能重新分配负责人');
        }
        if (currentAssigneeId === assigneeId && !isManualOverride) {
            errors.push('漏洞已经分配给该负责人，重复操作无意义');
        }
        if (currentAssigneeId && currentAssigneeId !== assigneeId && !isManualOverride) {
            warnings.push('该漏洞已有其他负责人，重新分配需要确认');
        }
        const validStatuses = [
            types_1.VulnerabilityStatus.NEW,
            types_1.VulnerabilityStatus.ASSIGNED,
            types_1.VulnerabilityStatus.IN_PROGRESS,
            types_1.VulnerabilityStatus.DELAYED,
            types_1.VulnerabilityStatus.FIXED
        ];
        if (!validStatuses.includes(vulnerabilityStatus) && !isManualOverride) {
            errors.push(`漏洞当前状态 ${vulnerabilityStatus} 不允许分配负责人`);
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    static validateStatusTransition(fromStatus, toStatus, assigneeId, manuallyCorrected, isManualOverride = false) {
        const errors = [];
        const warnings = [];
        let requiresManualOverride = false;
        if (fromStatus === toStatus) {
            return {
                valid: true,
                errors: [],
                warnings: ['状态未发生变化'],
                requiresManualOverride: false
            };
        }
        if (fromStatus === types_1.VulnerabilityStatus.CLOSED) {
            errors.push('已关闭的漏洞状态不能修改');
        }
        if (!assigneeId && toStatus !== types_1.VulnerabilityStatus.ASSIGNED && toStatus !== types_1.VulnerabilityStatus.NEW) {
            errors.push('漏洞尚未分配负责人，不能进入非待分配状态');
        }
        if (manuallyCorrected && !isManualOverride) {
            warnings.push('该漏洞状态曾被人工修正，此次修改建议添加备注说明');
        }
        const allowedTransitions = exports.ALLOWED_STATUS_TRANSITIONS[fromStatus] || [];
        const isAllowedTransition = allowedTransitions.includes(toStatus);
        if (!isAllowedTransition && !isManualOverride) {
            errors.push(`状态转换不允许：${fromStatus} -> ${toStatus}。允许的转换：${allowedTransitions.join(', ') || '无'}`);
            requiresManualOverride = true;
        }
        if (toStatus === types_1.VulnerabilityStatus.CLOSED && fromStatus !== types_1.VulnerabilityStatus.DEPLOYED) {
            errors.push('只有已上线的漏洞才能关闭');
            requiresManualOverride = true;
        }
        return {
            valid: errors.length === 0 || isManualOverride,
            errors,
            warnings,
            requiresManualOverride
        };
    }
    static validateDelayRequest(vulnerabilityStatus, currentDelayCount, severity, originalDueDate, newDueDate, reason, riskMitigation, isManualOverride = false) {
        const errors = [];
        const warnings = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (!reason || reason.trim().length < exports.MIN_REASON_LENGTH) {
            errors.push(`延期理由至少需要 ${exports.MIN_REASON_LENGTH} 个字符`);
        }
        if (!riskMitigation || riskMitigation.trim().length < exports.MIN_REASON_LENGTH) {
            errors.push(`风险缓解措施至少需要 ${exports.MIN_REASON_LENGTH} 个字符`);
        }
        if (newDueDate <= originalDueDate) {
            errors.push('新的截止日期必须晚于原截止日期');
        }
        if (newDueDate < today) {
            errors.push('新的截止日期不能早于今天');
        }
        const allowedStatuses = [
            types_1.VulnerabilityStatus.ASSIGNED,
            types_1.VulnerabilityStatus.IN_PROGRESS
        ];
        if (!allowedStatuses.includes(vulnerabilityStatus) && !isManualOverride) {
            errors.push('只有已分配或进行中的漏洞才能申请延期');
        }
        if (currentDelayCount >= exports.MAX_DELAY_COUNT && !isManualOverride) {
            errors.push(`该漏洞已延期 ${currentDelayCount} 次，达到最大延期次数限制（${exports.MAX_DELAY_COUNT}次）`);
        }
        const maxDelayDays = exports.MAX_DELAY_DAYS[severity] || 30;
        const delayDays = Math.ceil((newDueDate.getTime() - originalDueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (delayDays > maxDelayDays && !isManualOverride) {
            errors.push(`${severity} 级别漏洞最多允许延期 ${maxDelayDays} 天，申请延期 ${delayDays} 天超出限制`);
        }
        let additionalRisk;
        if (severity === types_1.Severity.CRITICAL && delayDays > 3) {
            additionalRisk = types_1.RiskLevel.HIGH;
            warnings.push('高危漏洞延期超过3天，风险级别将提升');
        }
        else if (severity === types_1.Severity.HIGH && delayDays > 7) {
            additionalRisk = types_1.RiskLevel.MEDIUM;
            warnings.push('中高危漏洞延期超过7天，需重点关注');
        }
        return {
            valid: errors.length === 0 || isManualOverride,
            errors,
            warnings,
            additionalRisk
        };
    }
    static calculateRepairWindow(severity, discoveredDate = new Date()) {
        const repairWindows = {
            [types_1.Severity.CRITICAL]: { days: 7, description: '高危漏洞：7天内必须修复' },
            [types_1.Severity.HIGH]: { days: 14, description: '中高危漏洞：14天内必须修复' },
            [types_1.Severity.MEDIUM]: { days: 30, description: '中危漏洞：30天内必须修复' },
            [types_1.Severity.LOW]: { days: 90, description: '低危漏洞：90天内修复' }
        };
        const window = repairWindows[severity];
        const dueDate = new Date(discoveredDate);
        dueDate.setDate(dueDate.getDate() + window.days);
        return {
            dueDate,
            recommendedDays: window.days,
            description: window.description
        };
    }
    static checkBatchConsistency(batchStatus, vulnerabilities) {
        const issues = [];
        if (batchStatus === 'DEPLOYED') {
            const uncompletedVulns = vulnerabilities.filter(v => ![types_1.VulnerabilityStatus.DEPLOYED, types_1.VulnerabilityStatus.CLOSED].includes(v.status));
            if (uncompletedVulns.length > 0) {
                issues.push(`批次已标记为上线，但仍有 ${uncompletedVulns.length} 个漏洞未上线`);
            }
        }
        if (batchStatus === 'PLANNED') {
            const inProgressVulns = vulnerabilities.filter(v => v.status !== types_1.VulnerabilityStatus.NEW && v.status !== types_1.VulnerabilityStatus.ASSIGNED);
            if (inProgressVulns.length > 0) {
                issues.push(`批次仍在计划中，但已有 ${inProgressVulns.length} 个漏洞开始处理`);
            }
        }
        return {
            consistent: issues.length === 0,
            issues
        };
    }
    static validateRepeatAssignment(vulnerabilityId, assigneeId, existingAssignments) {
        const matchingAssignments = existingAssignments.filter(a => a.vulnerabilityId === vulnerabilityId && a.assigneeId === assigneeId);
        if (matchingAssignments.length === 0) {
            return { isRepeat: false };
        }
        const activeAssignment = matchingAssignments.find(a => a.isActive);
        const lastAssignment = matchingAssignments.sort((a, b) => {
            return b.createdAt?.getTime() - a.createdAt?.getTime();
        })[0];
        return {
            isRepeat: true,
            lastAssignment: activeAssignment || lastAssignment
        };
    }
}
exports.BusinessRuleValidator = BusinessRuleValidator;
//# sourceMappingURL=BusinessRuleValidator.js.map