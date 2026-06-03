import {
  BoundarySample,
  NegativeSample,
  ManualCounterExample,
  QuestionnaireRow,
  ReviewStatus,
  NextAction,
  BoundaryReport,
} from '../types';
import { generateBoundarySampleId, generateReportId } from '../utils/idGenerator';

export class BoundarySampleManager {
  private boundarySamples: Map<string, BoundarySample> = new Map();

  detectNegativeSamples(
    manualCounterExamples: ManualCounterExample[],
    questionnaireRows: QuestionnaireRow[]
  ): NegativeSample[] {
    const negativeSamples: NegativeSample[] = [];

    for (const manual of manualCounterExamples) {
      if (manual.waitTime < 0 || manual.arrivalCount < 0 || manual.isNegative) {
        const questionnaire = questionnaireRows.find(q => q.sampleId === manual.sampleId);
        
        negativeSamples.push({
          sampleId: manual.sampleId,
          detectedAt: new Date(),
          detectedBy: manual.source === 'old_table' ? 'old_table' : 'system',
          reason: this.getNegativeReason(manual, questionnaire),
          value: Math.min(manual.waitTime, manual.arrivalCount),
          isMarkedAsMissing: manual.source === 'old_table',
          sourceLink: {
            manualCounterExampleId: manual.id,
            questionnaireRowId: questionnaire?.id,
          },
        });
      }
    }

    for (const questionnaire of questionnaireRows) {
      const hasManual = manualCounterExamples.some(m => m.sampleId === questionnaire.sampleId);
      if (!hasManual && (questionnaire.actualWaitTime < 0 || questionnaire.actualArrivalCount < 0)) {
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
    
    if (manual.waitTime < 0) {
      reasons.push(`等待时间为负数(${manual.waitTime}分钟)`);
    }
    if (manual.arrivalCount < 0) {
      reasons.push(`到达人数为负数(${manual.arrivalCount}人)`);
    }
    if (manual.source === 'old_table') {
      reasons.push('旧系统标记为缺失');
    }
    if (questionnaire) {
      if (questionnaire.isTemporaryClosed) {
        reasons.push('窗口临时关闭');
      }
      if (questionnaire.queueOverflow) {
        reasons.push('排队溢出');
      }
    }
    if (manual.mainProcessEvidence) {
      reasons.push(`主流程证据: ${manual.mainProcessEvidence}`);
    }

    return reasons.join('；');
  }

  createBoundarySample(
    negativeSample: NegativeSample,
    manualCounterExample?: ManualCounterExample,
    questionnaireRow?: QuestionnaireRow
  ): BoundarySample {
    const missingMaterials = this.analyzeMissingMaterials(
      negativeSample,
      manualCounterExample,
      questionnaireRow
    );

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
    };

    this.boundarySamples.set(generateBoundarySampleId(), boundarySample);
    return boundarySample;
  }

  private analyzeMissingMaterials(
    negativeSample: NegativeSample,
    manualCounterExample?: ManualCounterExample,
    questionnaireRow?: QuestionnaireRow
  ): string[] {
    const missing: string[] = [];

    if (!manualCounterExample) {
      missing.push('缺少手算反例（主流程数据）');
    }
    if (!questionnaireRow) {
      missing.push('缺少问卷原始行（现场说法）');
    }
    if (questionnaireRow && !questionnaireRow.onSiteStatement) {
      missing.push('缺少现场说法描述');
    }
    if (questionnaireRow && !questionnaireRow.witnessName) {
      missing.push('缺少现场证人签名');
    }
    if (negativeSample.isMarkedAsMissing) {
      missing.push('旧表标记为缺失，需核实数据来源');
    }

    return missing;
  }

  private explainWhyKept(
    negativeSample: NegativeSample,
    manualCounterExample?: ManualCounterExample,
    questionnaireRow?: QuestionnaireRow
  ): string {
    const explanations: string[] = [];

    if (manualCounterExample?.mainProcessEvidence) {
      explanations.push('包含主流程关键证据');
    }
    if (questionnaireRow?.onSiteStatement) {
      explanations.push('包含现场说法记录');
    }
    if (negativeSample.detectedBy === 'old_table') {
      explanations.push('旧表异常样本，需要人工复核确认');
    }
    if (questionnaireRow?.queueOverflow || questionnaireRow?.isTemporaryClosed) {
      explanations.push('涉及特殊现场情况（临时关窗/排队溢出）');
    }
    if (explanations.length === 0) {
      explanations.push('边界样本，保留用于后续分析');
    }

    return explanations.join('；');
  }

  private determineNextAction(
    missingMaterials: string[],
    questionnaireRow?: QuestionnaireRow
  ): NextAction {
    if (missingMaterials.length >= 2) {
      return 'collect_more_data';
    }
    if (questionnaireRow && questionnaireRow.queueOverflow) {
      return 'find_coach';
    }
    return 'find_ta';
  }

  taReview(
    sampleId: string,
    verified: boolean,
    notes: string,
    supplementaryQuestionnaire?: QuestionnaireRow
  ): BoundarySample | undefined {
    const sample = this.findBySampleId(sampleId);
    if (!sample || sample.status !== 'pending_ta') {
      return undefined;
    }

    sample.updatedAt = new Date();
    sample.taReviewNotes = notes;

    if (supplementaryQuestionnaire) {
      sample.questionnaireRow = supplementaryQuestionnaire;
    }

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
    sample.nextAction = this.determineNextAction(sample.missingMaterials, sample.questionnaireRow);

    if (verified) {
      if (sample.missingMaterials.length === 0) {
        sample.status = 'pending_coach';
        sample.assignee = '竞赛教练唐老师';
      } else {
        sample.assignee = '学生助教';
      }
    } else {
      sample.status = 'dismissed';
      sample.assignee = undefined;
    }

    return sample;
  }

  coachReview(
    sampleId: string,
    verified: boolean,
    notes: string
  ): BoundarySample | undefined {
    const sample = this.findBySampleId(sampleId);
    if (!sample || sample.status !== 'pending_coach') {
      return undefined;
    }

    sample.updatedAt = new Date();
    sample.coachReviewNotes = notes;

    if (verified) {
      sample.status = 'coach_verified';
      sample.nextAction = 'resolve';
      sample.assignee = undefined;
    } else {
      sample.status = 'pending_ta';
      sample.nextAction = 'collect_more_data';
      sample.assignee = '学生助教';
    }

    return sample;
  }

  findBySampleId(sampleId: string): BoundarySample | undefined {
    for (const sample of this.boundarySamples.values()) {
      if (sample.sampleId === sampleId) {
        return sample;
      }
    }
    return undefined;
  }

  getAllBoundarySamples(): BoundarySample[] {
    return Array.from(this.boundarySamples.values());
  }

  getBoundarySamplesByStatus(status: ReviewStatus): BoundarySample[] {
    return this.getAllBoundarySamples().filter(s => s.status === status);
  }

  generateReport(): BoundaryReport {
    const samples = this.getAllBoundarySamples();
    
    return {
      reportId: generateReportId(),
      generatedAt: new Date(),
      boundarySamples: samples,
      statistics: {
        total: samples.length,
        pendingTa: samples.filter(s => s.status === 'pending_ta').length,
        pendingCoach: samples.filter(s => s.status === 'pending_coach').length,
        verified: samples.filter(s => s.status === 'coach_verified').length,
        resolved: samples.filter(s => s.status === 'resolved').length,
      },
    };
  }

  clear(): void {
    this.boundarySamples.clear();
  }
}

export const boundarySampleManager = new BoundarySampleManager();
