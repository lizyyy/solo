package com.xxx.financial.service;

import com.xxx.financial.enums.ReviewStatus;
import com.xxx.financial.model.*;
import com.xxx.financial.store.ReviewDataStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class InterestReviewService {

    private static final Logger logger = LoggerFactory.getLogger(InterestReviewService.class);

    private final TailAdjustmentService tailAdjustmentService;
    private final TrusteeConfirmationService trusteeConfirmationService;
    private final BalanceVerificationService balanceVerificationService;
    private final SelfCheckService selfCheckService;
    private ReviewDataStore dataStore;

    public InterestReviewService() {
        this.tailAdjustmentService = new TailAdjustmentService();
        this.trusteeConfirmationService = new TrusteeConfirmationService();
        this.balanceVerificationService = new BalanceVerificationService();
        this.selfCheckService = new SelfCheckService(tailAdjustmentService, balanceVerificationService, trusteeConfirmationService);
    }

    public InterestReviewService(ReviewDataStore dataStore) {
        this.dataStore = dataStore;
        this.tailAdjustmentService = new TailAdjustmentService(dataStore);
        this.trusteeConfirmationService = new TrusteeConfirmationService();
        this.balanceVerificationService = new BalanceVerificationService();
        this.selfCheckService = new SelfCheckService(tailAdjustmentService, balanceVerificationService, trusteeConfirmationService);
    }

    public void setDataStore(ReviewDataStore dataStore) {
        this.dataStore = dataStore;
        this.tailAdjustmentService.setDataStore(dataStore);
    }

    private void persistContext(InterestReviewContext context) {
        if (dataStore != null) {
            dataStore.saveContext(context);
        }
    }

    public InterestReviewContext initReview(CommercialBill bill, String operator) {
        InterestReviewContext context = new InterestReviewContext();
        context.setReviewNo("REV" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        context.setCommercialBill(bill);
        context.setOperator(operator);
        context.setStatus(ReviewStatus.PENDING);

        logger.info("初始化企业票据贴现利息复核，复核单号: {}, 票据号: {}, 操作人: {}",
                context.getReviewNo(), bill.getBillNo(), operator);
        return context;
    }

    public ReviewResult step1ImportTailAdjustment(InterestReviewContext context, TailAdjustment adjustment) {
        logger.info("【步骤1】开始导入尾差调整条，复核单号: {}", context.getReviewNo());

        ReviewResult result = new ReviewResult();
        result.setReviewNo(context.getReviewNo());
        List<String> messages = new ArrayList<>();

        context.setTailAdjustment(adjustment);
        SelfCheckResult duplicateCheck = selfCheckService.checkDuplicateImport(context);

        if (!duplicateCheck.isPassed()) {
            result.setSuccess(false);
            result.setFinalStatus(ReviewStatus.CALIBER_ERROR);
            messages.add(duplicateCheck.getMessage());
            result.setMessages(messages);
            result.setNextAction("请检查调整单号是否正确，或删除重复记录后重新导入");
            result.setHandler("系统");
            logger.warn("步骤1失败: {}", duplicateCheck.getMessage());
            return result;
        }

        boolean processSuccess = tailAdjustmentService.processTailAdjustment(context, adjustment);
        if (!processSuccess) {
            result.setSuccess(false);
            result.setFinalStatus(context.getStatus());
            messages.add("尾差调整条处理失败");
            result.setMessages(messages);
            return result;
        }

        tailAdjustmentService.recordImport(adjustment.getAdjustmentNo());

        SelfCheckResult pinyinCheck = selfCheckService.checkApproverPinyin(context);

        if (context.hasPinyinApprover()) {
            result.setSuccess(false);
            result.setFinalStatus(ReviewStatus.PENDING_MANAGER_REVIEW);
            messages.add("尾差调整条导入成功，但审批人仅留拼音(" + adjustment.getApprover() + ")");
            messages.add("已标记为待客户经理复核，不归入正常流程");
            result.setMessages(messages);
            result.setNextAction("请客户经理复核审批人身份，确认无误后继续流程");
            result.setHandler("客户经理");
            logger.info("步骤1完成，待客户经理复核");
        } else {
            result.setSuccess(true);
            result.setFinalStatus(ReviewStatus.NORMAL);
            messages.add("尾差调整条导入成功");
            messages.add("审批人信息完整，进入正常流程");
            result.setMessages(messages);
            result.setNextAction("请支付平台产品阿南补看托管确认页");
            result.setHandler("支付平台产品阿南");
            logger.info("步骤1完成，进入正常流程");
        }

        result.setSelfCheckReport(new ArrayList<>(context.getSelfCheckResults()));
        persistContext(context);
        return result;
    }

    public ReviewResult step2ReviewTrusteeConfirmation(InterestReviewContext context, TrusteeConfirmation trustee) {
        logger.info("【步骤2】支付平台产品阿南补看托管确认页，复核单号: {}", context.getReviewNo());

        ReviewResult result = new ReviewResult();
        result.setReviewNo(context.getReviewNo());
        List<String> messages = new ArrayList<>();

        if (context.hasPinyinApprover() && context.getManagerReviewRemark() == null) {
            result.setSuccess(false);
            result.setFinalStatus(ReviewStatus.PENDING_MANAGER_REVIEW);
            messages.add("审批人仅为拼音，需先由客户经理复核");
            result.setMessages(messages);
            result.setNextAction("请先联系客户经理完成审批人身份复核");
            result.setHandler("客户经理");
            logger.warn("步骤2暂停: 需先完成客户经理复核");
            return result;
        }

        boolean reviewSuccess = trusteeConfirmationService.reviewTrusteeConfirmation(context, trustee);
        selfCheckService.checkTailTrusteeConflict(context);
        selfCheckService.checkExportConsistency(context);
        selfCheckService.checkSupplementRecalculate(context);

        if (!reviewSuccess) {
            result.setSuccess(false);
            result.setFinalStatus(ReviewStatus.DATA_CONFLICT);
            messages.add("托管确认页复核完成，但检测到数据冲突");

            for (ConflictEvidence conflict : context.getConflicts()) {
                if (!conflict.isResolved()) {
                    messages.add(conflict.formatConflictReport());
                }
            }

            messages.add("请支付平台产品阿南选择确认或驳回，系统不自动拍板");
            result.setMessages(messages);
            result.setNextAction("请支付平台产品阿南确认冲突处理方式（确认尾差调整/驳回以托管为准）");
            result.setHandler("支付平台产品阿南");
            result.setConflictReport(new ArrayList<>(context.getConflicts()));
        } else {
            result.setSuccess(true);
            if (context.hasPinyinApprover() && context.getManagerReviewRemark() == null) {
                result.setFinalStatus(ReviewStatus.PENDING_MANAGER_REVIEW);
                messages.add("托管确认页复核成功，无冲突");
                messages.add("审批人仅为拼音，仍需客户经理复核");
                result.setNextAction("请客户经理完成审批人复核后，再更新余额变化表");
                result.setHandler("客户经理");
            } else {
                result.setFinalStatus(ReviewStatus.NORMAL);
                messages.add("托管确认页复核成功，无冲突");
                result.setNextAction("请更新余额变化表");
                result.setHandler("系统/操作员");
            }
            result.setMessages(messages);
            logger.info("步骤2完成，托管确认页复核通过");
        }

        result.setSelfCheckReport(new ArrayList<>(context.getSelfCheckResults()));
        persistContext(context);
        return result;
    }

    public ReviewResult resolveConflict(InterestReviewContext context, String adjustmentNo,
                                        boolean confirm, String decisionRemark) {
        logger.info("【冲突处理】支付平台产品阿南处理数据冲突，调整单号: {}, 确认: {}", adjustmentNo, confirm);

        ReviewResult result = new ReviewResult();
        result.setReviewNo(context.getReviewNo());
        List<String> messages = new ArrayList<>();

        trusteeConfirmationService.resolveConflict(context, adjustmentNo, confirm, decisionRemark);

        if (!confirm) {
            tailAdjustmentService.clearImportRecord(adjustmentNo);
            logger.info("已清除调整单号{}的重复导入记录，因金额已更新", adjustmentNo);
        }

        if (!context.hasUnresolvedConflicts()) {
            context.overrideSelfCheckItem(com.xxx.financial.enums.SelfCheckItem.TAIL_TRUSTEE_CONFLICT,
                    "产品决策: " + (confirm ? "确认尾差调整" : "驳回以托管为准") + "。备注: " + decisionRemark);
            selfCheckService.checkSupplementRecalculate(context);
            selfCheckService.checkExportConsistency(context);
            result.setSuccess(true);
            if (context.hasPinyinApprover() && context.getManagerReviewRemark() == null) {
                result.setFinalStatus(ReviewStatus.PENDING_MANAGER_REVIEW);
                messages.add("数据冲突已解决");
                messages.add("审批人仅为拼音，仍需客户经理复核");
                result.setNextAction("请客户经理完成审批人复核");
                result.setHandler("客户经理");
            } else {
                result.setFinalStatus(ReviewStatus.NORMAL);
                messages.add("数据冲突已解决");
                result.setNextAction("请更新余额变化表");
                result.setHandler("系统/操作员");
            }
        } else {
            result.setSuccess(false);
            result.setFinalStatus(ReviewStatus.DATA_CONFLICT);
            messages.add("仍有未解决的数据冲突");
            result.setNextAction("请继续处理剩余冲突");
            result.setHandler("支付平台产品阿南");
        }

        result.setMessages(messages);
        result.setConflictReport(new ArrayList<>(context.getConflicts()));
        persistContext(context);
        return result;
    }

    public ReviewResult managerReviewApprover(InterestReviewContext context, boolean approved, String remark) {
        logger.info("【客户经理复核】审批人拼音复核，复核单号: {}, 通过: {}", context.getReviewNo(), approved);

        ReviewResult result = new ReviewResult();
        result.setReviewNo(context.getReviewNo());
        List<String> messages = new ArrayList<>();

        context.setManagerReviewRemark(remark);

        if (approved) {
            result.setSuccess(true);
            context.setStatus(ReviewStatus.NORMAL);
            context.overrideSelfCheckItem(com.xxx.financial.enums.SelfCheckItem.APPROVER_PINYIN,
                    "客户经理复核通过: " + remark);
            if (context.hasUnresolvedConflicts()) {
                result.setFinalStatus(ReviewStatus.DATA_CONFLICT);
                messages.add("客户经理已确认审批人身份");
                messages.add("但仍存在未解决的数据冲突，请支付平台产品阿南处理");
                result.setNextAction("请支付平台产品阿南处理数据冲突");
                result.setHandler("支付平台产品阿南");
            } else if (!context.isStep2TrusteeReviewed()) {
                result.setFinalStatus(ReviewStatus.NORMAL);
                messages.add("客户经理已确认审批人身份");
                messages.add("请支付平台产品阿南补看托管确认页");
                result.setNextAction("请支付平台产品阿南复核托管确认页");
                result.setHandler("支付平台产品阿南");
            } else {
                result.setFinalStatus(ReviewStatus.NORMAL);
                messages.add("客户经理已确认审批人身份，可继续流程");
                result.setNextAction("请更新余额变化表");
                result.setHandler("系统/操作员");
            }
        } else {
            result.setSuccess(false);
            result.setFinalStatus(ReviewStatus.REVIEW_REJECTED);
            messages.add("客户经理驳回，审批人身份存疑");
            messages.add("备注: " + remark);
            result.setNextAction("请联系业务人员补充正确的审批人信息");
            result.setHandler("业务人员");
            context.setStatus(ReviewStatus.REVIEW_REJECTED);
        }

        result.setMessages(messages);
        return result;
    }

    public ReviewResult step3UpdateBalanceTable(InterestReviewContext context) {
        logger.info("【步骤3】更新余额变化表，复核单号: {}", context.getReviewNo());

        ReviewResult result = new ReviewResult();
        result.setReviewNo(context.getReviewNo());
        List<String> messages = new ArrayList<>();

        if (context.hasPinyinApprover() && context.getManagerReviewRemark() == null) {
            result.setSuccess(false);
            result.setFinalStatus(ReviewStatus.PENDING_MANAGER_REVIEW);
            messages.add("审批人仅为拼音且未经过客户经理复核，不能更新余额变化表");
            result.setMessages(messages);
            result.setNextAction("请先完成客户经理复核");
            result.setHandler("客户经理");
            return result;
        }

        if (context.hasUnresolvedConflicts()) {
            result.setSuccess(false);
            result.setFinalStatus(ReviewStatus.DATA_CONFLICT);
            messages.add("存在未解决的数据冲突，不能更新余额变化表");
            result.setMessages(messages);
            result.setNextAction("请先由支付平台产品阿南处理数据冲突");
            result.setHandler("支付平台产品阿南");
            return result;
        }

        selfCheckService.checkBalanceHistoryMatch(context);

        boolean balanceHistoryOk = context.getSelfCheckResults().stream()
                .filter(r -> r.getCheckItem().equals(com.xxx.financial.enums.SelfCheckItem.BALANCE_HISTORY_MATCH))
                .findFirst()
                .map(SelfCheckResult::isPassed)
                .orElse(false);

        if (!balanceHistoryOk && !context.getBalanceHistory().isEmpty()) {
            result.setSuccess(false);
            result.setFinalStatus(ReviewStatus.CALIBER_ERROR);
            messages.add("余额变化表与历史记录不匹配，请检查数据");
            result.setMessages(messages);
            result.setNextAction("请检查余额历史记录的准确性");
            result.setHandler("操作员");
            return result;
        }

        boolean updateSuccess = balanceVerificationService.updateBalanceTable(context);

        if (updateSuccess) {
            result.setSuccess(true);
            result.setFinalStatus(ReviewStatus.REVIEW_PASSED);
            messages.add("余额变化表更新成功");
            messages.add("当前余额: " + balanceVerificationService.getCurrentBalance(context));
            messages.add("企业票据贴现利息复核全部完成");
            result.setMessages(messages);
            result.setNextAction("复核完成，可归档或导出");
            result.setHandler("系统");
            logger.info("步骤3完成，复核全部通过");
        } else {
            result.setSuccess(false);
            result.setFinalStatus(context.getStatus());
            messages.add("余额变化表更新失败");
            result.setMessages(messages);
            logger.error("步骤3失败: 余额更新失败");
        }

        result.setSelfCheckReport(new ArrayList<>(context.getSelfCheckResults()));
        return result;
    }

    public ReviewResult executeFullReview(CommercialBill bill, TailAdjustment adjustment,
                                          TrusteeConfirmation trustee, String operator) {
        logger.info("【全自动复核】开始企业票据贴现利息全流程复核，票据号: {}", bill.getBillNo());

        InterestReviewContext context = initReview(bill, operator);

        ReviewResult step1 = step1ImportTailAdjustment(context, adjustment);
        if (!step1.isSuccess()) {
            return step1;
        }

        if (context.hasPinyinApprover()) {
            ReviewResult managerReview = managerReviewApprover(context, true, "自动模拟审批人复核通过");
            if (!managerReview.isSuccess()) {
                return managerReview;
            }
        }

        ReviewResult step2 = step2ReviewTrusteeConfirmation(context, trustee);
        if (!step2.isSuccess()) {
            return step2;
        }

        if (context.hasUnresolvedConflicts()) {
            ReviewResult resolve = resolveConflict(context, adjustment.getAdjustmentNo(), true, "自动模拟产品确认");
            if (!resolve.isSuccess()) {
                return resolve;
            }
        }

        return step3UpdateBalanceTable(context);
    }

    public SelfCheckService getSelfCheckService() {
        return selfCheckService;
    }
}
