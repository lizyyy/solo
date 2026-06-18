package com.xxx.financial.dto;

public class ResolveConflictRequest {
    private String reviewNo;
    private String adjustmentNo;
    private boolean confirmAdjustment;
    private String decisionRemark;

    public String getReviewNo() { return reviewNo; }
    public void setReviewNo(String reviewNo) { this.reviewNo = reviewNo; }
    public String getAdjustmentNo() { return adjustmentNo; }
    public void setAdjustmentNo(String adjustmentNo) { this.adjustmentNo = adjustmentNo; }
    public boolean isConfirmAdjustment() { return confirmAdjustment; }
    public void setConfirmAdjustment(boolean confirmAdjustment) { this.confirmAdjustment = confirmAdjustment; }
    public String getDecisionRemark() { return decisionRemark; }
    public void setDecisionRemark(String decisionRemark) { this.decisionRemark = decisionRemark; }
}
