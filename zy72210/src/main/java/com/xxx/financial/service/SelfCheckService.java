package com.xxx.financial.service;

import com.xxx.financial.enums.ReviewStatus;
import com.xxx.financial.enums.SelfCheckItem;
import com.xxx.financial.model.InterestReviewContext;
import com.xxx.financial.model.SelfCheckResult;
import com.xxx.financial.model.TailAdjustment;
import com.xxx.financial.util.PinyinDetector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.util.List;

public class SelfCheckService {

    private static final Logger logger = LoggerFactory.getLogger(SelfCheckService.class);

    private final TailAdjustmentService tailAdjustmentService;
    private final BalanceVerificationService balanceVerificationService;
    private final TrusteeConfirmationService trusteeConfirmationService;

    public SelfCheckService(TailAdjustmentService tailAdjustmentService,
                            BalanceVerificationService balanceVerificationService,
                            TrusteeConfirmationService trusteeConfirmationService) {
        this.tailAdjustmentService = tailAdjustmentService;
        this.balanceVerificationService = balanceVerificationService;
        this.trusteeConfirmationService = trusteeConfirmationService;
    }

    public List<SelfCheckResult> runAllChecks(InterestReviewContext context) {
        context.getSelfCheckResults().clear();

        checkDuplicateImport(context);
        checkApproverPinyin(context);
        checkSupplementRecalculate(context);
        checkExportConsistency(context);
        checkBalanceHistoryMatch(context);
        checkTailTrusteeConflict(context);

        return context.getSelfCheckResults();
    }

    public SelfCheckResult checkDuplicateImport(InterestReviewContext context) {
        TailAdjustment tail = context.getTailAdjustment();
        SelfCheckResult result;

        if (tail == null) {
            result = new SelfCheckResult(SelfCheckItem.DUPLICATE_IMPORT, false, "尾差调整数据为空");
        } else if (tailAdjustmentService.isDuplicateImport(tail.getAdjustmentNo())) {
            result = new SelfCheckResult(SelfCheckItem.DUPLICATE_IMPORT, false,
                    "检测到重复导入", "调整单号" + tail.getAdjustmentNo() + "已存在于导入记录中");
            context.setStatus(ReviewStatus.CALIBER_ERROR);
        } else {
            result = new SelfCheckResult(SelfCheckItem.DUPLICATE_IMPORT, true, "无重复导入");
        }

        context.addSelfCheckResult(result);
        logCheckResult(result);
        return result;
    }

    public SelfCheckResult checkApproverPinyin(InterestReviewContext context) {
        TailAdjustment tail = context.getTailAdjustment();
        SelfCheckResult result;

        if (tail == null) {
            result = new SelfCheckResult(SelfCheckItem.APPROVER_PINYIN, false, "尾差调整数据为空");
        } else {
            boolean isPinyin = PinyinDetector.isPinyinOnly(tail.getApprover());
            if (isPinyin) {
                result = new SelfCheckResult(SelfCheckItem.APPROVER_PINYIN, false,
                        "审批人仅为拼音，需客户经理复核",
                        "审批人: " + tail.getApprover() + "，检测为纯拼音格式，不属于罕见边角料，作为正常流程但需人工确认");
                tail.setPinyinApproverFlag(true);
            } else {
                result = new SelfCheckResult(SelfCheckItem.APPROVER_PINYIN, true, "审批人信息完整");
            }
        }

        context.addSelfCheckResult(result);
        logCheckResult(result);
        return result;
    }

    public SelfCheckResult checkSupplementRecalculate(InterestReviewContext context) {
        SelfCheckResult result;

        if (context.getTailAdjustment() == null) {
            result = new SelfCheckResult(SelfCheckItem.SUPPLEMENT_RECALCULATE, false, "尾差调整数据为空");
        } else if (context.getCommercialBill() == null) {
            result = new SelfCheckResult(SelfCheckItem.SUPPLEMENT_RECALCULATE, false, "票据基础数据为空");
        } else if (context.getTrusteeConfirmation() == null) {
            result = new SelfCheckResult(SelfCheckItem.SUPPLEMENT_RECALCULATE, true,
                    "托管确认数据为空，补录重算待复核");
        } else {
            BigDecimal systemInterest = context.getCommercialBill().getDiscountInterest();
            BigDecimal tailAdjustment = context.getTailAdjustment().getAdjustmentAmount();
            BigDecimal expectedInterest = systemInterest.add(tailAdjustment);
            BigDecimal trusteeConfirmedInterest = context.getTrusteeConfirmation().getConfirmedInterest();
            BigDecimal diff = expectedInterest.subtract(trusteeConfirmedInterest).abs();

            if (diff.compareTo(new BigDecimal("0.01")) > 0) {
                result = new SelfCheckResult(SelfCheckItem.SUPPLEMENT_RECALCULATE, false,
                        "补录后重算不匹配",
                        "系统利息(" + systemInterest + ") + 尾差调整(" + tailAdjustment +
                                ") = " + expectedInterest + ", 托管确认利息: " + trusteeConfirmedInterest +
                                ", 差额: " + diff);
                context.setStatus(ReviewStatus.CALIBER_ERROR);
            } else {
                result = new SelfCheckResult(SelfCheckItem.SUPPLEMENT_RECALCULATE, true,
                        "补录后重算一致",
                        "系统利息(" + systemInterest + ") + 尾差调整(" + tailAdjustment +
                                ") = 托管确认利息(" + trusteeConfirmedInterest + ")");
            }
        }

        context.addSelfCheckResult(result);
        logCheckResult(result);
        return result;
    }

    public SelfCheckResult checkExportConsistency(InterestReviewContext context) {
        SelfCheckResult result;

        if (context.getTailAdjustment() == null || context.getTrusteeConfirmation() == null) {
            result = new SelfCheckResult(SelfCheckItem.EXPORT_CONSISTENCY, false, "导出数据不完整");
        } else {
            boolean adjustmentMatch = context.getTailAdjustment().getBillNo()
                    .equals(context.getCommercialBill().getBillNo());
            boolean trusteeMatch = context.getTrusteeConfirmation().getBillNo()
                    .equals(context.getCommercialBill().getBillNo());

            if (adjustmentMatch && trusteeMatch) {
                result = new SelfCheckResult(SelfCheckItem.EXPORT_CONSISTENCY, true, "导出数据一致");
            } else {
                result = new SelfCheckResult(SelfCheckItem.EXPORT_CONSISTENCY, false,
                        "导出数据不一致",
                        "票据号不匹配: 尾差调整=" + context.getTailAdjustment().getBillNo() +
                                ", 托管确认=" + context.getTrusteeConfirmation().getBillNo() +
                                ", 票据=" + context.getCommercialBill().getBillNo());
            }
        }

        context.addSelfCheckResult(result);
        logCheckResult(result);
        return result;
    }

    public SelfCheckResult checkBalanceHistoryMatch(InterestReviewContext context) {
        boolean historyValid = balanceVerificationService.verifyBalanceHistory(context);
        boolean matchValid = balanceVerificationService.verifyBalanceMatchesAdjustment(context);

        SelfCheckResult result;
        if (context.getBalanceHistory() == null || context.getBalanceHistory().isEmpty()) {
            result = new SelfCheckResult(SelfCheckItem.BALANCE_HISTORY_MATCH, true,
                    "余额历史为空，待更新");
        } else if (!historyValid) {
            result = new SelfCheckResult(SelfCheckItem.BALANCE_HISTORY_MATCH, false,
                    "余额变化表不连续，请检查历史数据",
                    "历史连续校验: 未通过, 存在余额中断或计算错误");
        } else if (context.getTailAdjustment() != null && !matchValid) {
            boolean hasRelatedRecord = context.getBalanceHistory().stream()
                    .anyMatch(r -> context.getTailAdjustment().getAdjustmentNo().equals(r.getRelatedBusinessNo()));
            if (!hasRelatedRecord) {
                result = new SelfCheckResult(SelfCheckItem.BALANCE_HISTORY_MATCH, true,
                        "余额历史连续，尾差调整待更新到余额表",
                        "历史连续校验: 通过, 尾差记录尚未同步到余额表");
            } else {
                result = new SelfCheckResult(SelfCheckItem.BALANCE_HISTORY_MATCH, false,
                        "余额变化表与历史记录不匹配",
                        "历史连续校验: 通过, 尾差匹配校验: 未通过");
            }
        } else if (matchValid) {
            result = new SelfCheckResult(SelfCheckItem.BALANCE_HISTORY_MATCH, true,
                    "余额变化表与历史记录一致");
        } else {
            result = new SelfCheckResult(SelfCheckItem.BALANCE_HISTORY_MATCH, false,
                    "余额变化表与历史记录不匹配",
                    "历史连续校验: " + historyValid + ", 尾差匹配校验: " + matchValid);
        }

        context.addSelfCheckResult(result);
        logCheckResult(result);
        return result;
    }

    public SelfCheckResult checkTailTrusteeConflict(InterestReviewContext context) {
        boolean hasConflict = trusteeConfirmationService.checkConflict(context,
                context.getTailAdjustment(), context.getTrusteeConfirmation()) != null;

        SelfCheckResult result;
        if (!hasConflict) {
            result = new SelfCheckResult(SelfCheckItem.TAIL_TRUSTEE_CONFLICT, true,
                    "尾差调整与托管确认无冲突");
        } else {
            result = new SelfCheckResult(SelfCheckItem.TAIL_TRUSTEE_CONFLICT, false,
                    "尾差调整与托管确认存在冲突",
                    "请支付平台产品阿南确认后再继续处理");
        }

        context.addSelfCheckResult(result);
        logCheckResult(result);
        return result;
    }

    private BigDecimal calculateInterest(InterestReviewContext context) {
        return context.getCommercialBill().getDiscountInterest()
                .add(context.getTailAdjustment().getAdjustmentAmount());
    }

    private void logCheckResult(SelfCheckResult result) {
        String status = result.isPassed() ? "通过" : "未通过";
        logger.info("自检[{}] - {}: {}", result.getCheckItem().getDescription(), status, result.getMessage());
    }

    public String formatSelfCheckReport(List<SelfCheckResult> results) {
        StringBuilder sb = new StringBuilder();
        sb.append("【企业票据贴现利息复核自检报告】\n");
        sb.append("----------------------------------------\n");

        long passed = results.stream().filter(SelfCheckResult::isPassed).count();
        long failed = results.size() - passed;

        sb.append(String.format("总计: %d项, 通过: %d项, 未通过: %d项\n", results.size(), passed, failed));
        sb.append("----------------------------------------\n");

        for (SelfCheckResult result : results) {
            String status = result.isPassed() ? "✓ 通过" : "✗ 未通过";
            sb.append(String.format("%s %s: %s\n", status,
                    result.getCheckItem().getDescription(), result.getMessage()));
            if (result.getDetail() != null && !result.isPassed()) {
                sb.append(String.format("  详情: %s\n", result.getDetail()));
            }
        }

        return sb.toString();
    }
}
