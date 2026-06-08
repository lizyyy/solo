package com.xxx.financial.service;

import com.xxx.financial.model.BalanceChangeRecord;
import com.xxx.financial.model.ConflictEvidence;
import com.xxx.financial.model.InterestReviewContext;
import com.xxx.financial.model.ReviewResult;
import com.xxx.financial.model.SelfCheckResult;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

public class ExportService {

    private static final String DATE_FORMAT = "yyyy-MM-dd HH:mm:ss";

    public File exportReviewReport(InterestReviewContext context, ReviewResult finalResult, File outputDir) throws IOException {
        if (!outputDir.exists()) {
            outputDir.mkdirs();
        }
        String reviewNo = context.getReviewNo();
        File reportFile = new File(outputDir, reviewNo + "_复核报告.txt");
        try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(reportFile), StandardCharsets.UTF_8))) {
            writer.write("企业票据贴现利息复核报告\n");
            writer.write("============================================\n\n");

            writer.write(String.format("复核单号: %s\n", reviewNo));
            writer.write(String.format("操作人:   %s\n", context.getOperator()));
            writer.write(String.format("生成时间: %s\n", formatDate(new Date())));
            writer.write(String.format("最终状态: %s\n\n", context.getStatus().getDescription()));

            writer.write("-- 票据信息 --\n");
            writer.write(String.format("  票据号:     %s\n", context.getCommercialBill().getBillNo()));
            writer.write(String.format("  票据类型:   %s\n", context.getCommercialBill().getBillType()));
            writer.write(String.format("  票面金额:   %s\n", context.getCommercialBill().getFaceAmount()));
            writer.write(String.format("  贴现利率:   %s%%\n", context.getCommercialBill().getDiscountRate()));
            writer.write(String.format("  贴现利息:   %s\n\n", context.getCommercialBill().getDiscountInterest()));

            writer.write("-- 尾差调整 --\n");
            if (context.getTailAdjustment() != null) {
                writer.write(String.format("  调整单号:   %s\n", context.getTailAdjustment().getAdjustmentNo()));
                writer.write(String.format("  调整金额:   %s\n", context.getTailAdjustment().getAdjustmentAmount()));
                writer.write(String.format("  调整原因:   %s\n", context.getTailAdjustment().getAdjustmentReason()));
                writer.write(String.format("  审批人:     %s (%s)\n",
                        context.getTailAdjustment().getApprover(),
                        context.getTailAdjustment().getApproverType().getDescription()));
                if (context.getTailAdjustment().isPinyinApproverFlag()) {
                    writer.write("  注意: 审批人仅为拼音，已由客户经理复核\n");
                }
                writer.write(String.format("  导入批次:   %s\n\n", context.getTailAdjustment().getImportBatchNo()));
            }

            writer.write("-- 托管确认 --\n");
            if (context.getTrusteeConfirmation() != null) {
                writer.write(String.format("  确认单号:   %s\n", context.getTrusteeConfirmation().getConfirmationNo()));
                writer.write(String.format("  确认利息:   %s\n", context.getTrusteeConfirmation().getConfirmedInterest()));
                writer.write(String.format("  确认余额:   %s\n", context.getTrusteeConfirmation().getConfirmedBalance()));
                writer.write(String.format("  托管方:     %s\n", context.getTrusteeConfirmation().getTrustee()));
                writer.write(String.format("  确认状态:   %s\n\n", context.getTrusteeConfirmation().getConfirmationStatus()));
            }

            if (!context.getConflicts().isEmpty()) {
                writer.write("-- 数据冲突记录 --\n");
                for (ConflictEvidence conflict : context.getConflicts()) {
                    writer.write(String.format("  冲突类型: %s\n", conflict.getConflictType()));
                    writer.write(String.format("  说明:     %s\n", conflict.getDescription()));
                    writer.write(String.format("  已解决:   %s\n", conflict.isResolved() ? "是" : "否"));
                    if (conflict.getResolution() != null) {
                        writer.write(String.format("  处理方式: %s\n", conflict.getResolution()));
                    }
                    writer.write("\n");
                }
            }

            if (context.getManagerReviewRemark() != null) {
                writer.write(String.format("-- 客户经理复核 --\n  %s\n\n", context.getManagerReviewRemark()));
            }

            if (context.getProductDecision() != null) {
                writer.write(String.format("-- 产品决策 --\n  %s\n\n", context.getProductDecision()));
            }

            writer.write("-- 流程步骤状态 --\n");
            writer.write(String.format("  步骤1 尾差导入:   %s\n", context.isStep1ImportCompleted() ? "已完成" : "未完成"));
            writer.write(String.format("  步骤2 托管复核:   %s\n", context.isStep2TrusteeReviewed() ? "已完成" : "未完成"));
            writer.write(String.format("  步骤3 余额更新:   %s\n\n", context.isStep3BalanceUpdated() ? "已完成" : "未完成"));

            if (finalResult != null && finalResult.getMessages() != null) {
                writer.write("-- 处理消息 --\n");
                for (String msg : finalResult.getMessages()) {
                    writer.write(String.format("  %s\n", msg));
                }
                writer.write("\n");
            }

            List<SelfCheckResult> selfCheck = context.getSelfCheckResults();
            if (!selfCheck.isEmpty()) {
                writer.write("-- 自检报告 --\n");
                long passed = selfCheck.stream().filter(SelfCheckResult::isPassed).count();
                writer.write(String.format("  总计%d项, 通过%d项, 未通过%d项\n", selfCheck.size(), passed, selfCheck.size() - passed));
                for (SelfCheckResult r : selfCheck) {
                    writer.write(String.format("  %s %s: %s\n",
                            r.isPassed() ? "PASS" : "FAIL",
                            r.getCheckItem().getDescription(),
                            r.getMessage()));
                    if (r.getDetail() != null && !r.isPassed()) {
                        writer.write(String.format("    -> %s\n", r.getDetail()));
                    }
                }
            }
        }
        return reportFile;
    }

    public File exportBalanceCsv(InterestReviewContext context, File outputDir) throws IOException {
        if (!outputDir.exists()) {
            outputDir.mkdirs();
        }
        String reviewNo = context.getReviewNo();
        File csvFile = new File(outputDir, reviewNo + "_余额变化表.csv");
        try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(csvFile), StandardCharsets.UTF_8))) {
            writer.write("\uFEFF");
            writer.write("记录号,票据号,期初余额,变动金额,期末余额,变动时间,变动原因,操作人,关联业务号\n");
            SimpleDateFormat sdf = new SimpleDateFormat(DATE_FORMAT);
            for (BalanceChangeRecord r : context.getBalanceHistory()) {
                writer.write(String.format("%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
                        r.getRecordNo(),
                        r.getBillNo(),
                        r.getPreviousBalance(),
                        r.getChangeAmount(),
                        r.getCurrentBalance(),
                        r.getChangeTime() != null ? sdf.format(r.getChangeTime()) : "",
                        r.getChangeReason(),
                        r.getOperator(),
                        r.getRelatedBusinessNo()));
            }
        }
        return csvFile;
    }

    private String formatDate(Date date) {
        return new SimpleDateFormat(DATE_FORMAT).format(date);
    }
}
