import { store } from './store';
import { PlanStatus, FlowType, ReviewResult, ImportResult, AdPlan, Advertiser, SpendCallback, ReviewRecord } from './types';

export class BudgetStopLossService {
  checkBudgetOverrun(planId: string): { isOverrun: boolean; budgetUsed: number; budgetTotal: number } {
    const plan = store.getAdPlan(planId);
    if (!plan) {
      throw new Error('计划不存在');
    }
    
    const isOverrun = plan.currentSpend >= plan.totalBudget;
    return {
      isOverrun,
      budgetUsed: plan.currentSpend,
      budgetTotal: plan.totalBudget
    };
  }

  triggerStopLoss(planId: string, operatorId: string, operatorName: string): AdPlan {
    const plan = store.getAdPlan(planId);
    if (!plan) {
      throw new Error('计划不存在');
    }

    const updatedPlan = store.updateAdPlan(planId, {
      status: PlanStatus.STOPPING
    });

    if (!updatedPlan) {
      throw new Error('更新计划失败');
    }

    store.addReviewRecord({
      planId,
      flowType: FlowType.NORMAL,
      operatorId,
      operatorName,
      reviewResult: ReviewResult.APPROVED,
      reason: '系统检测到预算超支，自动触发止损',
      evidenceUrls: [
        `https://ad-platform.example.com/evidence/${planId}/spend-report.pdf`,
        `https://ad-platform.example.com/evidence/${planId}/budget-snapshot.png`
      ]
    });

    return updatedPlan;
  }

  processReject(planId: string, operatorId: string, operatorName: string, reason: string): AdPlan {
    const plan = store.getAdPlan(planId);
    if (!plan) {
      throw new Error('计划不存在');
    }

    const updatedPlan = store.updateAdPlan(planId, {
      status: PlanStatus.RUNNING
    });

    if (!updatedPlan) {
      throw new Error('更新计划失败');
    }

    store.addReviewRecord({
      planId,
      flowType: FlowType.REJECT,
      operatorId,
      operatorName,
      reviewResult: ReviewResult.REJECTED,
      reason: `驳回止损: ${reason}`,
      evidenceUrls: [
        `https://ad-platform.example.com/evidence/${planId}/reject-form.pdf`,
        `https://ad-platform.example.com/evidence/${planId}/actual-spend-proof.xlsx`
      ]
    });

    return updatedPlan;
  }

  processManualReview(planId: string, operatorId: string, operatorName: string, approved: boolean, reason: string): AdPlan {
    const plan = store.getAdPlan(planId);
    if (!plan) {
      throw new Error('计划不存在');
    }

    let newStatus: PlanStatus;
    let reviewResult: ReviewResult;

    if (approved) {
      newStatus = PlanStatus.PENDING_COMPENSATION;
      reviewResult = ReviewResult.APPROVED;
    } else {
      newStatus = PlanStatus.RUNNING;
      reviewResult = ReviewResult.REJECTED;
    }

    const updatedPlan = store.updateAdPlan(planId, {
      status: newStatus
    });

    if (!updatedPlan) {
      throw new Error('更新计划失败');
    }

    store.addReviewRecord({
      planId,
      flowType: FlowType.MANUAL_REVIEW,
      operatorId,
      operatorName,
      reviewResult,
      reason: `人工复核${approved ? '通过' : '驳回'}: ${reason}`,
      evidenceUrls: [
        `https://ad-platform.example.com/evidence/${planId}/manual-review-form.pdf`,
        `https://ad-platform.example.com/evidence/${planId}/meeting-minutes.docx`
      ]
    });

    return updatedPlan;
  }

  closePlan(planId: string, operatorId: string, operatorName: string): AdPlan {
    const plan = store.getAdPlan(planId);
    if (!plan) {
      throw new Error('计划不存在');
    }

    const updatedPlan = store.updateAdPlan(planId, {
      status: PlanStatus.CLOSED
    });

    if (!updatedPlan) {
      throw new Error('更新计划失败');
    }

    store.addReviewRecord({
      planId,
      flowType: FlowType.NORMAL,
      operatorId,
      operatorName,
      reviewResult: ReviewResult.APPROVED,
      reason: '补偿处理完成，计划关闭',
      evidenceUrls: [
        `https://ad-platform.example.com/evidence/${planId}/completion-certificate.pdf`
      ]
    });

    return updatedPlan;
  }

  batchImportSpendCallbacks(data: Array<{
    planId: string;
    spendAmount: number;
    callbackTime: Date;
    callbackSource: string;
  }>): ImportResult[] {
    const results: ImportResult[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 1;

      try {
        const plan = store.getAdPlan(row.planId);
        if (!plan) {
          results.push({
            success: false,
            rowNumber,
            errorMessage: `计划ID ${row.planId} 不存在`
          });
          continue;
        }

        const callbackTime = new Date(row.callbackTime);
        const now = new Date();
        const isDelayed = (now.getTime() - callbackTime.getTime()) > 2 * 60 * 60 * 1000;

        if (isDelayed && (plan.currentSpend + row.spendAmount) > plan.totalBudget) {
          results.push({
            success: false,
            rowNumber,
            planId: plan.id,
            errorMessage: `回传延迟，计划已超预算。当前消耗: ${plan.currentSpend}，回传金额: ${row.spendAmount}，预算总额: ${plan.totalBudget}`
          });
          continue;
        }

        store.addSpendCallback({
          planId: row.planId,
          spendAmount: row.spendAmount,
          callbackTime,
          callbackSource: row.callbackSource,
          isDelayed
        });

        store.updateAdPlan(row.planId, {
          currentSpend: plan.currentSpend + row.spendAmount
        });

        results.push({
          success: true,
          rowNumber,
          planId: plan.id
        });
      } catch (error) {
        results.push({
          success: false,
          rowNumber,
          errorMessage: error instanceof Error ? error.message : '未知错误'
        });
      }
    }

    return results;
  }

  getPlanWithDetails(planId: string): {
    plan: AdPlan;
    advertiser: Advertiser | undefined;
    spendCallbacks: SpendCallback[];
    reviewRecords: ReviewRecord[];
  } | null {
    const plan = store.getAdPlan(planId);
    if (!plan) return null;

    const advertiser = store.getAdvertiser(plan.advertiserId);
    const spendCallbacks = store.getSpendCallbacksByPlan(planId);
    const reviewRecords = store.getReviewRecordsByPlan(planId);

    return { plan, advertiser, spendCallbacks, reviewRecords };
  }

  exportPlanData(planId: string): {
    advertiser: Advertiser;
    plan: AdPlan;
    spendCallbacks: SpendCallback[];
    reviewRecords: ReviewRecord[];
  } | null {
    const details = this.getPlanWithDetails(planId);
    if (!details || !details.advertiser) return null;

    return {
      advertiser: details.advertiser,
      plan: details.plan,
      spendCallbacks: details.spendCallbacks,
      reviewRecords: details.reviewRecords
    };
  }
}

export const budgetService = new BudgetStopLossService();
