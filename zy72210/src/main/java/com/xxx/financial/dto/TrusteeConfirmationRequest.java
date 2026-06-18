package com.xxx.financial.dto;

import java.math.BigDecimal;
import java.util.Date;

public class TrusteeConfirmationRequest {
    private String reviewNo;
    private String confirmationNo;
    private String billNo;
    private BigDecimal confirmedInterest;
    private BigDecimal confirmedBalance;
    private Date confirmationDate;
    private String trustee;
    private String confirmationStatus;
    private String remark;

    public String getReviewNo() { return reviewNo; }
    public void setReviewNo(String reviewNo) { this.reviewNo = reviewNo; }
    public String getConfirmationNo() { return confirmationNo; }
    public void setConfirmationNo(String confirmationNo) { this.confirmationNo = confirmationNo; }
    public String getBillNo() { return billNo; }
    public void setBillNo(String billNo) { this.billNo = billNo; }
    public BigDecimal getConfirmedInterest() { return confirmedInterest; }
    public void setConfirmedInterest(BigDecimal confirmedInterest) { this.confirmedInterest = confirmedInterest; }
    public BigDecimal getConfirmedBalance() { return confirmedBalance; }
    public void setConfirmedBalance(BigDecimal confirmedBalance) { this.confirmedBalance = confirmedBalance; }
    public Date getConfirmationDate() { return confirmationDate; }
    public void setConfirmationDate(Date confirmationDate) { this.confirmationDate = confirmationDate; }
    public String getTrustee() { return trustee; }
    public void setTrustee(String trustee) { this.trustee = trustee; }
    public String getConfirmationStatus() { return confirmationStatus; }
    public void setConfirmationStatus(String confirmationStatus) { this.confirmationStatus = confirmationStatus; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
}
