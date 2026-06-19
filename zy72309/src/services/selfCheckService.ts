import systemStore from '../store/systemStore';
import unifiedDataService from './unifiedDataService';
import dataExportService from './dataExportService';
import { SelfCheckResult } from '../types';

export class SelfCheckService {
  public runAllChecks(): SelfCheckResult[] {
    return [
      this.checkDuplicateImports(),
      this.checkDuplicateStudentAnswers(),
      this.checkRecalculationConsistency(),
      this.checkExportConsistency(),
      this.checkPendingConflicts(),
      this.checkUnifiedDataConsistency()
    ];
  }

  private checkDuplicateImports(): SelfCheckResult {
    const weightBatches = systemStore.getWeightBatches();
    const weights = systemStore.getScoringWeights();

    const criterionBatchMap = new Map<string, Set<string>>();
    weights.forEach(w => {
      if (!criterionBatchMap.has(w.criterionId)) {
        criterionBatchMap.set(w.criterionId, new Set());
      }
      criterionBatchMap.get(w.criterionId)!.add(w.importBatchId);
    });

    const duplicateCriteria: Array<{
      criterionId: string;
      versions: number;
      batches: string[];
    }> = [];

    criterionBatchMap.forEach((batches, criterionId) => {
      if (batches.size > 1) {
        duplicateCriteria.push({
          criterionId,
          versions: batches.size,
          batches: Array.from(batches)
        });
      }
    });

    return {
      checkName: '重复导入检测',
      passed: duplicateCriteria.length === 0,
      message:
        duplicateCriteria.length === 0
          ? '未发现重复导入的评分标准'
          : `发现 ${duplicateCriteria.length} 个评分标准存在多个导入版本`,
      details: {
        totalBatches: weightBatches.length,
        totalWeights: weights.length,
        duplicateCriteria
      },
      timestamp: new Date()
    };
  }

  private checkDuplicateStudentAnswers(): SelfCheckResult {
    const answers = systemStore.getStudentAnswers();
    const studentAnswerMap = new Map<string, typeof answers>();

    answers.forEach(a => {
      if (!studentAnswerMap.has(a.studentId)) {
        studentAnswerMap.set(a.studentId, []);
      }
      studentAnswerMap.get(a.studentId)!.push(a);
    });

    const duplicateStudents: Array<{
      studentId: string;
      studentName: string;
      submissionCount: number;
      submissionIds: string[];
      pendingReview: boolean;
      nextStepContact?: string;
      allVersions?: Array<{
        submissionId: string;
        reviewStatus: string;
        originalAnswers?: Record<string, any>;
        currentAnswers: Record<string, any>;
        isResubmission: boolean;
        nextStepContact?: string;
        correctionReason?: string;
      }>;
    }> = [];

    studentAnswerMap.forEach((studentAnswers, studentId) => {
      if (studentAnswers.length <= 1) return;
      duplicateStudents.push({
        studentId,
        studentName: studentAnswers[0].studentName,
        submissionCount: studentAnswers.length,
        submissionIds: studentAnswers.map(a => a.submissionId),
        pendingReview: studentAnswers.some(a => a.reviewStatus === 'pending_review'),
        nextStepContact: studentAnswers.find(a => a.nextStepContact)?.nextStepContact,
        allVersions: studentAnswers.map(a => ({
          submissionId: a.submissionId,
          reviewStatus: a.reviewStatus,
          originalAnswers: a.originalAnswers,
          currentAnswers: a.answers,
          isResubmission: a.isResubmission,
          nextStepContact: a.nextStepContact,
          correctionReason: a.correctionReason
        }))
      });
    });

    return {
      checkName: '学生重复提交检测',
      passed: duplicateStudents.every(s => !s.pendingReview),
      message:
        duplicateStudents.length === 0
          ? '未发现学生重复提交答案'
          : `发现 ${duplicateStudents.length} 名学生提交了多版答案`,
      details: {
        totalAnswers: answers.length,
        duplicateStudents
      },
      timestamp: new Date()
    };
  }

  private checkRecalculationConsistency(): SelfCheckResult {
    const results = systemStore.getScoringResults();
    const recalculatedResults = results.filter(r => r.isRecalculated);

    const inconsistencies: Array<{
      submissionId: string;
      studentName: string;
      reasons: string[];
    }> = [];

    for (const result of recalculatedResults) {
      const reasons: string[] = [];
      const answer = systemStore.getStudentAnswersBySubmissionId(result.submissionId);
      if (!answer) {
        reasons.push('找不到对应的学生答案记录');
      }
      if (!result.recalculationReason) {
        reasons.push('重算原因未填写');
      }
      if (!result.recalculatedBy) {
        reasons.push('重算操作人未记录');
      }
      if (
        result.originalTotalScore === result.totalScore &&
        result.recalculationReason) {
        reasons.push('重算后分数未变化');
      }
      if (result.changeHistory.length === 0) {
        reasons.push('缺少变更历史记录');
      }

      if (reasons.length > 0) {
        inconsistencies.push({
          submissionId: result.submissionId,
          studentName: result.studentName,
          reasons
        });
      }
    }

    return {
      checkName: '补录重算一致性检测',
      passed: inconsistencies.length === 0,
      message:
        inconsistencies.length === 0
          ? '所有重算记录均完整'
          : `发现 ${inconsistencies.length} 条重算记录存在问题`,
      details: {
        totalResults: results.length,
        recalculatedCount: recalculatedResults.length,
        inconsistencies
      },
      timestamp: new Date()
    };
  }

  private checkExportConsistency(): SelfCheckResult {
    const unifiedList = unifiedDataService.getUnifiedList();
    const inconsistencies: Array<{
      submissionId: string;
      studentName: string;
      differences: string[];
    }> = [];

    for (const rec of unifiedList) {
      const checkResult = dataExportService.verifyDataConsistency(rec.submissionId);
      if (!checkResult.consistent) {
        inconsistencies.push({
          submissionId: rec.submissionId,
          studentName: rec.studentName,
          differences: checkResult.differences
        });
      }
    }

    return {
      checkName: '导出一致性检测',
      passed: inconsistencies.length === 0,
      message:
        inconsistencies.length === 0
          ? '展示/接口/导出三者数据完全一致'
          : `发现 ${inconsistencies.length} 条记录存在数据不一致`,
      details: {
        totalChecked: unifiedList.length,
        inconsistencies,
        checkDimensions: ['展示列表', 'API响应', '导出明细', '详情页']
      },
      timestamp: new Date()
    };
  }

  private checkPendingConflicts(): SelfCheckResult {
    const pendingConflicts = unifiedDataService.getAllPendingConflicts();

    const enriched = pendingConflicts.map(c => ({
      id: c.id,
      type: c.type,
      title: c.title,
      originalStatement: c.originalStatement,
      nextStepContact: c.nextStepContact,
      createdAt: c.createdAt,
      evidenceCount: c.evidence.length
    }));

    return {
      checkName: '待处理冲突检测',
      passed: pendingConflicts.length === 0,
      message:
        pendingConflicts.length === 0
          ? '没有待处理的冲突'
          : `存在 ${pendingConflicts.length} 条待处理冲突，需业务运营跟进`,
      details: {
        pendingCount: pendingConflicts.length,
        conflicts: enriched
      },
      timestamp: new Date()
    };
  }

  private checkUnifiedDataConsistency(): SelfCheckResult {
    const summary = unifiedDataService.getSummary();
    const list = unifiedDataService.getUnifiedList();
    const consistencyIssues = unifiedDataService.verifyAllConsistency();

    const countsSum =
      summary.normal + summary.pendingReview + summary.corrected + summary.recalculated;
    const countsMatch = countsSum === summary.total;

    const auditLogs = systemStore.getAuditLogs();
    const pendingStudents = list.filter(r => r.needsReview);

    return {
      checkName: '统一数据源一致性',
      passed: countsMatch && consistencyIssues.length === 0,
      message:
        countsMatch
          ? consistencyIssues.length === 0
            ? '统一数据源正常'
            : `统计口径匹配但内部字段问题${consistencyIssues.length}项`
          : `各状态汇总数(${countsSum})与总数(${summary.total})不匹配`,
      details: {
        total: summary.total,
        countsSum,
        countsMatch,
        summaryBreakdown: {
          normal: summary.normal,
          pendingReview: summary.pendingReview,
          corrected: summary.corrected,
          recalculated: summary.recalculated
        },
        auditLogsCount: auditLogs.length,
        pendingStudentsCount: pendingStudents.length,
        internalConsistencyIssues: consistencyIssues.length
      },
      timestamp: new Date()
    };
  }

  public getCheckSummary(): {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    overallPassed: boolean;
  } {
    const results = this.runAllChecks();
    const passedChecks = results.filter(r => r.passed).length;

    return {
      totalChecks: results.length,
      passedChecks,
      failedChecks: results.length - passedChecks,
      overallPassed: passedChecks === results.length
    };
  }

  public getDetailedReport(operator: string): string {
    const checks = this.runAllChecks();
    const summary = this.getCheckSummary();
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════');
    lines.push('     网络流容量分配 - 系统自检报告');
    lines.push('═══════════════════════════════════════');
    lines.push(`生成时间: ${new Date().toLocaleString()}`);
    lines.push(`操作人: ${operator}`);
    lines.push('');
    lines.push('【总览】');
    lines.push(
      `  通过: ${summary.passedChecks}/${summary.totalChecks}  ${
        summary.overallPassed ? '✓ 全部通过' : '✗ 存在问题'
      }`
    );
    lines.push('');
    lines.push('【分项结果】');

    checks.forEach((c, i) => {
      const icon = c.passed ? '✓' : '✗';
      lines.push(`  ${i + 1}. ${icon} ${c.checkName}`);
      lines.push(`     ${c.message}`);
      if (!c.passed && c.details) {
        const str = JSON.stringify(c.details, null, 2);
        str.split('\n').slice(0, 12).forEach(line => {
          lines.push('     ' + line);
        });
      }
    });

    lines.push('');
    lines.push('═══════════════════════════════════════');

    return lines.join('\n');
  }
}

export default new SelfCheckService();
