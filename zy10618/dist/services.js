"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.budgetService = exports.BudgetStopLossService = void 0;
const store_1 = require("./store");
const types_1 = require("./types");
class BudgetStopLossService {
    checkBudgetOverrun(planId) {
        const plan = store_1.store.getAdPlan(planId);
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
    triggerStopLoss(planId, operatorId, operatorName) {
        const plan = store_1.store.getAdPlan(planId);
        if (!plan) {
            throw new Error('计划不存在');
        }
        const updatedPlan = store_1.store.updateAdPlan(planId, {
            status: types_1.PlanStatus.STOPPING
        });
        if (!updatedPlan) {
            throw new Error('更新计划失败');
        }
        store_1.store.addReviewRecord({
            planId,
            flowType: types_1.FlowType.NORMAL,
            operatorId,
            operatorName,
            reviewResult: types_1.ReviewResult.APPROVED,
            reason: '系统检测到预算超支，自动触发止损',
            evidenceUrls: [
                `https://ad-platform.example.com/evidence/${planId}/spend-report.pdf`,
                `https://ad-platform.example.com/evidence/${planId}/budget-snapshot.png`
            ]
        });
        return updatedPlan;
    }
    processReject(planId, operatorId, operatorName, reason) {
        const plan = store_1.store.getAdPlan(planId);
        if (!plan) {
            throw new Error('计划不存在');
        }
        const updatedPlan = store_1.store.updateAdPlan(planId, {
            status: types_1.PlanStatus.RUNNING
        });
        if (!updatedPlan) {
            throw new Error('更新计划失败');
        }
        store_1.store.addReviewRecord({
            planId,
            flowType: types_1.FlowType.REJECT,
            operatorId,
            operatorName,
            reviewResult: types_1.ReviewResult.REJECTED,
            reason: `驳回止损: ${reason}`,
            evidenceUrls: [
                `https://ad-platform.example.com/evidence/${planId}/reject-form.pdf`,
                `https://ad-platform.example.com/evidence/${planId}/actual-spend-proof.xlsx`
            ]
        });
        return updatedPlan;
    }
    processManualReview(planId, operatorId, operatorName, approved, reason) {
        const plan = store_1.store.getAdPlan(planId);
        if (!plan) {
            throw new Error('计划不存在');
        }
        let newStatus;
        let reviewResult;
        if (approved) {
            newStatus = types_1.PlanStatus.PENDING_COMPENSATION;
            reviewResult = types_1.ReviewResult.APPROVED;
        }
        else {
            newStatus = types_1.PlanStatus.RUNNING;
            reviewResult = types_1.ReviewResult.REJECTED;
        }
        const updatedPlan = store_1.store.updateAdPlan(planId, {
            status: newStatus
        });
        if (!updatedPlan) {
            throw new Error('更新计划失败');
        }
        store_1.store.addReviewRecord({
            planId,
            flowType: types_1.FlowType.MANUAL_REVIEW,
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
    closePlan(planId, operatorId, operatorName) {
        const plan = store_1.store.getAdPlan(planId);
        if (!plan) {
            throw new Error('计划不存在');
        }
        const updatedPlan = store_1.store.updateAdPlan(planId, {
            status: types_1.PlanStatus.CLOSED
        });
        if (!updatedPlan) {
            throw new Error('更新计划失败');
        }
        store_1.store.addReviewRecord({
            planId,
            flowType: types_1.FlowType.NORMAL,
            operatorId,
            operatorName,
            reviewResult: types_1.ReviewResult.APPROVED,
            reason: '补偿处理完成，计划关闭',
            evidenceUrls: [
                `https://ad-platform.example.com/evidence/${planId}/completion-certificate.pdf`
            ]
        });
        return updatedPlan;
    }
    batchImportSpendCallbacks(data) {
        const results = [];
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNumber = i + 1;
            try {
                const plan = store_1.store.getAdPlan(row.planId);
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
                store_1.store.addSpendCallback({
                    planId: row.planId,
                    spendAmount: row.spendAmount,
                    callbackTime,
                    callbackSource: row.callbackSource,
                    isDelayed
                });
                store_1.store.updateAdPlan(row.planId, {
                    currentSpend: plan.currentSpend + row.spendAmount
                });
                results.push({
                    success: true,
                    rowNumber,
                    planId: plan.id
                });
            }
            catch (error) {
                results.push({
                    success: false,
                    rowNumber,
                    errorMessage: error instanceof Error ? error.message : '未知错误'
                });
            }
        }
        return results;
    }
    getPlanWithDetails(planId) {
        const plan = store_1.store.getAdPlan(planId);
        if (!plan)
            return null;
        const advertiser = store_1.store.getAdvertiser(plan.advertiserId);
        const spendCallbacks = store_1.store.getSpendCallbacksByPlan(planId);
        const reviewRecords = store_1.store.getReviewRecordsByPlan(planId);
        return { plan, advertiser, spendCallbacks, reviewRecords };
    }
    exportPlanData(planId) {
        const details = this.getPlanWithDetails(planId);
        if (!details || !details.advertiser)
            return null;
        return {
            advertiser: details.advertiser,
            plan: details.plan,
            spendCallbacks: details.spendCallbacks,
            reviewRecords: details.reviewRecords
        };
    }
}
exports.BudgetStopLossService = BudgetStopLossService;
exports.budgetService = new BudgetStopLossService();
