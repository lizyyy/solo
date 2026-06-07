import { Review, ReviewStep, ReviewStatus, TrainingLog } from '@/types';

export interface BoundaryRule {
  id: string;
  name: string;
  description: string;
  handler: (ctx: RuleContext) => RuleResult;
  rollback: (ctx: RuleContext) => void;
}

export interface RuleContext {
  review: Review;
  trainingLogs?: TrainingLog[];
  modifiedBy: string;
}

export interface RuleResult {
  passed: boolean;
  message: string;
  updates?: Partial<Review>;
}

export const BOUNDARY_RULES: BoundaryRule[] = [
  {
    id: 'RULE-001',
    name: '特征缺失给默认分检测',
    description: '线上特征缺失却给了默认分时，必须标记待复核',
    handler: (ctx: RuleContext): RuleResult => {
      const hasDefaultIssue = ctx.trainingLogs?.some(log =>
        log.content.includes('默认分') ||
        log.content.includes('feature_missing') ||
        log.content.includes('default_score')
      );
      if (hasDefaultIssue && !ctx.review.hasDefaultScoreIssue) {
        return {
          passed: true,
          message: '检测到特征缺失给默认分，已自动标记待复核',
          updates: {
            hasDefaultScoreIssue: true,
            status: 'pending_review',
          },
        };
      }
      return { passed: true, message: '无默认分问题' };
    },
    rollback: (ctx: RuleContext) => {
      ctx.review.hasDefaultScoreIssue = false;
      ctx.review.status = 'in_progress';
    },
  },
  {
    id: 'RULE-004',
    name: '三步流程完整性校验',
    description: '必须走完三步流程才能标记为已完成',
    handler: (ctx: RuleContext): RuleResult => {
      if (ctx.review.status === 'completed' && ctx.review.currentStep !== 'summary_update') {
        return {
          passed: false,
          message: '三步流程未完成，无法标记为已完成',
        };
      }
      return { passed: true, message: '流程完整' };
    },
    rollback: () => {},
  },
  {
    id: 'RULE-005',
    name: '待复核项确认校验',
    description: '存在默认分问题且未确认时，禁止标记完成',
    handler: (ctx: RuleContext): RuleResult => {
      if (
        ctx.review.status === 'completed' &&
        ctx.review.hasDefaultScoreIssue &&
        !ctx.review.reviewComment
      ) {
        return {
          passed: false,
          message: '存在特征缺失给默认分问题，需推荐负责人复核后才能完成',
        };
      }
      return { passed: true, message: '复核已完成' };
    },
    rollback: () => {},
  },
];

export function applyBoundaryRules(
  context: RuleContext,
  targetStatus?: ReviewStatus
): { success: boolean; messages: string[]; updates: Partial<Review> } {
  const messages: string[] = [];
  const updates: Partial<Review> = {};
  let success = true;

  for (const rule of BOUNDARY_RULES) {
    const result = rule.handler({
      ...context,
      review: { ...context.review, ...updates, status: targetStatus || context.review.status },
    });
    if (result.message) {
      messages.push(`[${rule.id}] ${result.message}`);
    }
    if (!result.passed) {
      success = false;
    }
    if (result.updates) {
      Object.assign(updates, result.updates);
    }
  }

  return { success, messages, updates };
}

export function canTransitionStep(
  currentStep: ReviewStep,
  targetStep: ReviewStep
): boolean {
  const stepOrder: ReviewStep[] = ['log_import', 'threshold_note', 'summary_update'];
  const currentIdx = stepOrder.indexOf(currentStep);
  const targetIdx = stepOrder.indexOf(targetStep);
  return targetIdx === currentIdx + 1 || targetIdx <= currentIdx;
}

export function getNextStep(currentStep: ReviewStep): ReviewStep | null {
  const stepOrder: ReviewStep[] = ['log_import', 'threshold_note', 'summary_update'];
  const idx = stepOrder.indexOf(currentStep);
  return idx < stepOrder.length - 1 ? stepOrder[idx + 1] : null;
}
