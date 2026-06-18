package com.xxx.financial.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.util.Date;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CommercialBill {
    private String billNo;
    private String billType;
    private BigDecimal faceAmount;
    private BigDecimal discountRate;
    private Date discountDate;
    private Date maturityDate;
    private BigDecimal discountInterest;
    private String drawer;
    private String drawee;

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

    public Date getDiscountDate() {
        return discountDate;
    }

    public void setDiscountDate(Date discountDate) {
        this.discountDate = discountDate;
    }

    public Date getMaturityDate() {
        return maturityDate;
    }

    public void setMaturityDate(Date maturityDate) {
        this.maturityDate = maturityDate;
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
}
