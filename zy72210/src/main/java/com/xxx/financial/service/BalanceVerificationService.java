package com.xxx.financial.service;

import com.xxx.financial.enums.ReviewStatus;
import com.xxx.financial.model.BalanceChangeRecord;
import com.xxx.financial.model.InterestReviewContext;
import com.xxx.financial.model.TailAdjustment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.UUID;

public class BalanceVerificationService {

    private static final Logger logger = LoggerFactory.getLogger(BalanceVerificationService.class);

    private static final BigDecimal TOLERANCE = new BigDecimal("0.01");

    public boolean verifyBalanceHistory(InterestReviewContext context) {
        List<BalanceChangeRecord> history = context.getBalanceHistory();
        if (history == null || history.isEmpty()) {
            logger.warn("余额历史记录为空，无法校验");
            return false;
        }

        history.sort(Comparator.comparing(BalanceChangeRecord::getChangeTime));

        BigDecimal expectedBalance = BigDecimal.ZERO;
        boolean firstRecord = true;

        for (BalanceChangeRecord record : history) {
            if (firstRecord) {
                expectedBalance = record.getPreviousBalance().add(record.getChangeAmount());
                firstRecord = false;
            } else {
                if (record.getPreviousBalance().compareTo(expectedBalance) != 0) {
                    logger.error("余额变化表不连续，上一条期望余额: {}, 当前条期初余额: {}",
                            expectedBalance, record.getPreviousBalance());
                    return false;
                }
                expectedBalance = record.getPreviousBalance().add(record.getChangeAmount());
            }

            if (expectedBalance.subtract(record.getCurrentBalance()).abs().compareTo(TOLERANCE) > 0) {
                logger.error("余额变化表计算错误，记录号: {}, 计算余额: {}, 记录余额: {}",
                        record.getRecordNo(), expectedBalance, record.getCurrentBalance());
                return false;
            }
        }

        logger.info("余额变化表校验通过，共{}条记录，最终余额: {}", history.size(), expectedBalance);
        return true;
    }

    public boolean verifyBalanceMatchesAdjustment(InterestReviewContext context) {
        List<BalanceChangeRecord> history = context.getBalanceHistory();
        TailAdjustment tail = context.getTailAdjustment();

        if (history == null || history.isEmpty() || tail == null) {
            return false;
        }

        BalanceChangeRecord relatedRecord = history.stream()
                .filter(r -> tail.getAdjustmentNo().equals(r.getRelatedBusinessNo()))
                .findFirst()
                .orElse(null);

        if (relatedRecord == null) {
            logger.warn("未找到与尾差调整相关的余额变化记录，调整单号: {}", tail.getAdjustmentNo());
            return false;
        }

        BigDecimal diff = relatedRecord.getChangeAmount().subtract(tail.getAdjustmentAmount()).abs();
        if (diff.compareTo(TOLERANCE) > 0) {
            logger.error("尾差调整金额与余额变化金额不一致，调整金额: {}, 余额变化: {}",
                    tail.getAdjustmentAmount(), relatedRecord.getChangeAmount());
            return false;
        }

        logger.info("尾差调整与余额变化记录匹配，调整单号: {}", tail.getAdjustmentNo());
        return true;
    }

    public BalanceChangeRecord createBalanceRecord(InterestReviewContext context) {
        TailAdjustment tail = context.getTailAdjustment();
        List<BalanceChangeRecord> history = context.getBalanceHistory();

        BigDecimal previousBalance = history.isEmpty() ? BigDecimal.ZERO :
                history.get(history.size() - 1).getCurrentBalance();

        BalanceChangeRecord record = new BalanceChangeRecord();
        record.setRecordNo("BAL" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        record.setBillNo(tail.getBillNo());
        record.setPreviousBalance(previousBalance);
        record.setChangeAmount(tail.getAdjustmentAmount());
        record.setCurrentBalance(previousBalance.add(tail.getAdjustmentAmount()));
        record.setChangeTime(new Date());
        record.setChangeReason("企业票据贴现利息尾差调整");
        record.setOperator(context.getOperator());
        record.setRelatedBusinessNo(tail.getAdjustmentNo());

        return record;
    }

    public boolean updateBalanceTable(InterestReviewContext context) {
        logger.info("开始更新余额变化表，票据号: {}", context.getCommercialBill().getBillNo());

        if (!context.isStep2TrusteeReviewed()) {
            logger.error("未完成托管确认页复核，不能更新余额变化表");
            return false;
        }

        if (context.hasUnresolvedConflicts()) {
            logger.error("存在未解决的数据冲突，不能更新余额变化表");
            return false;
        }

        if (context.hasPinyinApprover() && context.getManagerReviewRemark() == null) {
            logger.error("审批人仅为拼音且未经过客户经理复核，不能更新余额变化表");
            return false;
        }

        BalanceChangeRecord newRecord = createBalanceRecord(context);
        context.getBalanceHistory().add(newRecord);

        if (!verifyBalanceHistory(context)) {
            context.getBalanceHistory().remove(newRecord);
            logger.error("余额变化表更新后校验失败，已回滚");
            return false;
        }

        context.setStep3BalanceUpdated(true);
        context.setStatus(ReviewStatus.REVIEW_PASSED);

        logger.info("余额变化表更新成功，记录号: {}, 当前余额: {}",
                newRecord.getRecordNo(), newRecord.getCurrentBalance());
        return true;
    }

    public BigDecimal getCurrentBalance(InterestReviewContext context) {
        List<BalanceChangeRecord> history = context.getBalanceHistory();
        if (history == null || history.isEmpty()) {
            return BigDecimal.ZERO;
        }
        return history.get(history.size() - 1).getCurrentBalance();
    }
}
