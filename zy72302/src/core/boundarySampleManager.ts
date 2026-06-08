import {
  BoundarySample,
  NegativeSample,
  ManualCounterExample,
  QuestionnaireRow,
  ReviewStatus,
  NextAction,
  BoundaryReport,
  ReviewResult,
  ReviewLogEntry,
} from '../types';
import { generateBoundarySampleId, generateReportId } from '../utils/idGenerator';

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending_ta: '待学生助教复核',
  ta_verified: '学生助教已确认',
  pending_coach: '待竞赛教练唐老师复核',
  coach_verified: '唐老师已确认',
  resolved: '已解决',
  dismissed: '已驳回',
};

const NEXT_ACTION_TEXT: Record<NextAction, string> = {
  find_ta: '请联系学生助教补充材料或复核',
  find_coach: '请联系竞赛教练唐老师进行最终确认',
  collect_more_data: '需要收集更多现场数据补充完整',
  resolve: '可以标记为已解决',
  dismiss: '可以驳回该样本',
};

const ALLOWED_TA_FROM: ReviewStatus[] = ['pending_ta', 'dismissed'];
const ALLOWED_COACH_FROM: ReviewStatus[] = ['pending_coach'];

function logId() {
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export class BoundarySampleManager {
  private boundarySamples: Map<string, BoundarySample> = new Map();

  // ============== 检测与创建 ==============
  detectNegativeSamples(
    manualCounterExamples: ManualCounterExample[],
    questionnaireRows: QuestionnaireRow[]
  ): NegativeSample[] {
    const negativeSamples: NegativeSample[] = [];

    for (const manual of manualCounterExamples) {
      const hasNegative =
        manual.waitTime < 0 || manual.arrivalCount < 0 || manual.isNegative;
      if (hasNegative) {
        const questionnaire = questionnaireRows.find(
          (q) => q.sampleId === manual.sampleId
        );
        negativeSamples.push({
          sampleId: manual.sampleId,
          detectedAt: new Date(),
          detectedBy: manual.source === 'old_table' ? 'old_table' : 'system',
          reason: this.getNegativeReason(manual, questionnaire),
          value: Math.min(
            manual.waitTime,
            manual.arrivalCount,
            manual.waitTime < 0 || manual.arrivalCount < 0 ? 0 : Infinity
          ),
          isMarkedAsMissing: manual.source === 'old_table',
          sourceLink: {
            manualCounterExampleId: manual.id,
            questionnaireRowId: questionnaire?.id,
          },
        });
      }
    }

    for (const questionnaire of questionnaireRows) {
      const hasManual = manualCounterExamples.some(
        (m) => m.sampleId === questionnaire.sampleId
      );
      const hasNegative =
        questionnaire.actualWaitTime < 0 || questionnaire.actualArrivalCount < 0;
      if (!hasManual && hasNegative) {
        negativeSamples.push({
          sampleId: questionnaire.sampleId,
          detectedAt: new Date(),
          detectedBy: 'system',
          reason: '问卷原始行中存在负数数据，但无对应手算反例记录',
          value: Math.min(questionnaire.actualWaitTime, questionnaire.actualArrivalCount),
          isMarkedAsMissing: true,
          sourceLink: {
            questionnaireRowId: questionnaire.id,
          },
        });
      }
    }

    return negativeSamples;
  }

  private getNegativeReason(
    manual: ManualCounterExample,
    questionnaire?: QuestionnaireRow
  ): string {
    const reasons: string[] = [];
    if (manual.waitTime < 0) reasons.push(`等待时间为负数(${manual.waitTime}分钟)`);
    if (manual.arrivalCount < 0) reasons.push(`到达人数为负数(${manual.arrivalCount}人)`);
    if (manual.source === 'old_table') reasons.push('旧系统标记为缺失');
    if (questionnaire) {
      if (questionnaire.isTemporaryClosed) reasons.push('窗口临时关闭');
      if (questionnaire.queueOverflow) reasons.push('排队溢出');
    }
    if (manual.mainProcessEvidence) reasons.push(`主流程证据: ${manual.mainProcessEvidence}`);
    return reasons.join('；') || '检测到负数异常';
  }

  createBoundarySample(
    negativeSample: NegativeSample,
    manualCounterExample?: ManualCounterExample,
    questionnaireRow?: QuestionnaireRow
  ): BoundarySample {
    const existing = this.findBySampleId(negativeSample.sampleId);
    if (existing) {
      return existing;
    }

    const missingMaterials = this.analyzeMissingMaterials(
      negativeSample,
      manualCounterExample,
      questionnaireRow
    );

    const originalNegativeValues: BoundarySample['originalNegativeValues'] = {};
    if (manualCounterExample) {
      if (manualCounterExample.waitTime < 0)
        originalNegativeValues.waitTime = manualCounterExample.waitTime;
      if (manualCounterExample.arrivalCount < 0)
        originalNegativeValues.arrivalCount = manualCounterExample.arrivalCount;
    }

    const initialLog: ReviewLogEntry = {
      id: logId(),
      timestamp: new Date(),
      action: 'created',
      operator: negativeSample.detectedBy === 'old_table' ? '旧表系统' : '系统',
      statusBefore: undefined,
      statusAfter: 'pending_ta',
      originalWaitTime: originalNegativeValues.waitTime,
      originalArrivalCount: originalNegativeValues.arrivalCount,
      reason: negativeSample.reason,
    };

    const boundarySample: BoundarySample = {
      sampleId: negativeSample.sampleId,
      status: 'pending_ta',
      createdAt: new Date(),
      updatedAt: new Date(),
      negativeSample,
      manualCounterExample,
      questionnaireRow,
      whyKept: this.explainWhyKept(negativeSample, manualCounterExample, questionnaireRow),
      missingMaterials,
      nextAction: this.determineNextAction(missingMaterials, questionnaireRow),
      assignee: missingMaterials.length > 0 ? '学生助教' : undefined,
      originalNegativeValues,
      reviewLog: [initialLog],
      rawOriginalStatement: questionnaireRow?.onSiteStatement,
    };

    this.boundarySamples.set(generateBoundarySampleId(), boundarySample);
    return boundarySample;
  }

  // ============== 学生助教复核 ==============
  taReview(
    sampleId: string,
    verified: boolean,
    notes: string,
    supplementaryQuestionnaire?: QuestionnaireRow
  ): BoundarySample | undefined {
    return this.taReviewV2(sampleId, verified, notes, supplementaryQuestionnaire).sample;
  }

  taReviewV2(
    sampleId: string,
    verified: boolean,
    notes: string,
    supplementaryQuestionnaire?: QuestionnaireRow
  ): ReviewResult {
    const sample = this.findBySampleId(sampleId);

    // 1. 样本不存在
    if (!sample) {
      return {
        success: false,
        errorKind: 'sample_not_found',
        errorMessage: `样本「${sampleId}」不存在。请先运行 import 导入数据并创建边界样本。当前总样本数：${this.getAllBoundarySamples().length}`,
        hints: [
          '运行 queue-config import 导入手算反例数据',
          '运行 queue-config list 查看已创建的边界样本列表',
          '确认样本ID拼写正确（区分大小写）',
        ],
      };
    }

    // 2. 状态不允许
    if (!ALLOWED_TA_FROM.includes(sample.status)) {
      const currentLabel = STATUS_LABEL[sample.status] || sample.status;
      const allowedLabels = ALLOWED_TA_FROM.map((s) => STATUS_LABEL[s]).join('、');
      const suggestions: string[] = [];
      if (sample.status === 'coach_verified' || sample.status === 'resolved') {
        suggestions.push('该样本已完成复核流程，如需修改请先重新打开');
      }
      if (sample.status === 'pending_coach') {
        suggestions.push('该样本已移交唐老师，如需学生助教再次处理，请由唐老师退回');
      }
      return {
        success: false,
        errorKind: 'invalid_status_transition',
        errorMessage: `样本「${sampleId}」当前状态为「${currentLabel}」，不允许学生助教复核。仅允许在「${allowedLabels}」状态下操作。`,
        allowedActions: ALLOWED_TA_FROM,
        hints: suggestions.length > 0 ? suggestions : undefined,
      };
    }

    const statusBefore = sample.status;
    sample.updatedAt = new Date();
    sample.taReviewNotes = notes;

    let rawStatementAdded = false;
    let correctedWaitTime: number | undefined;
    let correctedArrivalCount: number | undefined;

    if (supplementaryQuestionnaire) {
      sample.questionnaireRow = supplementaryQuestionnaire;
      rawStatementAdded = true;
      sample.rawOriginalStatement = supplementaryQuestionnaire.onSiteStatement;
      correctedWaitTime = supplementaryQuestionnaire.actualWaitTime;
      correctedArrivalCount = supplementaryQuestionnaire.actualArrivalCount;

      // 把补充后的值写回，覆盖负数，但保留 originalNegativeValues 供展示
      if (sample.manualCounterExample) {
        if (
          sample.manualCounterExample.waitTime < 0 &&
          supplementaryQuestionnaire.actualWaitTime >= 0
        ) {
          sample.manualCounterExample.waitTime = supplementaryQuestionnaire.actualWaitTime;
        }
        if (
          sample.manualCounterExample.arrivalCount < 0 &&
          supplementaryQuestionnaire.actualArrivalCount >= 0
        ) {
          sample.manualCounterExample.arrivalCount =
            supplementaryQuestionnaire.actualArrivalCount;
        }
      }
    }

    // 学生助教确认后，旧表标记缺失的标记可以解除
    if (verified) {
      sample.negativeSample.isMarkedAsMissing = false;
    }

    sample.missingMaterials = this.analyzeMissingMaterials(
      sample.negativeSample,
      sample.manualCounterExample,
      sample.questionnaireRow
    );
    sample.whyKept = this.explainWhyKept(
      sample.negativeSample,
      sample.manualCounterExample,
      sample.questionnaireRow
    );
    sample.nextAction = this.determineNextAction(
      sample.missingMaterials,
      sample.questionnaireRow
    );

    if (verified) {
      if (sample.missingMaterials.length === 0) {
        sample.status = 'pending_coach';
        sample.assignee = '竞赛教练唐老师';
      } else {
        sample.status = 'pending_ta';
        sample.assignee = '学生助教';
      }
    } else {
      sample.status = 'dismissed';
      sample.assignee = undefined;
    }

    sample.reviewLog.push({
      id: logId(),
      timestamp: new Date(),
      action: 'ta_review',
      operator: '学生助教',
      statusBefore,
      statusAfter: sample.status,
      originalWaitTime: sample.originalNegativeValues.waitTime,
      correctedWaitTime,
      originalArrivalCount: sample.originalNegativeValues.arrivalCount,
      correctedArrivalCount,
      reason: verified ? '学生助教确认通过' : '学生助教驳回',
      notes,
      rawStatementAdded,
    });

    this.upsertIntoMap(sample);

    return { success: true, sample };
  }

  // ============== 唐老师复核 ==============
  coachReview(
    sampleId: string,
    verified: boolean,
    notes: string
  ): BoundarySample | undefined {
    return this.coachReviewV2(sampleId, verified, notes).sample;
  }

  coachReviewV2(sampleId: string, verified: boolean, notes: string): ReviewResult {
    const sample = this.findBySampleId(sampleId);

    if (!sample) {
      return {
        success: false,
        errorKind: 'sample_not_found',
        errorMessage: `样本「${sampleId}」不存在。请先完成 import 与学生助教复核。当前总样本数：${this.getAllBoundarySamples().length}`,
        hints: [
          '运行 queue-config list 查看样本列表和状态',
          '只有状态为「待唐老师复核」的样本可进行此操作',
          '学生助教补录问卷并确认通过后，样本会流转到唐老师',
        ],
      };
    }

    if (!ALLOWED_COACH_FROM.includes(sample.status)) {
      const currentLabel = STATUS_LABEL[sample.status] || sample.status;
      const allowedLabels = ALLOWED_COACH_FROM.map((s) => STATUS_LABEL[s]).join('、');
      const suggestions: string[] = [];
      if (sample.status === 'pending_ta') {
        suggestions.push('请先由学生助教补录并确认通过，再进行唐老师复核');
      }
      if (sample.status === 'coach_verified' || sample.status === 'resolved') {
        suggestions.push('该样本已由唐老师确认过');
      }
      return {
        success: false,
        errorKind: 'invalid_status_transition',
        errorMessage: `样本「${sampleId}」当前状态为「${currentLabel}」，不允许唐老师复核。仅允许在「${allowedLabels}」状态下操作。`,
        allowedActions: ALLOWED_COACH_FROM,
        hints: suggestions.length > 0 ? suggestions : undefined,
      };
    }

    const statusBefore = sample.status;
    sample.updatedAt = new Date();
    sample.coachReviewNotes = notes;

    if (verified) {
      sample.status = 'coach_verified';
      sample.nextAction = 'resolve';
      sample.assignee = undefined;
      sample.dataResolution = {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: '竞赛教练唐老师',
        finalWaitTime:
          sample.questionnaireRow?.actualWaitTime ??
          sample.manualCounterExample?.waitTime,
        finalArrivalCount:
          sample.questionnaireRow?.actualArrivalCount ??
          sample.manualCounterExample?.arrivalCount,
        resolutionReason: notes,
        nextContactPerson: this.determineNextContact(sample),
      };
    } else {
      sample.status = 'pending_ta';
      sample.nextAction = 'collect_more_data';
      sample.assignee = '学生助教';
    }

    sample.reviewLog.push({
      id: logId(),
      timestamp: new Date(),
      action: 'coach_review',
      operator: '竞赛教练唐老师',
      statusBefore,
      statusAfter: sample.status,
      reason: verified ? '唐老师确认通过' : '唐老师退回，需补充数据',
      notes,
    });

    this.upsertIntoMap(sample);
    return { success: true, sample };
  }

  // ============== 工具 & 查询 ==============
  findBySampleId(sampleId: string): BoundarySample | undefined {
    for (const s of this.boundarySamples.values()) {
      if (s.sampleId === sampleId) return s;
    }
    return undefined;
  }

  getAllBoundarySamples(): BoundarySample[] {
    return Array.from(this.boundarySamples.values());
  }

  getBoundarySamplesByStatus(status: ReviewStatus): BoundarySample[] {
    return this.getAllBoundarySamples().filter((s) => s.status === status);
  }

  getReviewLog(sampleId?: string): ReviewLogEntry[] {
    if (!sampleId) {
      return this.getAllBoundarySamples().flatMap((s) => s.reviewLog);
    }
    return this.findBySampleId(sampleId)?.reviewLog ?? [];
  }

  generateReport(): BoundaryReport {
    const samples = this.getAllBoundarySamples();
    const report: BoundaryReport = {
      reportId: generateReportId(),
      generatedAt: new Date(),
      boundarySamples: samples,
      statistics: {
        total: samples.length,
        pendingTa: samples.filter((s) => s.status === 'pending_ta').length,
        pendingCoach: samples.filter((s) => s.status === 'pending_coach').length,
        verified: samples.filter((s) => s.status === 'coach_verified').length,
        resolved: samples.filter((s) => s.status === 'resolved').length,
      },
    };
    return report;
  }

  clear(): void {
    this.boundarySamples.clear();
  }

  // ============== 内部辅助 ==============
  private upsertIntoMap(sample: BoundarySample): void {
    for (const [key, existing] of this.boundarySamples.entries()) {
      if (existing.sampleId === sample.sampleId) {
        this.boundarySamples.set(key, sample);
        return;
      }
    }
    this.boundarySamples.set(generateBoundarySampleId(), sample);
  }

  private analyzeMissingMaterials(
    negativeSample: NegativeSample,
    manualCounterExample?: ManualCounterExample,
    questionnaireRow?: QuestionnaireRow
  ): string[] {
    const missing: string[] = [];
    if (!manualCounterExample) missing.push('缺少手算反例（主流程数据）');
    if (!questionnaireRow) missing.push('缺少问卷原始行（现场说法）');
    if (questionnaireRow && !questionnaireRow.onSiteStatement)
      missing.push('缺少现场说法描述');
    if (questionnaireRow && !questionnaireRow.witnessName) missing.push('缺少现场证人签名');
    if (negativeSample.isMarkedAsMissing) missing.push('旧表标记为缺失，需核实数据来源');
    return missing;
  }

  private explainWhyKept(
    negativeSample: NegativeSample,
    manualCounterExample?: ManualCounterExample,
    questionnaireRow?: QuestionnaireRow
  ): string {
    const explanations: string[] = [];
    if (manualCounterExample?.mainProcessEvidence)
      explanations.push('包含主流程关键证据');
    if (questionnaireRow?.onSiteStatement) explanations.push('包含现场说法记录');
    if (negativeSample.detectedBy === 'old_table') explanations.push('旧表异常样本，需要人工复核确认');
    if (questionnaireRow?.queueOverflow || questionnaireRow?.isTemporaryClosed)
      explanations.push('涉及特殊现场情况（临时关窗/排队溢出）');
    if (manualCounterExample && (manualCounterExample.waitTime < 0 || manualCounterExample.arrivalCount < 0))
      explanations.push('保留原始负数证据，不归入正常统计');
    if (explanations.length === 0) explanations.push('边界样本，保留用于后续分析');
    return explanations.join('；');
  }

  private determineNextAction(
    missingMaterials: string[],
    questionnaireRow?: QuestionnaireRow
  ): NextAction {
    if (missingMaterials.length >= 2) return 'collect_more_data';
    if (questionnaireRow && questionnaireRow.queueOverflow) return 'find_coach';
    if (missingMaterials.length === 1) return 'find_ta';
    return 'find_ta';
  }

  private determineNextContact(sample: BoundarySample): string {
    if (sample.questionnaireRow?.queueOverflow || sample.questionnaireRow?.isTemporaryClosed)
      return '竞赛教练唐老师（用于窗口排班优化）';
    if (sample.missingMaterials.length > 0) return '学生助教（补充材料）';
    return '已归档，如需重新分析请联系唐老师';
  }
}

export const boundarySampleManager = new BoundarySampleManager();
export { STATUS_LABEL, NEXT_ACTION_TEXT };
