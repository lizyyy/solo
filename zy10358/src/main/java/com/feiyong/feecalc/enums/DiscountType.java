package com.feiyong.feecalc.enums;

public enum DiscountType {
    PERCENTAGE("百分比折扣"),
    FIXED_AMOUNT("固定金额减免"),
    COUPON("优惠券"),
    VIP("会员折扣");

    private final String description;

    DiscountType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
