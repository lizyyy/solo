package com.xxx.financial.dto;

import com.fasterxml.jackson.annotation.JsonFormat;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.Date;

public class ImportTailAdjustmentRequest {

    @NotBlank(message = "票据号不能为空")
    private String billNo;
    @NotBlank(message = "票据类型不能为空")
    private String billType;
    @NotNull(message = "票面金额不能为空")
    private BigDecimal faceAmount;
    @NotNull(message = "贴现利率不能为空")
    private BigDecimal discountRate;
    @NotNull(message = "贴现利息不能为空")
    private BigDecimal discountInterest;
    private String drawer;
    private String drawee;

    @NotBlank(message = "调整单号不能为空")
    private String adjustmentNo;
    @NotNull(message = "调整金额不能为空")
    private BigDecimal adjustmentAmount;
    private String adjustmentReason;
    @NotBlank(message = "审批人不能为空")
    private String approver;
    private String importBatchNo;
    private String operator;

    public String getBillNo() {
        return billNo;
    }

    public void setBillNo(String billNo) {
        this.billNo = billNo;
    }

    public String getBillType() {
        return billType;
    }

    public void setBillType(String billType) {
        this.billType = billType;
    }

    public BigDecimal getFaceAmount() {
        return faceAmount;
    }

    public void setFaceAmount(BigDecimal faceAmount) {
        this.faceAmount = faceAmount;
    }

    public BigDecimal getDiscountRate() {
        return discountRate;
    }

    public void setDiscountRate(BigDecimal discountRate) {
        this.discountRate = discountRate;
    }

    public BigDecimal getDiscountInterest() {
        return discountInterest;
    }

    public void setDiscountInterest(BigDecimal discountInterest) {
        this.discountInterest = discountInterest;
    }

    public String getDrawer() {
        return drawer;
    }

    public void setDrawer(String drawer) {
        this.drawer = drawer;
    }

    public String getDrawee() {
        return drawee;
    }

    public void setDrawee(String drawee) {
        this.drawee = drawee;
    }

    public String getAdjustmentNo() {
        return adjustmentNo;
    }

    public void setAdjustmentNo(String adjustmentNo) {
        this.adjustmentNo = adjustmentNo;
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

    public String getImportBatchNo() {
        return importBatchNo;
    }

    public void setImportBatchNo(String importBatchNo) {
        this.importBatchNo = importBatchNo;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }
}
