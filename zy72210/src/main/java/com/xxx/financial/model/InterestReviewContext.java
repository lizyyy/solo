package com.xxx.financial.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.xxx.financial.enums.ReviewStatus;
import com.xxx.financial.enums.SelfCheckItem;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class InterestReviewContext {
    private String reviewNo;
    private CommercialBill commercialBill;
    private TailAdjustment tailAdjustment;
    private TrusteeConfirmation trusteeConfirmation;
    private List<BalanceChangeRecord> balanceHistory;
    private ReviewStatus status;
    private List<SelfCheckResult> selfCheckResults;
    private List<ConflictEvidence> conflicts;
    private String operator;
    private String managerReviewRemark;
    private String productDecision;
    private boolean step1ImportCompleted;
    private boolean step2TrusteeReviewed;
    private boolean step3BalanceUpdated;

    public InterestReviewContext() {
        this.balanceHistory = new ArrayList<>();
        this.selfCheckResults = new ArrayList<>();
        this.conflicts = new ArrayList<>();
        this.status = ReviewStatus.PENDING;
    }

    public String getReviewNo() {
        return reviewNo;
    }

    public void setReviewNo(String reviewNo) {
        this.reviewNo = reviewNo;
    }

    public CommercialBill getCommercialBill() {
        return commercialBill;
    }

    public void setCommercialBill(CommercialBill commercialBill) {
        this.commercialBill = commercialBill;
    }

    public TailAdjustment getTailAdjustment() {
        return tailAdjustment;
    }

    public void setTailAdjustment(TailAdjustment tailAdjustment) {
        this.tailAdjustment = tailAdjustment;
    }

    public TrusteeConfirmation getTrusteeConfirmation() {
        return trusteeConfirmation;
    }

    public void setTrusteeConfirmation(TrusteeConfirmation trusteeConfirmation) {
        this.trusteeConfirmation = trusteeConfirmation;
    }

    public List<BalanceChangeRecord> getBalanceHistory() {
        return balanceHistory;
    }

    public void setBalanceHistory(List<BalanceChangeRecord> balanceHistory) {
        this.balanceHistory = balanceHistory;
    }

    public ReviewStatus getStatus() {
        return status;
    }

    public void setStatus(ReviewStatus status) {
        this.status = status;
    }

    public List<SelfCheckResult> getSelfCheckResults() {
        return selfCheckResults;
    }

    public void setSelfCheckResults(List<SelfCheckResult> selfCheckResults) {
        this.selfCheckResults = selfCheckResults;
    }

    public List<ConflictEvidence> getConflicts() {
        return conflicts;
    }

    public void setConflicts(List<ConflictEvidence> conflicts) {
        this.conflicts = conflicts;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public String getManagerReviewRemark() {
        return managerReviewRemark;
    }

    public void setManagerReviewRemark(String managerReviewRemark) {
        this.managerReviewRemark = managerReviewRemark;
    }

    public String getProductDecision() {
        return productDecision;
    }

    public void setProductDecision(String productDecision) {
        this.productDecision = productDecision;
    }

    public boolean isStep1ImportCompleted() {
        return step1ImportCompleted;
    }

    public void setStep1ImportCompleted(boolean step1ImportCompleted) {
        this.step1ImportCompleted = step1ImportCompleted;
    }

    public boolean isStep2TrusteeReviewed() {
        return step2TrusteeReviewed;
    }

    public void setStep2TrusteeReviewed(boolean step2TrusteeReviewed) {
        this.step2TrusteeReviewed = step2TrusteeReviewed;
    }

    public boolean isStep3BalanceUpdated() {
        return step3BalanceUpdated;
    }

    public void setStep3BalanceUpdated(boolean step3BalanceUpdated) {
        this.step3BalanceUpdated = step3BalanceUpdated;
    }

    public void addSelfCheckResult(SelfCheckResult result) {
        this.selfCheckResults.add(result);
    }

    public void removeSelfCheckItem(SelfCheckItem item) {
        this.selfCheckResults.removeIf(r -> r.getCheckItem() == item);
    }

    public void addConflict(ConflictEvidence conflict) {
        this.conflicts.add(conflict);
    }

    public boolean hasUnresolvedConflicts() {
        return conflicts.stream().anyMatch(c -> !c.isResolved());
    }

    public boolean hasPinyinApprover() {
        return tailAdjustment != null && tailAdjustment.isPinyinApproverFlag();
    }

    public boolean isAllSelfCheckPassed() {
        return selfCheckResults.stream().allMatch(SelfCheckResult::isPassed);
    }

    public boolean hasBlockingErrors() {
        return selfCheckResults.stream().anyMatch(SelfCheckResult::isBlockingError);
    }

    public void overrideSelfCheckItem(com.xxx.financial.enums.SelfCheckItem item, String reason) {
        for (SelfCheckResult result : selfCheckResults) {
            if (result.getCheckItem() == item) {
                result.overrideAsPassed(reason);
                return;
            }
        }
    }

    public long getSelfCheckPassedCount() {
        return selfCheckResults.stream().filter(SelfCheckResult::isPassed).count();
    }

    public long getSelfCheckWarningCount() {
        return selfCheckResults.stream()
                .filter(r -> r.getSeverity() == com.xxx.financial.enums.CheckSeverity.WARNING)
                .filter(r -> !r.isPassed())
                .count();
    }

    public long getSelfCheckBlockingErrorCount() {
        return selfCheckResults.stream().filter(SelfCheckResult::isBlockingError).count();
    }
}
