package com.xxx.financial.dto;

import java.math.BigDecimal;
import java.util.Date;

public class TailAdjustmentRequest {
    private String reviewNo;
    private String adjustmentNo;
    private String billNo;
    private BigDecimal adjustmentAmount;
    private String adjustmentReason;
    private String approver;
    private Date importTime;
    private String importBatchNo;

    public String getReviewNo() { return reviewNo; }
    public void setReviewNo(String reviewNo) { this.reviewNo = reviewNo; }
    public String getAdjustmentNo() { return adjustmentNo; }
    public void setAdjustmentNo(String adjustmentNo) { this.adjustmentNo = adjustmentNo; }
    public String getBillNo() { return billNo; }
    public void setBillNo(String billNo) { this.billNo = billNo; }
    public BigDecimal getAdjustmentAmount() { return adjustmentAmount; }
    public void setAdjustmentAmount(BigDecimal adjustmentAmount) { this.adjustmentAmount = adjustmentAmount; }
    public String getAdjustmentReason() { return adjustmentReason; }
    public void setAdjustmentReason(String adjustmentReason) { this.adjustmentReason = adjustmentReason; }
    public String getApprover() { return approver; }
    public void setApprover(String approver) { this.approver = approver; }
    public Date getImportTime() { return importTime; }
    public void setImportTime(Date importTime) { this.importTime = importTime; }
    public String getImportBatchNo() { return importBatchNo; }
    public void setImportBatchNo(String importBatchNo) { this.importBatchNo = importBatchNo; }
}
