package com.xxx.financial.service;

import com.xxx.financial.enums.ReviewStatus;
import com.xxx.financial.model.ConflictEvidence;
import com.xxx.financial.model.InterestReviewContext;
import com.xxx.financial.model.TailAdjustment;
import com.xxx.financial.model.TrusteeConfirmation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;

public class TrusteeConfirmationService {

    private static final Logger logger = LoggerFactory.getLogger(TrusteeConfirmationService.class);

    private static final BigDecimal TOLERANCE = new BigDecimal("0.01");

    public ConflictEvidence checkConflict(TailAdjustment tail, TrusteeConfirmation trustee) {
        return checkConflict(null, tail, trustee);
    }

    public ConflictEvidence checkConflict(InterestReviewContext context, TailAdjustment tail, TrusteeConfirmation trustee) {
        if (tail == null || trustee == null) {
            return null;
        }

        BigDecimal systemInterest = context != null && context.getCommercialBill() != null
                ? context.getCommercialBill().getDiscountInterest()
                : BigDecimal.ZERO;
        BigDecimal adjustedInterest = systemInterest.add(tail.getAdjustmentAmount());
        BigDecimal diff = adjustedInterest.subtract(trustee.getConfirmedInterest()).abs();

        if (diff.compareTo(TOLERANCE) > 0) {
            ConflictEvidence evidence = new ConflictEvidence();
            evidence.setBillNo(tail.getBillNo());
            evidence.setAdjustmentNo(tail.getAdjustmentNo());
            evidence.setConfirmationNo(trustee.getConfirmationNo());
            evidence.setTailAdjustmentAmount(adjustedInterest);
            evidence.setTrusteeConfirmedAmount(trustee.getConfirmedInterest());
            evidence.setDifference(diff);
            evidence.setConflictType("利息金额不一致");
            evidence.setDescription(String.format(
                    "调整后利息(系统利息%s+尾差调整%s=%s)与托管确认利息%s差异超过容错阈值(0.01)",
                    systemInterest, tail.getAdjustmentAmount(), adjustedInterest, trustee.getConfirmedInterest()));
            evidence.setResolved(false);

            logger.warn("检测到数据冲突: {}", evidence.formatConflictReport());
            return evidence;
        }

        BigDecimal balanceDiff = adjustedInterest.subtract(trustee.getConfirmedBalance()).abs();
        if (balanceDiff.compareTo(TOLERANCE) > 0) {
            ConflictEvidence evidence = new ConflictEvidence();
            evidence.setBillNo(tail.getBillNo());
            evidence.setAdjustmentNo(tail.getAdjustmentNo());
            evidence.setConfirmationNo(trustee.getConfirmationNo());
            evidence.setTailAdjustmentAmount(adjustedInterest);
            evidence.setTrusteeConfirmedAmount(trustee.getConfirmedBalance());
            evidence.setDifference(balanceDiff);
            evidence.setConflictType("余额不一致");
            evidence.setDescription(String.format(
                    "调整后余额(系统利息%s+尾差调整%s=%s)与托管确认余额%s差异超过容错阈值(0.01)",
                    systemInterest, tail.getAdjustmentAmount(), adjustedInterest, trustee.getConfirmedBalance()));
            evidence.setResolved(false);

            logger.warn("检测到数据冲突: {}", evidence.formatConflictReport());
            return evidence;
        }

        logger.info("尾差调整与托管确认数据一致，无冲突");
        return null;
    }

    public boolean reviewTrusteeConfirmation(InterestReviewContext context, TrusteeConfirmation trustee) {
        logger.info("开始复核托管确认页，确认单号: {}", trustee.getConfirmationNo());

        context.setTrusteeConfirmation(trustee);

        ConflictEvidence conflict = checkConflict(context, context.getTailAdjustment(), trustee);
        if (conflict != null) {
            context.addConflict(conflict);
            context.setStatus(ReviewStatus.DATA_CONFLICT);
            context.setStep2TrusteeReviewed(true);
            logger.warn("托管确认页复核完成，发现数据冲突，需支付平台产品阿南确认");
            return false;
        }

        if (context.getStatus() != ReviewStatus.PENDING_MANAGER_REVIEW) {
            context.setStatus(ReviewStatus.NORMAL);
        }
        context.setStep2TrusteeReviewed(true);

        logger.info("托管确认页复核完成，无冲突");
        return true;
    }

    public void resolveConflict(InterestReviewContext context, String adjustmentNo, boolean confirm, String decisionRemark) {
        for (ConflictEvidence conflict : context.getConflicts()) {
            if (adjustmentNo.equals(conflict.getAdjustmentNo()) && !conflict.isResolved()) {
                conflict.setResolved(true);
                conflict.setResolution(confirm ? "产品确认以尾差调整为准" : "产品驳回，以托管确认页为准");
                context.setProductDecision(conflict.getResolution() + "。备注: " + decisionRemark);

                if (confirm) {
                    logger.info("支付平台产品阿南已确认冲突，以尾差调整为准，调整单号: {}", adjustmentNo);
                } else {
                    logger.info("支付平台产品阿南已驳回冲突，以托管确认页为准，调整单号: {}", adjustmentNo);
                    if (context.getTailAdjustment() != null && context.getTrusteeConfirmation() != null
                            && context.getCommercialBill() != null) {
                        BigDecimal correctTail = context.getTrusteeConfirmation().getConfirmedInterest()
                                .subtract(context.getCommercialBill().getDiscountInterest());
                        context.getTailAdjustment().setAdjustmentAmount(correctTail);
                        logger.info("已自动更新尾差调整金额为: {} (托管确认利息{} - 系统利息{})",
                                correctTail,
                                context.getTrusteeConfirmation().getConfirmedInterest(),
                                context.getCommercialBill().getDiscountInterest());
                    }
                }

                if (!context.hasUnresolvedConflicts() && context.getStatus() == ReviewStatus.DATA_CONFLICT) {
                    if (context.hasPinyinApprover() && context.getManagerReviewRemark() == null) {
                        context.setStatus(ReviewStatus.PENDING_MANAGER_REVIEW);
                    } else {
                        context.setStatus(ReviewStatus.NORMAL);
                    }
                }
                return;
            }
        }
        logger.warn("未找到待解决的冲突记录，调整单号: {}", adjustmentNo);
    }
}
