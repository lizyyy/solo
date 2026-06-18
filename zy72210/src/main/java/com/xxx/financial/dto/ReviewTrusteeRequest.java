package com.xxx.financial.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;

public class ReviewTrusteeRequest {

    @NotBlank(message = "复核单号不能为空")
    private String reviewNo;
    @NotBlank(message = "确认单号不能为空")
    private String confirmationNo;
    @NotNull(message = "确认利息不能为空")
    private BigDecimal confirmedInterest;
    @NotNull(message = "确认余额不能为空")
    private BigDecimal confirmedBalance;
    private String trustee;
    private String confirmationStatus;
    private String remark;

    public String getReviewNo() {
        return reviewNo;
    }

    public void setReviewNo(String reviewNo) {
        this.reviewNo = reviewNo;
    }

    public String getConfirmationNo() {
        return confirmationNo;
    }

    public void setConfirmationNo(String confirmationNo) {
        this.confirmationNo = confirmationNo;
    }

    public BigDecimal getConfirmedInterest() {
        return confirmedInterest;
    }

    public void setConfirmedInterest(BigDecimal confirmedInterest) {
        this.confirmedInterest = confirmedInterest;
    }

    public BigDecimal getConfirmedBalance() {
        return confirmedBalance;
    }

    public void setConfirmedBalance(BigDecimal confirmedBalance) {
        this.confirmedBalance = confirmedBalance;
    }

    public String getTrustee() {
        return trustee;
    }

    public void setTrustee(String trustee) {
        this.trustee = trustee;
    }

    public String getConfirmationStatus() {
        return confirmationStatus;
    }

    public void setConfirmationStatus(String confirmationStatus) {
        this.confirmationStatus = confirmationStatus;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }
}
