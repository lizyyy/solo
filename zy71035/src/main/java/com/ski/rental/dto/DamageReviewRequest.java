package com.ski.rental.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public class DamageReviewRequest {
    @NotBlank(message = "订单号不能为空")
    private String orderNo;

    @NotNull(message = "最终定损费用不能为空")
    private BigDecimal finalDamageFee;

    private Boolean damageConfirmed = true;
    private String reviewNote;
    private String reviewer;

    public String getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(String orderNo) {
        this.orderNo = orderNo;
    }

    public BigDecimal getFinalDamageFee() {
        return finalDamageFee;
    }

    public void setFinalDamageFee(BigDecimal finalDamageFee) {
        this.finalDamageFee = finalDamageFee;
    }

    public Boolean getDamageConfirmed() {
        return damageConfirmed;
    }

    public void setDamageConfirmed(Boolean damageConfirmed) {
        this.damageConfirmed = damageConfirmed;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public void setReviewNote(String reviewNote) {
        this.reviewNote = reviewNote;
    }

    public String getReviewer() {
        return reviewer;
    }

    public void setReviewer(String reviewer) {
        this.reviewer = reviewer;
    }
}
