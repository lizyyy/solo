"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeSubmission = analyzeSubmission;
exports.batchAudit = batchAudit;
const INTERCEPTION_RULES = [
    {
        code: 'ET-001',
        category: '提前终止',
        description: '课程完成率不足70%即申请提前结束',
        severity: 'high',
        check: (s) => s.earlyTermination && s.completionRate < 70,
        suggestion: '需补充未完成部分的学习计划或证明材料，说明提前结束的合理性'
    },
    {
        code: 'ET-002',
        category: '提前终止',
        description: '理论测验成绩低于及格线（60分）',
        severity: 'high',
        check: (s) => s.earlyTermination && s.quizScore !== null && s.quizScore < 60,
        suggestion: '建议重新参加理论测验，或提供补考通过的证明'
    },
    {
        code: 'ET-003',
        category: '提前终止',
        description: '实践操作成绩缺失，未完成全部考核环节',
        severity: 'medium',
        check: (s) => s.earlyTermination && s.practicalScore === null,
        suggestion: '需补提交实践操作成绩或相关证明，否则无法计入有效培训学时'
    },
    {
        code: 'ET-004',
        category: '提前终止',
        description: '提前结束申请缺少审批签字附件',
        severity: 'medium',
        check: (s) => {
            const hasApproval = s.attachments.some(a => a.name.includes('审批') || a.name.includes('批准') || a.name.includes('签字'));
            return s.earlyTermination && !hasApproval;
        },
        suggestion: '请上传部门主管签字的提前结束审批表'
    },
    {
        code: 'ET-005',
        category: '提前终止',
        description: '总成绩未计算，无法确认培训效果',
        severity: 'high',
        check: (s) => s.earlyTermination && s.totalScore === null,
        suggestion: '需完成成绩核算，或提交特殊情况说明由培训委员会审批'
    }
];
function analyzeSubmission(submission) {
    const startTime = Date.now();
    const beforeStatus = submission.status;
    const interceptionReasons = [];
    for (const rule of INTERCEPTION_RULES) {
        if (rule.check(submission)) {
            interceptionReasons.push({
                code: rule.code,
                category: rule.category,
                description: rule.description,
                severity: rule.severity,
                suggestion: rule.suggestion
            });
        }
    }
    const isIntercepted = interceptionReasons.length > 0;
    const afterStatus = isIntercepted ? 'intercepted' : 'approved';
    const nextSteps = [];
    if (isIntercepted) {
        nextSteps.push('系统已拦截该提前结束申请，请查看详细拦截原因');
        nextSteps.push('通知学员补充缺失的证明材料');
        nextSteps.push('安排培训专员进行人工复核');
        interceptionReasons.forEach(r => {
            nextSteps.push(`[${r.code}] ${r.suggestion}`);
        });
    }
    else {
        nextSteps.push('审核通过，提前结束申请已批准');
        nextSteps.push('将结果同步至培训管理系统');
        nextSteps.push('通知学员审核结果');
    }
    const candidateCleanupList = generateCleanupCandidates(submission, isIntercepted);
    const processingTime = Date.now() - startTime;
    return {
        submissionId: submission.id,
        submission,
        isIntercepted,
        interceptionReasons,
        beforeStatus,
        afterStatus,
        processingTime,
        nextSteps,
        reviewOpinions: [],
        candidateCleanupList
    };
}
function generateCleanupCandidates(submission, isIntercepted) {
    const candidates = [];
    if (isIntercepted) {
        candidates.push({
            id: `CLEAN-${submission.id}-001`,
            type: 'submission',
            description: `提交记录 ${submission.id} - ${submission.traineeName} 的提前结束申请`,
            reason: '拦截状态的提交记录，待补充材料后可恢复，或30天后自动清理',
            riskLevel: 'caution'
        });
    }
    submission.attachments.forEach((att, idx) => {
        const isTemporary = att.name.includes('临时') || att.name.includes('草稿');
        if (isTemporary) {
            candidates.push({
                id: `CLEAN-${submission.id}-${String(idx + 1).padStart(3, '0')}`,
                type: 'attachment',
                description: `附件 ${att.name}`,
                reason: '标记为临时文件，审核完成后可安全删除',
                riskLevel: 'safe'
            });
        }
    });
    const duplicateRecords = findDuplicateAuditRecords(submission);
    duplicateRecords.forEach((record, idx) => {
        candidates.push({
            id: `CLEAN-${submission.id}-${String(100 + idx + 1).padStart(3, '0')}`,
            type: 'audit_record',
            description: `重复审核记录 ${record.id} - ${record.action}`,
            reason: '检测到重复操作记录，建议保留最新一条，清理其余',
            riskLevel: 'safe'
        });
    });
    return candidates;
}
function findDuplicateAuditRecords(submission) {
    const seen = new Map();
    const duplicates = [];
    for (const record of submission.auditTrail) {
        const key = `${record.action}-${record.operatorId}-${record.fromStatus}-${record.toStatus}`;
        if (seen.has(key)) {
            const existingTime = new Date(seen.get(key).timestamp).getTime();
            const currentTime = new Date(record.timestamp).getTime();
            if (existingTime < currentTime) {
                duplicates.push(seen.get(key));
                seen.set(key, record);
            }
            else {
                duplicates.push(record);
            }
        }
        else {
            seen.set(key, record);
        }
    }
    return duplicates;
}
function batchAudit(submissions) {
    const results = [];
    let totalTime = 0;
    for (const submission of submissions) {
        const result = analyzeSubmission(submission);
        results.push(result);
        totalTime += result.processingTime;
    }
    const reasonCounts = new Map();
    for (const result of results) {
        for (const reason of result.interceptionReasons) {
            const key = `${reason.code}: ${reason.description}`;
            reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1);
        }
    }
    const topReasons = Array.from(reasonCounts.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    return {
        results,
        summary: {
            totalProcessingTime: totalTime,
            averageProcessingTime: totalTime / results.length,
            topInterceptionReasons: topReasons
        }
    };
}
