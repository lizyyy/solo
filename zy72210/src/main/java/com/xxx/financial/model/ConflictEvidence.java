package com.xxx.financial.model;

import java.math.BigDecimal;

public class ConflictEvidence {
    private String billNo;
    private String adjustmentNo;
    private String confirmationNo;
    private BigDecimal tailAdjustmentAmount;
    private BigDecimal trusteeConfirmedAmount;
    private BigDecimal difference;
    private String conflictType;
    private String description;
    private boolean resolved;
    private String resolution;

    public String getBillNo() {
        return billNo;
    }

    public void setBillNo(String billNo) {
        this.billNo = billNo;
    }

    public String getAdjustmentNo() {
        return adjustmentNo;
    }

    public void setAdjustmentNo(String adjustmentNo) {
        this.adjustmentNo = adjustmentNo;
    }

    public String getConfirmationNo() {
        return confirmationNo;
    }

    public void setConfirmationNo(String confirmationNo) {
        this.confirmationNo = confirmationNo;
    }

    public BigDecimal getTailAdjustmentAmount() {
        return tailAdjustmentAmount;
    }

    public void setTailAdjustmentAmount(BigDecimal tailAdjustmentAmount) {
        this.tailAdjustmentAmount = tailAdjustmentAmount;
    }

    public BigDecimal getTrusteeConfirmedAmount() {
        return trusteeConfirmedAmount;
    }

    public void setTrusteeConfirmedAmount(BigDecimal trusteeConfirmedAmount) {
        this.trusteeConfirmedAmount = trusteeConfirmedAmount;
    }

    public BigDecimal getDifference() {
        return difference;
    }

    public void setDifference(BigDecimal difference) {
        this.difference = difference;
    }

    public String getConflictType() {
        return conflictType;
    }

    public void setConflictType(String conflictType) {
        this.conflictType = conflictType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isResolved() {
        return resolved;
    }

    public void setResolved(boolean resolved) {
        this.resolved = resolved;
    }

    public String getResolution() {
        return resolution;
    }

    public void setResolution(String resolution) {
        this.resolution = resolution;
    }

    public String formatConflictReport() {
        return String.format("【数据冲突】票据号:%s, 尾差调整金额:%s, 托管确认金额:%s, 差额:%s, 冲突类型:%s, 说明:%s",
                billNo, tailAdjustmentAmount, trusteeConfirmedAmount, difference, conflictType, description);
    }
}
