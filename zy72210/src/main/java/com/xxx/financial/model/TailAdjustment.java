package com.xxx.financial.model;

import com.xxx.financial.enums.ApproverType;

import java.math.BigDecimal;
import java.util.Date;

public class TailAdjustment {
    private String adjustmentNo;
    private String billNo;
    private BigDecimal adjustmentAmount;
    private String adjustmentReason;
    private String approver;
    private ApproverType approverType;
    private Date importTime;
    private String importBatchNo;
    private String remark;
    private boolean pinyinApproverFlag;

    public String getAdjustmentNo() {
        return adjustmentNo;
    }

    public void setAdjustmentNo(String adjustmentNo) {
        this.adjustmentNo = adjustmentNo;
    }

    public String getBillNo() {
        return billNo;
    }

    public void setBillNo(String billNo) {
        this.billNo = billNo;
    }

    public BigDecimal getAdjustmentAmount() {
        return adjustmentAmount;
    }

    public void setAdjustmentAmount(BigDecimal adjustmentAmount) {
        this.adjustmentAmount = adjustmentAmount;
    }

    public String getAdjustmentReason() {
        return adjustmentReason;
    }

    public void setAdjustmentReason(String adjustmentReason) {
        this.adjustmentReason = adjustmentReason;
    }

    public String getApprover() {
        return approver;
    }

    public void setApprover(String approver) {
        this.approver = approver;
    }

    public ApproverType getApproverType() {
        return approverType;
    }

    public void setApproverType(ApproverType approverType) {
        this.approverType = approverType;
    }

    public Date getImportTime() {
        return importTime;
    }

    public void setImportTime(Date importTime) {
        this.importTime = importTime;
    }

    public String getImportBatchNo() {
        return importBatchNo;
    }

    public void setImportBatchNo(String importBatchNo) {
        this.importBatchNo = importBatchNo;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public boolean isPinyinApproverFlag() {
        return pinyinApproverFlag;
    }

    public void setPinyinApproverFlag(boolean pinyinApproverFlag) {
        this.pinyinApproverFlag = pinyinApproverFlag;
    }
}
