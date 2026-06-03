import systemStore from '../store/systemStore';
import { SelfCheckResult, ScoringResult, StudentAnswer } from '../types';
import scoringEngine from './scoringEngine';
import dataExportService from './dataExportService';

export class SelfCheckService {
  public runAllChecks(): SelfCheckResult[] {
    return [
      this.checkDuplicateImports(),
      this.checkDuplicateStudentAnswers(),
      this.checkRecalculationConsistency(),
      this.checkExportConsistency(),
      this.checkPendingConflicts()
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

    const duplicateCriteria: string[] = [];
    criterionBatchMap.forEach((batches, criterionId) => {
      if (batches.size > 1) {
        duplicateCriteria.push(criterionId);
      }
    });

    return {
      checkName: '重复导入检测',
      passed: duplicateCriteria.length === 0,
      message: duplicateCriteria.length === 0
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
    const studentAnswerMap = new Map<string, StudentAnswer[]>();

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
      pendingReview: boolean;
    }> = [];

    studentAnswerMap.forEach((studentAnswers, studentId) => {
      if (studentAnswers.length > 1) {
        duplicateStudents.push({
          studentId,
          studentName: studentAnswers[0].studentName,
          submissionCount: studentAnswers.length,
          pendingReview: studentAnswers.some(a => a.reviewStatus === 'pending_review')
        });
      }
    });

    return {
      checkName: '学生重复提交检测',
      passed: duplicateStudents.every(s => !s.pendingReview),
      message: duplicateStudents.length === 0
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
      reason: string;
    }> = [];

    for (const result of recalculatedResults) {
      const answer = systemStore.getStudentAnswersBySubmissionId(result.submissionId);
      if (!answer) {
        inconsistencies.push({
          submissionId: result.submissionId,
          studentName: result.studentName,
          reason: '找不到对应的学生答案记录'
        });
        continue;
      }

      if (!result.recalculationReason) {
        inconsistencies.push({
          submissionId: result.submissionId,
          studentName: result.studentName,
          reason: '重算原因未填写'
        });
      }

      if (!result.recalculatedBy) {
        inconsistencies.push({
          submissionId: result.submissionId,
          studentName: result.studentName,
          reason: '重算操作人未记录'
        });
      }
    }

    return {
      checkName: '补录重算一致性检测',
      passed: inconsistencies.length === 0,
      message: inconsistencies.length === 0
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
    const results = systemStore.getScoringResults();
    const inconsistencies: Array<{
      submissionId: string;
      studentName: string;
      differences: string[];
    }> = [];

    for (const result of results) {
      const checkResult = dataExportService.verifyDataConsistency(result.submissionId);
      if (!checkResult.consistent) {
        inconsistencies.push({
          submissionId: result.submissionId,
          studentName: result.studentName,
          differences: checkResult.differences
        });
      }
    }

    return {
      checkName: '导出一致性检测',
      passed: inconsistencies.length === 0,
      message: inconsistencies.length === 0
        ? '所有数据导出均一致'
        : `发现 ${inconsistencies.length} 条记录存在数据不一致`,
      details: {
        totalChecked: results.length,
        inconsistencies
      },
      timestamp: new Date()
    };
  }

  private checkPendingConflicts(): SelfCheckResult {
    const pendingConflicts = systemStore.getPendingConflicts();

    return {
      checkName: '待处理冲突检测',
      passed: pendingConflicts.length === 0,
      message: pendingConflicts.length === 0
        ? '没有待处理的冲突'
        : `存在 ${pendingConflicts.length} 条待处理冲突`,
      details: {
        pendingCount: pendingConflicts.length,
        conflicts: pendingConflicts.map(c => ({
          id: c.id,
          type: c.type,
          title: c.title,
          createdAt: c.createdAt
        }))
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
}

export default new SelfCheckService();
